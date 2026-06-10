/**
 * handlePaymentFailure — L1 orchestration for a post-payment failure (owner-ruled
 * A-full). Given a failure type + context it: (1) sends the correct per-type customer
 * acknowledgment, (2) on owner-alert cases creates a manual-review ticket and alerts
 * the owner. ALL side-effects are best-effort and NEVER throw — the route is already
 * returning an error and the handler must not make the request worse.
 *
 * Dependency-injected: the concrete sendEmail / createManualReviewTicket /
 * notifyOwnerAlert (each with its own typed enums) are passed in by the route at the
 * call site, keeping this orchestration pure + unit-testable without those integrations.
 * The handler does NOT move money — refund stays manual (owner via Stripe), applied only
 * to cases classified irrecoverable/user-requested per ADR / REFUND_POLICY.
 */
import {
  triagePaymentFailure,
  ackForFailure,
  type PaymentFailureType,
  type TriageDecision,
} from './paymentFailureTriage'

export interface PaymentFailureDeps {
  /** send the customer acknowledgment email; resolve true on success. Must not throw. */
  sendAck: (to: string, subject: string, body: string) => Promise<boolean>
  /** create/append a manual-review ticket (PII-free reason). resolve true on success. */
  createTicket: (sessionId: string, reasonSummary: string) => Promise<boolean>
  /** alert the owner (Telegram/email) with a PII-free summary. resolve true on success. */
  alertOwner: (summary: string) => Promise<boolean>
}

export interface PaymentFailureContext {
  failureType: PaymentFailureType
  sessionId: string
  /** the customer's email for the acknowledgment; null ⇒ ack skipped */
  userEmail: string | null
  /** PII-free document type id (for the owner summary) */
  docType?: string | null
}

export interface PaymentFailureOutcome {
  decision: TriageDecision
  ackSent: boolean
  ticketCreated: boolean
  ownerAlerted: boolean
}

async function safe(p: () => Promise<boolean>): Promise<boolean> {
  try {
    return await p()
  } catch {
    return false // a side-effect failure must never break the handler
  }
}

/**
 * Orchestrate the response to a post-payment failure. Never throws. Returns what was done.
 * PII rule: the ticket reason + owner summary carry failure_type + session + doc_type only —
 * never names/values. The ack email goes to the customer's own address (transactional).
 */
export async function handlePaymentFailure(
  ctx: PaymentFailureContext,
  deps: PaymentFailureDeps,
): Promise<PaymentFailureOutcome> {
  const decision = triagePaymentFailure(ctx.failureType)

  // (3) customer-facing acknowledgment — the correct per-type message.
  let ackSent = false
  if (ctx.userEmail) {
    const ack = ackForFailure(ctx.failureType)
    ackSent = await safe(() => deps.sendAck(ctx.userEmail as string, ack.subject, ack.body))
  }

  // (1)+(2) owner-alert cases get a ticket + an owner alert (PII-free).
  let ticketCreated = false
  let ownerAlerted = false
  if (decision.ownerAlert) {
    const summary = `paid_request_failed:${ctx.failureType} doc=${ctx.docType ?? 'unknown'} session=${ctx.sessionId}`
    ticketCreated = await safe(() => deps.createTicket(ctx.sessionId, `paid_request_failed:${ctx.failureType}`))
    ownerAlerted = await safe(() => deps.alertOwner(summary))
  }

  return { decision, ackSent, ticketCreated, ownerAlerted }
}
