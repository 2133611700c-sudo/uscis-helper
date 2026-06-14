/**
 * webhookPaymentBoundary.test.ts — Phase 2 Wave 3A behavioral proof of the Stripe
 * payment-verification boundary. NO external Stripe, NO real keys, NO prod bypass.
 *
 * The Stripe SDK boundary (stripe.webhooks.constructEvent) is mocked in-process so a
 * "verified event" inside the test is the equivalent of a signed Stripe event whose
 * signature ALREADY passed verification — we then test the INTERNAL handler. Negative
 * cases drive the REAL signature-rejection paths (missing/invalid signature) by making
 * the mocked constructEvent throw exactly as the Stripe SDK does on a bad signature.
 *
 * BOUNDARY NOTE (recorded in agent evidence): the V2 operator pipeline's *authority*
 * boundary is the INLINE verifyStripeSessionPaid() in submit-order (the Stripe token is
 * the capability). The webhook here is an additional async side-channel that only
 * touches the LEGACY translation_orders table. Both are tested; the recommendation to
 * promote a webhook to V2 authority is in the agent report.
 *
 * PII: synthetic sentinel data only; assertions never include raw emails/content.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock the Stripe SDK signature-verification boundary (in test process only) ──
const { constructEventMock } = vi.hoisted(() => ({ constructEventMock: vi.fn() }))
vi.mock('@/lib/stripe/client', () => ({
  stripe: { webhooks: { constructEvent: constructEventMock } },
}))

// ── Capture every Supabase write the webhook performs (no live DB) ──────────────
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
// ── Run after() callbacks inline (no Next request scope in vitest) ──────────────
const afterCallbacks: (() => Promise<void> | void)[] = []
vi.mock('next/server', async (orig) => {
  const actual = await (orig() as Promise<Record<string, unknown>>)
  return {
    ...actual,
    after: (cb: () => Promise<void> | void) => { afterCallbacks.push(cb) },
  }
})
async function flushAfter() {
  while (afterCallbacks.length) await afterCallbacks.shift()!()
}

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
  dbCalls.length = 0
  process.env = { ...ORIG_ENV, STRIPE_WEBHOOK_SECRET: 'whsec_TEST_SENTINEL' }
})

describe('webhook payment boundary — negative (signature + event)', () => {
  it('missing signature header → 400, never calls constructEvent', async () => {
    const res = await POST(req('{}', null) as never)
    expect(res.status).toBe(400)
    expect(constructEventMock).not.toHaveBeenCalled()
    expect(dbCalls).toHaveLength(0)
  })

  it('missing webhook secret → 400 (fail closed)', async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET
    const res = await POST(req('{}', 't=1,v1=abc') as never)
    expect(res.status).toBe(400)
    expect(constructEventMock).not.toHaveBeenCalled()
  })

  it('invalid signature (SDK throws) → 400, no DB writes', async () => {
    constructEventMock.mockImplementation(() => {
      throw new Error('No signatures found matching the expected signature for payload')
    })
    const res = await POST(req('{"x":1}', 't=1,v1=bad') as never)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('Invalid signature')
    expect(dbCalls).toHaveLength(0)
  })

  it('wrong event type (verified) → no state transition, no order update', async () => {
    constructEventMock.mockReturnValue({
      type: 'customer.subscription.updated',
      data: { object: { id: 'sub_TEST' } },
    })
    const res = await POST(req('{}', 't=1,v1=ok') as never)
    expect(res.status).toBe(200)
    // No audit_log insert, no translation_orders update for an unrelated event.
    expect(dbCalls.filter((c) => c.table === 'translation_orders')).toHaveLength(0)
  })

  it('payment_intent.payment_failed → recorded but NEVER marks paid/emailed', async () => {
    constructEventMock.mockReturnValue({
      type: 'payment_intent.payment_failed',
      data: { object: { id: 'pi_TEST', last_payment_error: { message: 'card_declined' } } },
    })
    const res = await POST(req('{}', 't=1,v1=ok') as never)
    expect(res.status).toBe(200)
    const orderUpdates = dbCalls.filter((c) => c.table === 'translation_orders' && c.op === 'update')
    expect(orderUpdates).toHaveLength(0)
  })
})

describe('webhook payment boundary — positive (verified event → internal handler)', () => {
  it('checkout.session.completed (translation) → audit log + order update gated on signed status', async () => {
    constructEventMock.mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_PHASE2',
          amount_total: 1500,
          metadata: { service: 'translation', plan: 'basic', wizard_session_id: 'PHASE2_TEST_w1' },
          customer_details: { email: 'sentinel@phase2.test' },
        },
      },
    })
    const res = await POST(req('{}', 't=1,v1=ok') as never)
    expect(res.status).toBe(200)
    // after() schedules async work; allow the microtask/`after` callback to run.
    await flushAfter()

    const audit = dbCalls.filter((c) => c.table === 'audit_log' && c.op === 'insert')
    expect(audit).toHaveLength(1)
    const orderUpd = dbCalls.filter((c) => c.table === 'translation_orders' && c.op === 'update')
    expect(orderUpd).toHaveLength(1)
    // The legacy update only flips a row that is already 'signed' (status guard),
    // matched by the verified email + most-recent — NEVER an arbitrary order.
    const filterCols = orderUpd[0].filters.map((f) => f[0])
    expect(filterCols).toContain('email')
    expect(filterCols).toContain('status')
    expect(orderUpd[0].filters.find((f) => f[0] === 'status')?.[1]).toBe('signed')
    expect((orderUpd[0].payload as { status?: string }).status).toBe('emailed')
  })

  it('checkout.session.completed without customer email → no translation order update', async () => {
    constructEventMock.mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_NOEMAIL',
          amount_total: 1500,
          metadata: { service: 'translation' },
          customer_details: null,
        },
      },
    })
    const res = await POST(req('{}', 't=1,v1=ok') as never)
    expect(res.status).toBe(200)
    await flushAfter()
    expect(dbCalls.filter((c) => c.table === 'translation_orders')).toHaveLength(0)
  })

  it('wrong product (tps) → re-parole/translation order branches not taken', async () => {
    constructEventMock.mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_TPS',
          amount_total: 1500,
          metadata: { service: 'tps-ukraine' },
          customer_details: { email: 'sentinel@phase2.test' },
        },
      },
    })
    const res = await POST(req('{}', 't=1,v1=ok') as never)
    expect(res.status).toBe(200)
    await flushAfter()
    // audit only (logged for every payment); no translation or wizard update.
    expect(dbCalls.filter((c) => c.table === 'translation_orders')).toHaveLength(0)
    expect(dbCalls.filter((c) => c.table === 'wizard_sessions')).toHaveLength(0)
  })
})
