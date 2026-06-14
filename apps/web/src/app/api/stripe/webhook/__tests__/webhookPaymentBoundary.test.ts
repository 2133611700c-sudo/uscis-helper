/**
 * webhookPaymentBoundary.test.ts — Phase 2 CLOSEOUT proof that the signature-verified Stripe webhook
 * is the AUTHORITY for Translation Order V2. NO external Stripe, NO real keys, NO prod bypass.
 *
 * The Stripe SDK boundary (stripe.webhooks.constructEvent) is mocked in-process: a "verified event"
 * inside the test is the equivalent of a signed Stripe event whose signature ALREADY passed. Negative
 * cases drive the REAL signature-rejection paths (missing/invalid signature, missing secret) by
 * making the mocked constructEvent throw exactly as the SDK does on a bad signature.
 *
 * The unified domain handler + the processed-events ledger are mocked here so this suite focuses on
 * the WEBHOOK's responsibilities: fail-closed signature, event-id dedupe, authoritative V2 call for
 * translation, lifecycle events (expired/failed/refund), and the legacy compat step being SEPARATE
 * (a legacy failure cannot affect the V2 result). The handler's own behavior is proven against the
 * fake DB in handleVerifiedPayment.test.ts.
 *
 * PII: synthetic sentinel data only; assertions never include raw emails/content.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock the Stripe SDK signature-verification boundary (in test process only) ──
const { constructEventMock } = vi.hoisted(() => ({ constructEventMock: vi.fn() }))
vi.mock('@/lib/stripe/client', () => ({
  stripe: { webhooks: { constructEvent: constructEventMock } },
}))

// ── Mock the unified domain handler + processed-events ledger ───────────────────
const handlerMocks = vi.hoisted(() => ({
  handle: vi.fn(),
  record: vi.fn(),
}))
vi.mock('@/lib/translation/orders/handleVerifiedPayment', () => ({
  handleVerifiedPayment: handlerMocks.handle,
}))
vi.mock('@/lib/translation/orders', () => ({
  recordStripeProcessedEvent: handlerMocks.record,
}))
vi.mock('@/lib/canonical/continuityMode', () => ({
  getCanonicalMode: () => 'shadow',
}))

// ── Capture every LEGACY Supabase write the webhook performs (no live DB) ────────
const dbCalls: { table: string; op: string; payload?: unknown; filters: [string, unknown][] }[] = []
function makeChain(table: string, op: string, payload?: unknown) {
  const filters: [string, unknown][] = []
  const record = { table, op, payload, filters }
  dbCalls.push(record)
  const chain: Record<string, unknown> = {}
  for (const m of ['update', 'eq', 'order', 'limit']) {
    chain[m] = (...args: unknown[]) => {
      if (m === 'eq') filters.push([args[0] as string, args[1]])
      return chain
    }
  }
  ;(chain as { then: unknown }).then = (resolve: (v: { error: null }) => void) => resolve({ error: null })
  return chain
}
const afterCallbacks: (() => Promise<void> | void)[] = []
vi.mock('next/server', async (orig) => {
  const actual = await (orig() as Promise<Record<string, unknown>>)
  return { ...actual, after: (cb: () => Promise<void> | void) => { afterCallbacks.push(cb) } }
})
async function flushAfter() { while (afterCallbacks.length) await afterCallbacks.shift()!() }

vi.mock('@/lib/supabase/admin', () => ({
  createAdminSupabaseClient: () => ({
    from: (table: string) => ({
      insert: (payload: unknown) => makeChain(table, 'insert', payload),
      update: (payload: unknown) => makeChain(table, 'update', payload),
    }),
  }),
}))

import { POST } from '../route'

function req(body: string, sig: string | null): Request {
  const headers = new Headers()
  if (sig !== null) headers.set('stripe-signature', sig)
  return new Request('https://test.local/api/stripe/webhook', { method: 'POST', body, headers })
}

const ORIG_ENV = { ...process.env }
beforeEach(() => {
  constructEventMock.mockReset()
  handlerMocks.handle.mockReset().mockResolvedValue({
    orderId: 'order-uuid', created: true, reused: false, status: 'queued', resultCode: 'order_created', canonicalBound: false,
  })
  handlerMocks.record.mockReset().mockResolvedValue({ inserted: true })
  dbCalls.length = 0
  afterCallbacks.length = 0
  process.env = { ...ORIG_ENV, STRIPE_WEBHOOK_SECRET: 'whsec_TEST_SENTINEL' }
})

function translationEvent(over: Record<string, unknown> = {}) {
  return {
    id: 'evt_PHASE2_TEST_1',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_test_PHASE2',
        amount_total: 1499,
        currency: 'usd',
        livemode: false,
        metadata: { service: 'translation', plan: 'basic', wizard_session_id: 'PHASE2_TEST_w1' },
        customer_details: { email: 'sentinel@phase2.test' },
        ...over,
      },
    },
  }
}

describe('webhook authority — signature fail-closed (zero DB writes)', () => {
  it('missing signature header → 400, never constructEvent, no handler, no DB', async () => {
    const res = await POST(req('{}', null) as never)
    expect(res.status).toBe(400)
    expect(constructEventMock).not.toHaveBeenCalled()
    expect(handlerMocks.handle).not.toHaveBeenCalled()
    expect(dbCalls).toHaveLength(0)
  })

  it('missing webhook secret → 400 (fail closed)', async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET
    const res = await POST(req('{}', 't=1,v1=abc') as never)
    expect(res.status).toBe(400)
    expect(constructEventMock).not.toHaveBeenCalled()
    expect(handlerMocks.handle).not.toHaveBeenCalled()
  })

  it('invalid signature (SDK throws) → 400, no handler, no DB writes', async () => {
    constructEventMock.mockImplementation(() => { throw new Error('No signatures found') })
    const res = await POST(req('{"x":1}', 't=1,v1=bad') as never)
    expect(res.status).toBe(400)
    expect(handlerMocks.handle).not.toHaveBeenCalled()
    expect(dbCalls).toHaveLength(0)
  })
})

describe('webhook authority — translation V2 (authoritative, synchronous)', () => {
  it('verified checkout.session.completed (translation) → handleVerifiedPayment(source=webhook)', async () => {
    constructEventMock.mockReturnValue(translationEvent())
    const res = await POST(req('{}', 't=1,v1=ok') as never)
    expect(res.status).toBe(200)
    expect(handlerMocks.handle).toHaveBeenCalledTimes(1)
    const arg = handlerMocks.handle.mock.calls[0][0]
    expect(arg.source).toBe('webhook')
    expect(arg.verifiedEventId).toBe('evt_PHASE2_TEST_1')
    // Recipient/product/amount are the handler's job — the webhook passes the verified session.
    expect(arg.verifiedSession.id).toBe('cs_test_PHASE2')
  })

  it('dedupe: a duplicate Stripe event id is a no-op (handler NOT called again)', async () => {
    constructEventMock.mockReturnValue(translationEvent())
    handlerMocks.record.mockResolvedValueOnce({ inserted: false }) // already processed
    const res = await POST(req('{}', 't=1,v1=ok') as never)
    expect(res.status).toBe(200)
    expect(handlerMocks.handle).not.toHaveBeenCalled()
  })

  it('handler infra failure → 500 (Stripe retries), no partial trust', async () => {
    constructEventMock.mockReturnValue(translationEvent())
    handlerMocks.handle.mockRejectedValueOnce(new Error('storage down'))
    const res = await POST(req('{}', 't=1,v1=ok') as never)
    expect(res.status).toBe(500)
  })

  it('non-translation product → V2 handler NOT called (legacy compat only)', async () => {
    constructEventMock.mockReturnValue(translationEvent({ metadata: { service: 'tps-ukraine' } }))
    const res = await POST(req('{}', 't=1,v1=ok') as never)
    expect(res.status).toBe(200)
    expect(handlerMocks.handle).not.toHaveBeenCalled()
  })
})

describe('webhook authority — legacy compat is SEPARATE (cannot roll back V2)', () => {
  it('legacy translation_orders update runs in after(); V2 already returned 200', async () => {
    constructEventMock.mockReturnValue(translationEvent())
    const res = await POST(req('{}', 't=1,v1=ok') as never)
    expect(res.status).toBe(200)
    // V2 handler ran synchronously before the response; legacy is deferred.
    expect(handlerMocks.handle).toHaveBeenCalledTimes(1)
    await flushAfter()
    const audit = dbCalls.filter((c) => c.table === 'audit_log' && c.op === 'insert')
    expect(audit).toHaveLength(1)
    const orderUpd = dbCalls.filter((c) => c.table === 'translation_orders' && c.op === 'update')
    expect(orderUpd).toHaveLength(1)
    // Legacy flips only an already-'signed' row matched by Stripe-verified email.
    expect(orderUpd[0].filters.find((f) => f[0] === 'status')?.[1]).toBe('signed')
    expect((orderUpd[0].payload as { status?: string }).status).toBe('emailed')
  })
})

describe('webhook authority — lifecycle events', () => {
  it('checkout.session.expired → no paid transition, no V2 order, recorded only', async () => {
    constructEventMock.mockReturnValue({
      id: 'evt_exp', type: 'checkout.session.expired',
      data: { object: { id: 'cs_exp', metadata: { service: 'translation' } } },
    })
    const res = await POST(req('{}', 't=1,v1=ok') as never)
    expect(res.status).toBe(200)
    expect(handlerMocks.handle).not.toHaveBeenCalled()
    await flushAfter()
    expect(handlerMocks.record).toHaveBeenCalledWith(expect.objectContaining({ resultCode: 'expired_noop' }))
  })

  it('payment_intent.payment_failed → never paid, no order, no delivery', async () => {
    constructEventMock.mockReturnValue({
      id: 'evt_fail', type: 'payment_intent.payment_failed',
      data: { object: { id: 'pi_x', last_payment_error: { code: 'card_declined' } } },
    })
    const res = await POST(req('{}', 't=1,v1=ok') as never)
    expect(res.status).toBe(200)
    expect(handlerMocks.handle).not.toHaveBeenCalled()
  })

  it('charge.refunded → review_required only; no order create, no delivery, no audit delete', async () => {
    constructEventMock.mockReturnValue({
      id: 'evt_refund', type: 'charge.refunded',
      data: { object: { id: 'ch_x', payment_intent: 'pi_x' } },
    })
    const res = await POST(req('{}', 't=1,v1=ok') as never)
    expect(res.status).toBe(200)
    expect(handlerMocks.handle).not.toHaveBeenCalled()
    await flushAfter()
    expect(handlerMocks.record).toHaveBeenCalledWith(expect.objectContaining({ resultCode: 'refund_review_required' }))
  })
})
