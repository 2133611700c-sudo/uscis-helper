/**
 * handlePaymentFailure.test.ts — L1 orchestration (best-effort, never-throws).
 * Proves per-type routing of side-effects + that a throwing dependency never breaks
 * the handler. Mock deps; synthetic email only.
 */
import { describe, it, expect, vi } from 'vitest'
import { handlePaymentFailure, type PaymentFailureDeps } from '../handlePaymentFailure'

function deps(over: Partial<PaymentFailureDeps> = {}): PaymentFailureDeps {
  return {
    sendAck: vi.fn(async () => true),
    createTicket: vi.fn(async () => true),
    alertOwner: vi.fn(async () => true),
    ...over,
  }
}

describe('per-type side-effect routing', () => {
  it('user_input_invalid (422): ack sent, NO ticket, NO owner alert', async () => {
    const d = deps()
    const out = await handlePaymentFailure(
      { failureType: 'user_input_invalid', sessionId: 's1', userEmail: 'u@example.com', docType: 'ua_birth_certificate' }, d)
    expect(out.ackSent).toBe(true)
    expect(out.ticketCreated).toBe(false)
    expect(out.ownerAlerted).toBe(false)
    expect(d.sendAck).toHaveBeenCalledOnce()
    expect(d.createTicket).not.toHaveBeenCalled()
    // the 422 ack must be the correction message (action required)
    expect((d.sendAck as ReturnType<typeof vi.fn>).mock.calls[0][2].toLowerCase()).toMatch(/return to your document|confirm/)
  })

  it('backend_persist_failure (503): ack + ticket + owner alert', async () => {
    const d = deps()
    const out = await handlePaymentFailure(
      { failureType: 'backend_persist_failure', sessionId: 's2', userEmail: 'u@example.com' }, d)
    expect(out.ackSent).toBe(true)
    expect(out.ticketCreated).toBe(true)
    expect(out.ownerAlerted).toBe(true)
    expect(d.alertOwner).toHaveBeenCalledOnce()
  })

  it('guard_block (403): ack + ticket + owner alert', async () => {
    const d = deps()
    const out = await handlePaymentFailure({ failureType: 'guard_block', sessionId: 's3', userEmail: 'u@example.com' }, d)
    expect(out.ticketCreated).toBe(true)
    expect(out.ownerAlerted).toBe(true)
  })

  it('delivery_failure: ack only, no ticket/owner alert', async () => {
    const d = deps()
    const out = await handlePaymentFailure({ failureType: 'delivery_failure', sessionId: 's4', userEmail: 'u@example.com' }, d)
    expect(out.ackSent).toBe(true)
    expect(out.ticketCreated).toBe(false)
  })
})

describe('PII safety — owner summary + ticket reason carry no values', () => {
  it('ticket reason and owner summary contain only failure_type/doc/session', async () => {
    const createTicket = vi.fn(async (_sessionId: string, _reason: string) => true)
    const alertOwner = vi.fn(async (_summary: string) => true)
    await handlePaymentFailure(
      { failureType: 'backend_persist_failure', sessionId: 's5', userEmail: 'u@example.com', docType: 'ua_birth_certificate' },
      deps({ createTicket, alertOwner }))
    expect(createTicket.mock.calls[0][1]).toBe('paid_request_failed:backend_persist_failure')
    expect(alertOwner.mock.calls[0][0]).toContain('paid_request_failed:backend_persist_failure')
  })
})

describe('best-effort — a throwing dependency never breaks the handler', () => {
  it('resolves even when every dep throws, with false outcome flags', async () => {
    const d = deps({
      sendAck: vi.fn(async () => { throw new Error('resend down') }),
      createTicket: vi.fn(async () => { throw new Error('db down') }),
      alertOwner: vi.fn(async () => { throw new Error('telegram down') }),
    })
    const out = await handlePaymentFailure(
      { failureType: 'backend_persist_failure', sessionId: 's6', userEmail: 'u@example.com' }, d)
    expect(out.ackSent).toBe(false)
    expect(out.ticketCreated).toBe(false)
    expect(out.ownerAlerted).toBe(false)
    expect(out.decision.action).toBe('auto_retry') // triage still returned
  })

  it('no userEmail → ack skipped (not attempted)', async () => {
    const d = deps()
    const out = await handlePaymentFailure({ failureType: 'guard_block', sessionId: 's7', userEmail: null }, d)
    expect(out.ackSent).toBe(false)
    expect(d.sendAck).not.toHaveBeenCalled()
    expect(out.ticketCreated).toBe(true) // owner-alert path still runs
  })
})
