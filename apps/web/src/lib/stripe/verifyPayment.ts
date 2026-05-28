/**
 * verifyPayment — single source of truth for "is this Stripe checkout session
 * paid for the expected service?". Used by every paid endpoint (translation
 * generate-pdf + render, TPS, ReParole) so paywall logic can never drift.
 *
 * Returns a structured result so callers can log/diagnose; never throws.
 * If Stripe is not configured (no STRIPE_SECRET_KEY), returns paid:false with
 * reason 'stripe_not_configured' — endpoints decide whether to allow a degraded
 * path (TPS pattern is to fall through; this util surfaces the state).
 */

import { stripe } from './client'

export type VerifyReason =
  | 'stripe_not_configured'
  | 'invalid_session_id_format'
  | 'not_paid'
  | 'wrong_service'
  | 'stripe_api_error'

export interface VerifyResult {
  /** Stripe session retrieved AND payment_status === 'paid'. */
  paid: boolean
  /** If expectedService was provided, whether session metadata.service matches. */
  correctService: boolean
  /** Machine-readable reason when paid=false or correctService=false. */
  reason?: VerifyReason
}

const VALID_PREFIX = /^(cs_|py_)/ // Stripe checkout (cs_) and PaymentIntent (py_) test/live ids

/**
 * Verify that a Stripe checkout session is paid and (optionally) for the
 * expected service. Owner-bypass is the CALLER's responsibility — this util
 * only knows Stripe.
 */
export async function verifyStripeSessionPaid(
  checkoutId: string,
  opts: { expectedService?: string } = {},
): Promise<VerifyResult> {
  if (!stripe) {
    return { paid: false, correctService: false, reason: 'stripe_not_configured' }
  }
  if (!checkoutId || !VALID_PREFIX.test(checkoutId)) {
    return { paid: false, correctService: false, reason: 'invalid_session_id_format' }
  }
  try {
    const session = await stripe.checkout.sessions.retrieve(checkoutId, {
      expand: ['payment_intent'],
    })
    const paid = session.payment_status === 'paid'
    const correctService = opts.expectedService
      ? session.metadata?.service === opts.expectedService
      : true
    if (!paid) return { paid: false, correctService, reason: 'not_paid' }
    if (!correctService) return { paid: true, correctService: false, reason: 'wrong_service' }
    return { paid: true, correctService: true }
  } catch {
    return { paid: false, correctService: false, reason: 'stripe_api_error' }
  }
}
