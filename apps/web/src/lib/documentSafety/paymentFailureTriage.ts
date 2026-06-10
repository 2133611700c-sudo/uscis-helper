/**
 * paymentFailureTriage — L1 operations core (owner-ruled A-full + per-failure-type
 * triage, 2026-06-10). A post-payment failure is NOT a blanket refund: each of the 4
 * failure types gets its correct response + its own customer acknowledgment, because
 * a single "refund / no action needed" message over-refunds the user-input case and
 * misleads the email-delivery case.
 *
 * PURE + ADDITIVE: this module only classifies and selects text. Wiring it into the
 * generate-pdf failure points (auto-ticket + ack email + owner alert, behind a flag)
 * is a separate step. See docs/NEXT_SESSION_L1_KICKOFF.md.
 */

/** The single key that drives BOTH the triage and the ack routing (turnkey first step). */
export type PaymentFailureType =
  | 'user_input_invalid' // confirmed_value_guard 422 — a critical field value is invalid
  | 'guard_block' // ocr_field_safety 403 — an unresolved critical field blocks output
  | 'backend_persist_failure' // persistCertification 503 — infra/DB failure after charge
  | 'delivery_failure' // the result email failed to send (silent 200)

export type TriageAction =
  | 'correction_flow' // user returns to D5 to fix the field
  | 'manual_review' // owner reviews the case
  | 'auto_retry' // system retries automatically
  | 'auto_resend' // resend the email

export type RefundEligibility =
  | 'if_abandoned' // refund only if the user does not return to finish
  | 'if_unresolvable_after_n' // refund only if review cannot resolve it
  | 'if_persistent_after_retries' // refund only if retries keep failing
  | 'never' // delivery failure → resend, never refund

export type AckTemplateId =
  | 'ack_422_correction'
  | 'ack_403_review'
  | 'ack_503_retry'
  | 'ack_email_resend'

export interface TriageDecision {
  failureType: PaymentFailureType
  action: TriageAction
  ackTemplateId: AckTemplateId
  /** alert the owner immediately? (true for guard/infra cases; false for pure user-input/delivery) */
  ownerAlert: boolean
  refundEligibility: RefundEligibility
  /** retries for auto_retry; 0 otherwise */
  maxRetries: number
}

/** Customer-facing SLA (owner-confirmed 2026-06-10). Used in every ack body. */
export const ACK_SLA_HOURS = 24

const TRIAGE: Record<PaymentFailureType, TriageDecision> = {
  user_input_invalid: {
    failureType: 'user_input_invalid',
    action: 'correction_flow',
    ackTemplateId: 'ack_422_correction',
    ownerAlert: false, // the user fixes it; not an owner action
    refundEligibility: 'if_abandoned',
    maxRetries: 0,
  },
  guard_block: {
    failureType: 'guard_block',
    action: 'manual_review',
    ackTemplateId: 'ack_403_review',
    ownerAlert: true,
    refundEligibility: 'if_unresolvable_after_n',
    maxRetries: 0,
  },
  backend_persist_failure: {
    failureType: 'backend_persist_failure',
    action: 'auto_retry',
    ackTemplateId: 'ack_503_retry',
    ownerAlert: true, // every case — this is an infra bug to investigate
    refundEligibility: 'if_persistent_after_retries',
    maxRetries: 3,
  },
  delivery_failure: {
    failureType: 'delivery_failure',
    action: 'auto_resend',
    ackTemplateId: 'ack_email_resend',
    ownerAlert: false,
    refundEligibility: 'never',
    maxRetries: 1,
  },
}

/** The triage decision for a failure type. */
export function triagePaymentFailure(t: PaymentFailureType): TriageDecision {
  return TRIAGE[t]
}

/** Map a route gate identifier → failure type. Returns null for an unknown gate. */
export function failureTypeFromGate(gate: string | null | undefined): PaymentFailureType | null {
  switch ((gate ?? '').toLowerCase()) {
    case 'confirmed_value_guard':
      return 'user_input_invalid'
    case 'ocr_field_safety':
      return 'guard_block'
    case 'persistcertification':
    case 'audit_persist_failed':
      return 'backend_persist_failure'
    case 'email':
    case 'email_delivery':
      return 'delivery_failure'
    default:
      return null
  }
}

// ── Customer acknowledgment templates (client-facing English; owner-ruled per type) ──
// SLA = 24h appears in every body. The 422 message REQUIRES an action (return to D5) —
// telling that user "no action needed" would strand the ticket as abandoned.
export const ACK_TEMPLATES: Record<AckTemplateId, { subject: string; body: string }> = {
  ack_422_correction: {
    subject: 'One quick step to finish your translation',
    body:
      "We've received your payment — thank you. We need one small clarification before we " +
      'finalize your document: please return to your document and confirm the highlighted ' +
      'field. It takes under a minute, and your payment is secure. Once you confirm, your ' +
      'translation completes automatically.',
  },
  ack_403_review: {
    subject: 'Your translation is being reviewed',
    body:
      "We've received your payment — thank you. Your document needs a brief manual review by " +
      'our team to ensure accuracy. No action is needed from you; most cases are completed ' +
      `within a few hours, and we'll respond within ${ACK_SLA_HOURS} hours at the latest. ` +
      'Your payment is secure.',
  },
  ack_503_retry: {
    subject: 'Finalizing your translation',
    body:
      "We've received your payment — thank you. We hit a temporary technical issue while " +
      'finalizing your document. The system is retrying automatically; no action is needed. ' +
      `If it isn't resolved shortly our team will step in — we'll respond within ${ACK_SLA_HOURS} ` +
      'hours at the latest. Your payment is secure.',
  },
  ack_email_resend: {
    subject: 'Your translation is ready',
    body:
      'Your translation is ready and your payment is complete — thank you. We\'ve emailed your ' +
      'document; please also check your spam/junk folder. If you don\'t see it within ' +
      `${ACK_SLA_HOURS} hours, we'll resend it automatically — no action is needed.`,
  },
}

/** The acknowledgment (subject + body) to send for a given failure type. */
export function ackForFailure(t: PaymentFailureType): { subject: string; body: string } {
  return ACK_TEMPLATES[triagePaymentFailure(t).ackTemplateId]
}
