/**
 * phase2DataModel.live.test.ts — Phase 2 Translation Operator Pipeline V2 DB invariants (LIVE).
 *
 * SELF-SKIPS unless RUN_DB_INVARIANTS=1 AND SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are present,
 * so normal CI never hits the live DB. Run:
 *   RUN_DB_INVARIANTS=1 SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     pnpm --filter web exec vitest run src/lib/translation/orders/__tests__/phase2DataModel.live.test.ts
 *
 * Data is SYNTHETIC: every checkout/session key is prefixed 'PHASE2_TEST_'. PII-free: only keys,
 * counts, statuses, and hash prefixes are asserted — never field values. Cleanup via phase2AdminCleanup.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import {
  createOrGetOrder,
  getOrderByCheckout,
  bindCanonicalDocument,
  transitionOrder,
  applyOperatorOverride,
  resolveOrderCanonical,
  createArtifactAndEnqueue,
  claimOutboxEvent,
  listOrderArtifacts,
  phase2AdminCleanup,
  TranslationOrderError,
  TRANSLATION_ARTIFACTS_BUCKET,
} from '..'

const GATE =
  process.env.RUN_DB_INVARIANTS === '1' &&
  !!process.env.SUPABASE_URL &&
  !!process.env.SUPABASE_SERVICE_ROLE_KEY

const PREFIX = 'PHASE2_TEST_'
function key(suffix: string): string {
  return `${PREFIX}${suffix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function admin(): SupabaseClient {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })
}

/** Insert a minimal sentinel canonical_documents row directly; returns its id. PHASE2_TEST_ session. */
async function insertSentinelCanonical(
  sessionId: string,
  fields: Array<{ key: string; finalValue: string | null; reviewRequired?: boolean }>
): Promise<string> {
  const sb = admin()
  const fieldsJson = fields.map((f) => ({
    key: f.key,
    rawValue: null,
    normalizedValue: null,
    finalValue: f.finalValue, // null preserved (INV-11); string passes through
    source: 'document_ocr',
    criticality: 'standard',
    confidence: { final: f.reviewRequired ? 0.4 : 0.99 },
    reviewRequired: f.reviewRequired ?? false,
    reviewReasons: [],
    evidence: [],
  }))
  const fieldsHash = createHash('sha256')
    .update(JSON.stringify({ sessionId, fields: fields.map((f) => f.key).sort() }))
    .digest('hex')
  const { data, error } = await sb
    .from('canonical_documents')
    .insert({
      session_id: sessionId,
      product: 'translation',
      doc_type: 'birth_certificate',
      fields_json: fieldsJson,
      result_hash: fieldsHash.slice(0, 32),
      fields_hash: fieldsHash,
      fields_hash_schema_version: 2,
    })
    .select('id')
    .single()
  if (error) throw new Error(`insertSentinelCanonical failed: ${error.message}`)
  return (data as { id: string }).id
}

describe.skipIf(!GATE)('Phase 2 data model (live, service-role path)', () => {
  beforeAll(async () => {
    await phase2AdminCleanup(PREFIX)
  })
  afterAll(async () => {
    await phase2AdminCleanup(PREFIX)
  })

  // 1 — concurrent duplicate submit collapses to one order
  it('1: concurrent duplicate submit → one order (UNIQUE)', async () => {
    const checkout = key('dup_submit')
    const results = await Promise.allSettled([
      createOrGetOrder({ checkoutSessionId: checkout, legacy: true }),
      createOrGetOrder({ checkoutSessionId: checkout, legacy: true }),
      createOrGetOrder({ checkoutSessionId: checkout, legacy: true }),
    ])
    const ok = results.filter((r) => r.status === 'fulfilled') as PromiseFulfilledResult<{
      order: { id: string }
    }>[]
    expect(ok.length).toBe(3)
    const ids = new Set(ok.map((r) => r.value.order.id))
    expect(ids.size).toBe(1) // all three resolved to the SAME order id
  })

  // 2 — same checkout cannot bind to a 2nd canonical
  it('2: same checkout cannot rebind to a 2nd canonical', async () => {
    const checkout = key('rebind')
    const { order } = await createOrGetOrder({ checkoutSessionId: checkout, legacy: true })
    const c1 = await insertSentinelCanonical(key('c1'), [{ key: 'name', finalValue: 'X' }])
    const c2 = await insertSentinelCanonical(key('c2'), [{ key: 'name', finalValue: 'Y' }])
    await bindCanonicalDocument(order.id, c1)
    // Second bind must NOT change the binding (rebind forbidden / .is(null) matches nothing).
    let rebindBlocked = false
    try {
      await bindCanonicalDocument(order.id, c2)
    } catch {
      rebindBlocked = true
    }
    const after = await getOrderByCheckout(checkout)
    expect(after?.canonicalDocumentId).toBe(c1)
    expect(rebindBlocked || after?.canonicalDocumentId === c1).toBe(true)
  })

  // 3 — cross-session canonical binding (app-level note): FK valid + bind is per-order
  it('3: canonical binding is per-order (FK + ownership note)', async () => {
    const checkout = key('xsession')
    const { order } = await createOrGetOrder({ checkoutSessionId: checkout, legacy: true })
    const c = await insertSentinelCanonical(key('xc'), [{ key: 'name', finalValue: 'Z' }])
    await bindCanonicalDocument(order.id, c)
    const reread = await getOrderByCheckout(checkout)
    expect(reread?.canonicalDocumentId).toBe(c)
    // Binding a non-existent canonical (FK violation) must fail.
    const other = await createOrGetOrder({ checkoutSessionId: key('xsession2'), legacy: true })
    let fkBlocked = false
    try {
      await bindCanonicalDocument(other.order.id, '00000000-0000-0000-0000-000000000000')
    } catch {
      fkBlocked = true
    }
    expect(fkBlocked).toBe(true)
  })

  // 4 — stale version rejected
  it('4: stale version rejected (ORDER_VERSION_CONFLICT)', async () => {
    const checkout = key('stale_ver')
    const { order } = await createOrGetOrder({ checkoutSessionId: checkout, legacy: true })
    await transitionOrder({
      orderId: order.id, expectedVersion: 0, expectedStatus: 'queued',
      toStatus: 'assigned', actor: 'op:test',
    })
    // version is now 1; using expectedVersion 0 again must conflict
    let code: string | null = null
    try {
      await transitionOrder({
        orderId: order.id, expectedVersion: 0, expectedStatus: 'assigned',
        toStatus: 'in_review', actor: 'op:test',
      })
    } catch (e) {
      code = (e as TranslationOrderError).code
    }
    expect(code).toBe('ORDER_VERSION_CONFLICT')
  })

  // 5 — invalid transition rejected
  it('5: invalid transition rejected (ORDER_INVALID_TRANSITION)', async () => {
    const checkout = key('invalid_trans')
    const { order } = await createOrGetOrder({ checkoutSessionId: checkout, legacy: true })
    let code: string | null = null
    try {
      // queued -> delivered is not allowed
      await transitionOrder({
        orderId: order.id, expectedVersion: 0, expectedStatus: 'queued',
        toStatus: 'delivered', actor: 'op:test',
      })
    } catch (e) {
      code = (e as TranslationOrderError).code
    }
    expect(code).toBe('ORDER_INVALID_TRANSITION')
  })

  // 6 — two operators can't approve the same version (one wins, one conflicts)
  it('6: two operators on same version → exactly one conflict', async () => {
    const checkout = key('two_op')
    const { order } = await createOrGetOrder({ checkoutSessionId: checkout, legacy: true })
    await transitionOrder({
      orderId: order.id, expectedVersion: 0, expectedStatus: 'queued', toStatus: 'assigned', actor: 'op:a',
    })
    await transitionOrder({
      orderId: order.id, expectedVersion: 1, expectedStatus: 'assigned', toStatus: 'in_review', actor: 'op:a',
    })
    // both operators try in_review -> approved_for_render at version 2
    const both = await Promise.allSettled([
      transitionOrder({ orderId: order.id, expectedVersion: 2, expectedStatus: 'in_review', toStatus: 'approved_for_render', actor: 'op:a' }),
      transitionOrder({ orderId: order.id, expectedVersion: 2, expectedStatus: 'in_review', toStatus: 'approved_for_render', actor: 'op:b' }),
    ])
    const fulfilled = both.filter((r) => r.status === 'fulfilled').length
    const rejected = both.filter((r) => r.status === 'rejected').length
    expect(fulfilled).toBe(1)
    expect(rejected).toBe(1)
  })

  // 7 — artifact immutable under service_role
  it('7: artifact immutable (UPDATE/DELETE rejected)', async () => {
    const { artifactId } = await driveToArtifact(key('immutable_art'))
    const sb = admin()
    const upd = await sb.from('document_artifacts').update({ byte_size: 1 }).eq('id', artifactId)
    expect(upd.error).not.toBeNull()
    const del = await sb.from('document_artifacts').delete().eq('id', artifactId)
    expect(del.error).not.toBeNull()
  })

  // 8 — order_events immutable
  it('8: order_events immutable (UPDATE/DELETE rejected)', async () => {
    const checkout = key('events_immutable')
    const { order } = await createOrGetOrder({ checkoutSessionId: checkout, legacy: true })
    await transitionOrder({
      orderId: order.id, expectedVersion: 0, expectedStatus: 'queued', toStatus: 'assigned', actor: 'op:test',
    })
    const sb = admin()
    const upd = await sb.from('translation_order_events').update({ reason: 'x' }).eq('order_id', order.id)
    expect(upd.error).not.toBeNull()
    const del = await sb.from('translation_order_events').delete().eq('order_id', order.id)
    expect(del.error).not.toBeNull()
  })

  // 9 — create_artifact_and_enqueue commits artifact + transition + outbox atomically
  it('9: createArtifactAndEnqueue commits all three atomically', async () => {
    const checkout = key('atomic_ok')
    const { order, artifactId, outboxId, version } = await driveToArtifactFull(checkout)
    expect(artifactId).toBeTruthy()
    expect(outboxId).toBeTruthy()
    const reread = await getOrderByCheckout(checkout)
    expect(reread?.status).toBe('delivery_pending')
    expect(reread?.version).toBe(version)
    const arts = await listOrderArtifacts(order.id)
    expect(arts.length).toBe(1)
  })

  // 10 — failed artifact txn creates no outbox event (rollback)
  it('10: duplicate idempotency rollback leaves no extra outbox/artifact', async () => {
    const checkout = key('atomic_rollback')
    const { order } = await driveToApproved(checkout)
    const idem = key('idem_shared')
    const sb = admin()
    const first = await createArtifactAndEnqueue({
      orderId: order.id, expectedVersion: 3, actor: 'op:test',
      storageBucket: TRANSLATION_ARTIFACTS_BUCKET, storageKey: `${checkout}/v1.pdf`,
      artifactSha256: 'sha-1', mimeType: 'application/pdf', byteSize: 10, generatedBy: 'op:test',
      idempotencyKey: idem,
    })
    expect(first.artifactId).toBeTruthy()
    const artCountBefore = (await sb.from('document_artifacts').select('id').eq('order_id', order.id)).data?.length ?? 0
    // The order is now delivery_pending, so a second call with expectedVersion 3 / approved_for_render
    // will fail on the state check AND/OR duplicate idempotency — either way nothing new commits.
    let threw = false
    try {
      await createArtifactAndEnqueue({
        orderId: order.id, expectedVersion: 3, actor: 'op:test',
        storageBucket: TRANSLATION_ARTIFACTS_BUCKET, storageKey: `${checkout}/v2.pdf`,
        artifactSha256: 'sha-2', mimeType: 'application/pdf', byteSize: 20, generatedBy: 'op:test',
        idempotencyKey: idem,
      })
    } catch {
      threw = true
    }
    expect(threw).toBe(true)
    const artCountAfter = (await sb.from('document_artifacts').select('id').eq('order_id', order.id)).data?.length ?? 0
    expect(artCountAfter).toBe(artCountBefore) // no orphan artifact
    const outboxCount = (await sb.from('delivery_outbox').select('id').eq('order_id', order.id)).data?.length ?? 0
    expect(outboxCount).toBe(1) // only the first enqueue
  })

  // 11 — duplicate outbox claim rejected (SKIP LOCKED / single claim)
  // The outbox is a GLOBAL queue (claim picks the oldest due row), so other PHASE2_TEST_ rows from
  // earlier tests may be ahead. The invariant under test is exactly-once: no outbox id is ever
  // returned to two workers, and this order's row is claimed exactly once. We drain the queue with
  // many concurrent workers and assert both.
  it('11: each outbox row is claimed by exactly one worker (no double-send)', async () => {
    const checkout = key('claim_once')
    await driveToArtifactFull(checkout)
    const order = await getOrderByCheckout(checkout)

    const allClaimed: string[] = []
    const orderClaims: string[] = []
    // Up to 12 drain rounds of 4 concurrent workers each (bounded). Stop once this order is claimed
    // AND a round yields nothing new.
    for (let round = 0; round < 12; round++) {
      const claims = await Promise.allSettled([
        claimOutboxEvent('worker-A'), claimOutboxEvent('worker-B'),
        claimOutboxEvent('worker-C'), claimOutboxEvent('worker-D'),
      ])
      const got = claims
        .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof claimOutboxEvent>>> => r.status === 'fulfilled')
        .map((r) => r.value)
        .filter((v): v is NonNullable<typeof v> => v !== null)
      for (const c of got) {
        allClaimed.push(c.id)
        if (c.orderId === order!.id) orderClaims.push(c.id)
      }
      if (orderClaims.length >= 1 && got.length === 0) break
      if (got.length === 0 && orderClaims.length >= 1) break
    }
    // Exactly-once: no outbox id claimed twice across all workers/rounds.
    expect(new Set(allClaimed).size).toBe(allClaimed.length)
    // This order's single outbox row was claimed exactly once.
    expect(orderClaims.length).toBe(1)
  })

  // 12 — artifact hash mismatch detectable (store sha, recompute)
  it('12: stored artifact sha256 is the one we computed', async () => {
    const checkout = key('hash_check')
    const payload = Buffer.from('synthetic-pdf-bytes')
    const sha = createHash('sha256').update(payload).digest('hex')
    const { order } = await driveToApproved(checkout)
    const res = await createArtifactAndEnqueue({
      orderId: order.id, expectedVersion: 3, actor: 'op:test',
      storageBucket: TRANSLATION_ARTIFACTS_BUCKET, storageKey: `${checkout}/v1.pdf`,
      artifactSha256: sha, mimeType: 'application/pdf', byteSize: payload.byteLength, generatedBy: 'op:test',
      idempotencyKey: key('idem_hash'),
    })
    const arts = await listOrderArtifacts(order.id)
    const art = arts.find((a) => a.id === res.artifactId)!
    const recomputed = createHash('sha256').update(payload).digest('hex')
    expect(art.artifactSha256).toBe(recomputed)
    // a tampered payload would NOT match the stored sha
    const tampered = createHash('sha256').update(Buffer.from('tampered')).digest('hex')
    expect(art.artifactSha256).not.toBe(tampered)
  })

  // 13 — canonical C3-null survives through resolve
  it('13: canonical finalValue=null survives resolve (no override)', async () => {
    const checkout = key('c3null')
    const { order } = await createOrGetOrder({ checkoutSessionId: checkout, legacy: true })
    const canonicalId = await insertSentinelCanonical(key('c3null_doc'), [
      { key: 'rejected_field', finalValue: null, reviewRequired: true },
      { key: 'ok_field', finalValue: 'present' },
    ])
    await bindCanonicalDocument(order.id, canonicalId)
    const resolved = await resolveOrderCanonical({ canonicalDocumentId: canonicalId })
    const rejected = resolved?.fields.find((f) => f.key === 'rejected_field')
    expect(rejected?.finalValue).toBeNull() // INV-11: null preserved, never resurrected
  })

  // 14 — confirmed operator override changes effective result without mutating base
  it('14: confirmed operator override changes effective value, base unchanged', async () => {
    const checkout = key('op_override')
    const { order } = await createOrGetOrder({ checkoutSessionId: checkout, legacy: true })
    const canonicalId = await insertSentinelCanonical(key('op_override_doc'), [
      { key: 'name', finalValue: null, reviewRequired: true },
    ])
    await bindCanonicalDocument(order.id, canonicalId)
    const before = await resolveOrderCanonical({ canonicalDocumentId: canonicalId })
    expect(before?.fields.find((f) => f.key === 'name')?.finalValue).toBeNull()

    await applyOperatorOverride(
      canonicalId,
      [{ fieldKey: 'name', value: 'Corrected Name', operatorId: 'operator:42', reason: 'read from source' }],
      { expectedVersion: 0 }
    )
    const after = await resolveOrderCanonical({ canonicalDocumentId: canonicalId })
    const nameField = after?.fields.find((f) => f.key === 'name')
    expect(nameField?.finalValue).toBe('Corrected Name') // effective value changed
    expect(nameField?.reviewRequired).toBe(false) // operator confirmed → no review

    // Base canonical row is unchanged: read raw fields_json directly.
    const sb = admin()
    const { data } = await sb.from('canonical_documents').select('fields_json').eq('id', canonicalId).single()
    const baseFields = (data as { fields_json: Array<Record<string, unknown>> }).fields_json
    const baseName = baseFields.find((f) => f.key === 'name')
    expect(baseName?.finalValue).toBeNull() // base still null — override is a separate layer
  })

  // ---- helpers that drive an order through the state machine ----

  async function driveToApproved(checkout: string) {
    const { order } = await createOrGetOrder({ checkoutSessionId: checkout, legacy: true })
    await transitionOrder({ orderId: order.id, expectedVersion: 0, expectedStatus: 'queued', toStatus: 'assigned', actor: 'op:test' })
    await transitionOrder({ orderId: order.id, expectedVersion: 1, expectedStatus: 'assigned', toStatus: 'in_review', actor: 'op:test' })
    await transitionOrder({ orderId: order.id, expectedVersion: 2, expectedStatus: 'in_review', toStatus: 'approved_for_render', actor: 'op:test' })
    return { order }
  }

  async function driveToArtifact(checkout: string) {
    const { order } = await driveToApproved(checkout)
    const res = await createArtifactAndEnqueue({
      orderId: order.id, expectedVersion: 3, actor: 'op:test',
      storageBucket: TRANSLATION_ARTIFACTS_BUCKET, storageKey: `${checkout}/v1.pdf`,
      artifactSha256: 'sha-x', mimeType: 'application/pdf', byteSize: 100, generatedBy: 'op:test',
      idempotencyKey: key('idem'),
    })
    return { orderId: order.id, artifactId: res.artifactId }
  }

  async function driveToArtifactFull(checkout: string) {
    const { order } = await driveToApproved(checkout)
    const res = await createArtifactAndEnqueue({
      orderId: order.id, expectedVersion: 3, actor: 'op:test',
      storageBucket: TRANSLATION_ARTIFACTS_BUCKET, storageKey: `${checkout}/v1.pdf`,
      artifactSha256: 'sha-x', mimeType: 'application/pdf', byteSize: 100, generatedBy: 'op:test',
      idempotencyKey: key('idem'),
    })
    return { order, artifactId: res.artifactId, outboxId: res.outboxId, version: res.version }
  }
})
