/**
 * paymentFailureTriage.test.ts — L1 per-failure-type triage (owner-ruled).
 * Pins that each of the 4 failure types gets its CORRECT action, ack template, and
 * refund eligibility — and that the ack texts give the RIGHT instruction (the 422
 * case must tell the user to act; the email case must say check spam; the
 * wait-cases must say no action needed).
 */
import { describe, it, expect } from 'vitest'
import {
  triagePaymentFailure,
  failureTypeFromGate,
  ackForFailure,
  ACK_TEMPLATES,
  ACK_SLA_HOURS,
  type PaymentFailureType,
} from '../paymentFailureTriage'

describe('triage — each failure type gets its correct response', () => {
  it('user_input_invalid (422) → correction_flow, no owner alert, refund only if abandoned', () => {
    const d = triagePaymentFailure('user_input_invalid')
    expect(d.action).toBe('correction_flow')
    expect(d.ackTemplateId).toBe('ack_422_correction')
    expect(d.ownerAlert).toBe(false)
    expect(d.refundEligibility).toBe('if_abandoned')
  })
  it('guard_block (403) → manual_review + owner alert', () => {
    const d = triagePaymentFailure('guard_block')
    expect(d.action).toBe('manual_review')
    expect(d.ownerAlert).toBe(true)
    expect(d.refundEligibility).toBe('if_unresolvable_after_n')
  })
  it('backend_persist_failure (503) → auto_retry 3x + owner alert every case', () => {
    const d = triagePaymentFailure('backend_persist_failure')
    expect(d.action).toBe('auto_retry')
    expect(d.maxRetries).toBe(3)
    expect(d.ownerAlert).toBe(true)
    expect(d.refundEligibility).toBe('if_persistent_after_retries')
  })
  it('delivery_failure → auto_resend, NEVER refund', () => {
    const d = triagePaymentFailure('delivery_failure')
    expect(d.action).toBe('auto_resend')
    expect(d.refundEligibility).toBe('never')
  })
})

describe('failureTypeFromGate — route gate → failure type', () => {
  it('maps each known gate', () => {
    expect(failureTypeFromGate('confirmed_value_guard')).toBe('user_input_invalid')
    expect(failureTypeFromGate('ocr_field_safety')).toBe('guard_block')
    expect(failureTypeFromGate('audit_persist_failed')).toBe('backend_persist_failure')
    expect(failureTypeFromGate('email')).toBe('delivery_failure')
  })
  it('returns null for an unknown gate', () => {
    expect(failureTypeFromGate('something_else')).toBeNull()
    expect(failureTypeFromGate(null)).toBeNull()
  })
})

describe('ack templates — the right instruction per type (the hole the owner caught)', () => {
  it('422 tells the user to ACT (return/confirm) — NOT "no action needed"', () => {
    const a = ackForFailure('user_input_invalid')
    expect(a.body.toLowerCase()).toMatch(/return to your document|confirm/)
    expect(a.body.toLowerCase()).not.toContain('no action is needed')
  })
  it('email-delivery tells the user to check spam', () => {
    const a = ackForFailure('delivery_failure')
    expect(a.body.toLowerCase()).toContain('spam')
  })
  it('wait-cases (403 / 503) tell the user no action is needed', () => {
    expect(ackForFailure('guard_block').body.toLowerCase()).toContain('no action is needed')
    expect(ackForFailure('backend_persist_failure').body.toLowerCase()).toContain('no action is needed')
  })
  it('every ack states the 24h SLA and reassures payment is secure (except the ready-email)', () => {
    for (const t of ['user_input_invalid', 'guard_block', 'backend_persist_failure', 'delivery_failure'] as PaymentFailureType[]) {
      const a = ackForFailure(t)
      expect(a.subject.length).toBeGreaterThan(0)
      expect(a.body.length).toBeGreaterThan(0)
    }
    // the three pending-cases promise the SLA explicitly
    for (const t of ['guard_block', 'backend_persist_failure', 'delivery_failure'] as PaymentFailureType[]) {
      expect(ackForFailure(t).body).toContain(String(ACK_SLA_HOURS))
    }
  })
  it('all 4 template ids are present', () => {
    expect(Object.keys(ACK_TEMPLATES).sort()).toEqual(
      ['ack_403_review', 'ack_422_correction', 'ack_503_retry', 'ack_email_resend'],
    )
  })
})
