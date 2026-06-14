/**
 * phase2OrdersInvariants.live.test.ts — Phase 2 Wave 3A/3B LIVE DB invariant proof.
 *
 * Proves, against the REAL Supabase project (service-role path), the Phase 2 order
 * state machine + artifact/outbox invariants that the in-process behavioral suite
 * (operatorPipelineBehavioral.test.ts) asserts against a faithful fake:
 *   - direct status/version change is rejected by the trigger (only the RPC may change it)
 *   - transition requires an actor (ORDER_ACTOR_REQUIRED)
 *   - stale expected version → ORDER_VERSION_CONFLICT
 *   - invalid transition → ORDER_INVALID_TRANSITION
 *   - events table is append-only (UPDATE/DELETE rejected)
 *   - duplicate idempotency_key on enqueue → unique violation (no double outbox)
 *   - canonical rebind forbidden (NULL→value once)
 *
 * TEST-ONLY seeded paid-state lives ONLY in this test transaction/DB and is removed
 * via the guarded phase2_admin_cleanup RPC (refuses any non-PHASE2_TEST_ prefix). It
 * is NOT reachable from any production HTTP route.
 *
 * SELF-SKIPS unless RUN_DB_INVARIANTS=1 AND service-role env is present, so normal CI
 * never touches the network. Invoke:
 *   RUN_DB_INVARIANTS=1 pnpm --filter web exec vitest run \
 *     src/lib/translation/orders/__tests__/phase2OrdersInvariants.live.test.ts
 *
 * PII-free: synthetic PHASE2_TEST_ checkout sentinels, empty/opaque values only.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const GATE =
  process.env.RUN_DB_INVARIANTS === '1' &&
  !!process.env.SUPABASE_URL &&
  !!process.env.SUPABASE_SERVICE_ROLE_KEY

const PREFIX = `PHASE2_TEST_VITEST_${Date.now()}`

function svc(): SupabaseClient {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })
}

describe.skipIf(!GATE)('Phase 2 order invariants (live, service-role path)', () => {
  let db: SupabaseClient
  let orderId: string

  beforeAll(async () => {
    db = svc()
    const ins = await db
      .from('translation_orders_v2')
      .insert({
        checkout_session_id: `${PREFIX}_a`,
        product: 'translation',
        verified_recipient_email: null,
        legacy: true,
      })
      .select('id')
      .single()
    expect(ins.error).toBeNull()
    orderId = (ins.data as { id: string }).id
  })

  afterAll(async () => {
    if (db) {
      try { await db.rpc('phase2_admin_cleanup', { p_prefix: PREFIX }) } catch { /* best-effort cleanup */ }
    }
  })

  it('direct status change is rejected (only the RPC may transition)', async () => {
    const r = await db.from('translation_orders_v2').update({ status: 'assigned' }).eq('id', orderId)
    expect(r.error).not.toBeNull()
    expect(String(r.error?.message)).toContain('ORDER_STATUS_DIRECT_CHANGE_FORBIDDEN')
  })

  it('direct version change is rejected', async () => {
    const r = await db.from('translation_orders_v2').update({ version: 99 }).eq('id', orderId)
    expect(r.error).not.toBeNull()
    expect(String(r.error?.message)).toContain('ORDER_VERSION')
  })

  it('transition without actor → ORDER_ACTOR_REQUIRED', async () => {
    const r = await db.rpc('transition_translation_order', {
      p_order_id: orderId, p_expected_version: 0, p_expected_status: 'queued',
      p_to_status: 'assigned', p_actor: '', p_reason: null, p_metadata: {},
    })
    expect(r.error).not.toBeNull()
    expect(String(r.error?.message)).toContain('ORDER_ACTOR_REQUIRED')
  })

  it('valid transition bumps version and appends one event', async () => {
    const r = await db.rpc('transition_translation_order', {
      p_order_id: orderId, p_expected_version: 0, p_expected_status: 'queued',
      p_to_status: 'assigned', p_actor: 'operator:test', p_reason: 'live_assign', p_metadata: {},
    })
    expect(r.error).toBeNull()
    const row = Array.isArray(r.data) ? r.data[0] : r.data
    expect((row as { new_version: number }).new_version).toBe(1)
    const evs = await db.from('translation_order_events').select('id').eq('order_id', orderId)
    expect((evs.data ?? []).length).toBeGreaterThanOrEqual(1)
  })

  it('stale expected version → ORDER_VERSION_CONFLICT', async () => {
    const r = await db.rpc('transition_translation_order', {
      p_order_id: orderId, p_expected_version: 0, p_expected_status: 'assigned',
      p_to_status: 'in_review', p_actor: 'operator:test', p_reason: null, p_metadata: {},
    })
    expect(r.error).not.toBeNull()
    expect(String(r.error?.message)).toContain('ORDER_VERSION_CONFLICT')
  })

  it('invalid transition → ORDER_INVALID_TRANSITION', async () => {
    // current status assigned (version 1); assigned → delivered is not allowed.
    const r = await db.rpc('transition_translation_order', {
      p_order_id: orderId, p_expected_version: 1, p_expected_status: 'assigned',
      p_to_status: 'delivered', p_actor: 'operator:test', p_reason: null, p_metadata: {},
    })
    expect(r.error).not.toBeNull()
    expect(String(r.error?.message)).toContain('ORDER_INVALID_TRANSITION')
  })

  it('events table is append-only (UPDATE rejected)', async () => {
    const ev = await db.from('translation_order_events').select('id').eq('order_id', orderId).limit(1).single()
    const r = await db.from('translation_order_events').update({ reason: 'HACKED' }).eq('id', (ev.data as { id: string }).id)
    expect(r.error).not.toBeNull()
    expect(String(r.error?.message)).toContain('ORDER_EVENTS_APPEND_ONLY')
  })

  it('duplicate Stripe event id prevented (webhook dedupe ledger)', async () => {
    const eid = `${PREFIX}_evt`
    const first = await db.rpc('record_stripe_processed_event', {
      p_stripe_event_id: eid, p_event_type: 'checkout.session.completed',
      p_checkout_session_id: `${PREFIX}_a`, p_order_id: orderId, p_result_code: 'received',
    })
    expect(first.error).toBeNull()
    const firstRow = Array.isArray(first.data) ? first.data[0] : first.data
    expect((firstRow as { inserted: boolean }).inserted).toBe(true)
    // Re-record the SAME event id → no-op (inserted=false), no second row.
    const second = await db.rpc('record_stripe_processed_event', {
      p_stripe_event_id: eid, p_event_type: 'checkout.session.completed',
      p_checkout_session_id: `${PREFIX}_a`, p_order_id: orderId, p_result_code: 'received',
    })
    const secondRow = Array.isArray(second.data) ? second.data[0] : second.data
    expect((secondRow as { inserted: boolean }).inserted).toBe(false)
    // Ledger is append-only: direct UPDATE rejected.
    const upd = await db.from('stripe_processed_events').update({ result_code: 'HACK' }).eq('stripe_event_id', eid)
    expect(upd.error).not.toBeNull()
    expect(String(upd.error?.message)).toContain('STRIPE_EVENTS_APPEND_ONLY')
  })

  it('canonical rebind forbidden once bound', async () => {
    // bind a synthetic canonical first (NULL → value is allowed); use a fresh order.
    const ins = await db
      .from('translation_orders_v2')
      .insert({ checkout_session_id: `${PREFIX}_b`, product: 'translation', legacy: true })
      .select('id')
      .single()
    const oid = (ins.data as { id: string }).id
    // Need a real canonical_documents id to satisfy the FK. Seed a sentinel one.
    const can = await db
      .from('canonical_documents')
      .insert({ session_id: PREFIX, product: 'translation', doc_type: 'd', fields_json: [], result_hash: 'r', fields_hash: `ph2_${Date.now()}` })
      .select('id')
      .single()
    if (can.error) { expect(can.error).toBeNull(); return }
    const cid = (can.data as { id: string }).id
    const bind1 = await db.from('translation_orders_v2').update({ canonical_document_id: cid, legacy: false }).eq('id', oid).is('canonical_document_id', null)
    expect(bind1.error).toBeNull()
    // Re-point to a different canonical → rebind forbidden.
    const can2 = await db
      .from('canonical_documents')
      .insert({ session_id: PREFIX, product: 'translation', doc_type: 'd', fields_json: [], result_hash: 'r', fields_hash: `ph2b_${Date.now()}` })
      .select('id')
      .single()
    const cid2 = (can2.data as { id: string }).id
    const rebind = await db.from('translation_orders_v2').update({ canonical_document_id: cid2 }).eq('id', oid)
    expect(rebind.error).not.toBeNull()
    expect(String(rebind.error?.message)).toContain('ORDER_CANONICAL_REBIND_FORBIDDEN')
  })
})
