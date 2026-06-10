/**
 * paymentFailureRouteAdapter — binds the pure handlePaymentFailure orchestration to the
 * concrete, strictly-typed reuse utilities (Resend sendEmail, createManualReviewTicket,
 * notifyOwnerAlert). Kept OUT of the pure module so handlePaymentFailure stays unit-testable
 * via DI; this is the typed boundary.
 *
 * Behind REFUND_AUTOTICKET_ENABLED (default OFF → no-op, byte-identical prod). Never throws.
 */
import { handlePaymentFailure } from './handlePaymentFailure'
import type { PaymentFailureType } from './paymentFailureTriage'
import { sendEmail } from '@/lib/email/resend'
import { createManualReviewTicket } from '@/lib/translation/manualReview/createManualReviewTicket'
import { notifyOwnerAlert } from '@/lib/translation/manualReview/notifications'

export interface PostPaymentFailureCtx {
  sessionId: string
  /** customer email for the acknowledgment ('' / null ⇒ ack skipped) */
  email: string | null
  /** PII-free document type id */
  docType: string | null
}

const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/**
 * Fire the A-full response for a post-payment failure. OFF (default) ⇒ no-op. Never throws —
 * the caller is already returning an error and must not be made worse.
 */
export async function postPaymentFailure(
  failureType: PaymentFailureType,
  ctx: PostPaymentFailureCtx,
): Promise<void> {
  if (process.env.REFUND_AUTOTICKET_ENABLED !== '1') return
  try {
    await handlePaymentFailure(
      { failureType, sessionId: ctx.sessionId, userEmail: ctx.email || null, docType: ctx.docType },
      {
        sendAck: async (to, subject, body) => {
          const r = await sendEmail({
            to,
            subject,
            html: `<p>${escapeHtml(body)}</p>`,
            text: body,
            type: 'payment_failure_ack',
          })
          return r.ok
        },
        escalateToOwner: async (sessionId, summary) => {
          try {
            const ticket = await createManualReviewTicket({
              sessionId,
              reasons: ['paid_request_failed'],
              detectedDocumentType: ctx.docType,
              safeSummary: summary,
              priority: 'high',
            })
            const alert = await notifyOwnerAlert({
              ticketId: ticket.ticketId,
              sessionId,
              eventType: 'manual_review_queued',
              priority: 'high',
              metadata: { reason: summary },
            })
            return { ticketCreated: true, ownerAlerted: alert.status === 'sent' }
          } catch {
            return { ticketCreated: false, ownerAlerted: false }
          }
        },
      },
    )
  } catch {
    /* never break the request */
  }
}
