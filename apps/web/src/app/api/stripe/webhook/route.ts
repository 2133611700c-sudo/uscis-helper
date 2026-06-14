/**
 * POST /api/stripe/webhook — the AUTHORITATIVE Stripe webhook for Translation Order V2.
 *
 * ── AUTHORITY (Phase 2 closeout) ─────────────────────────────────────────────────────────────────
 * A signature-verified `checkout.session.completed` for a translation product is the AUTHORITY for
 * creating/updating the V2 order (handleVerifiedPayment, source='webhook'). The client submit-order
 * path is demoted to reconciliation and converges on the SAME order. This handler never trusts the
 * client and never depends on the browser returning from Checkout.
 *
 * ── FAIL CLOSED ──────────────────────────────────────────────────────────────────────────────────
 * Missing/invalid Stripe-Signature OR missing STRIPE_WEBHOOK_SECRET → 400 with ZERO DB writes. The
 * signature is verified by stripe.webhooks.constructEvent against the raw body; we never weaken it,
 * never hardcode the secret, and never expose a test/bypass endpoint in production.
 *
 * ── IDEMPOTENCY ──────────────────────────────────────────────────────────────────────────────────
 * Stripe delivers at-least-once. We dedupe on the Stripe EVENT id via record_stripe_processed_event
 * (insert-or-skip). A duplicate event is a no-op (no second order work). Order uniqueness is also
 * guaranteed independently by translation_orders_v2.checkout_session_id UNIQUE.
 *
 * ── LEGACY COMPAT (decision, load-bearing) ───────────────────────────────────────────────────────
 * The pre-existing legacy `translation_orders` / `wizard_sessions` side-effects are kept as a
 * SEPARATE compatibility step that runs AFTER the authoritative V2 path. A legacy-update failure is
 * logged and swallowed — it MUST NOT roll back a correctly-created V2 order. The legacy update only
 * flips an already-'signed' row by the Stripe-verified email; it is never the binding authority.
 *
 * ── PII ──────────────────────────────────────────────────────────────────────────────────────────
 * Never log the raw payload, email, or name. Events/audit carry only event type, truncated ids,
 * internal uuid, and result codes.
 */
import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import Stripe from 'stripe'
import { stripe } from '@/lib/stripe/client'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { emitEvent, truncateHash, durationBucket } from '@/lib/translation/observability/events'
import { getCanonicalMode } from '@/lib/canonical/continuityMode'
import { handleVerifiedPayment } from '@/lib/translation/orders/handleVerifiedPayment'
import { recordStripeProcessedEvent } from '@/lib/translation/orders'

export const dynamic = 'force-dynamic'

/** A PII-free correlation handle for a Stripe id (truncated hash, never the raw id). */
function idTag(id: string | null | undefined): string | undefined {
  return truncateHash(id ?? undefined)
}

export async function POST(req: NextRequest) {
  if (!stripe) return NextResponse.json({ error: 'Stripe disabled' }, { status: 503 })

  const sig = req.headers.get('stripe-signature')
  const whsec = process.env.STRIPE_WEBHOOK_SECRET
  // Fail closed: no signature OR no secret → 400, ZERO DB writes.
  if (!sig || !whsec) return NextResponse.json({ error: 'Missing signature' }, { status: 400 })

  const body = await req.text()
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, whsec)
  } catch (e) {
    emitEvent('webhook_signature_failure_total', { route: 'stripe-webhook', status_code: 400 })
    console.error('[webhook] signature verification failed:', e instanceof Error ? e.message : e)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // PII-free: only the verified event TYPE — never the raw Stripe payload.
  emitEvent('webhook_received_total', { route: 'stripe-webhook', state: event.type })

  // ── checkout.session.completed → AUTHORITATIVE V2 order create/confirm ──────────────────────────
  if (event.type === 'checkout.session.completed') {
    const cs = event.data.object as Stripe.Checkout.Session

    // Confirm the translation product server-side before doing any V2 work. Non-translation
    // products (tps/reparole) fall through to the legacy compatibility step only.
    const isTranslation = cs.metadata?.service === 'translation'

    if (isTranslation) {
      const startedAt = Date.now()
      // Synchronous, awaited: a 2xx must mean the V2 order was safely handled (or a 5xx so Stripe
      // retries). This is the authority contract — we do NOT defer it to after().
      try {
        // Webhook-processing dedupe on the Stripe EVENT id (primary idempotency key).
        let firstSeen = true
        try {
          const rec = await recordStripeProcessedEvent({
            stripeEventId: event.id,
            eventType: event.type,
            checkoutSessionId: cs.id,
            resultCode: 'received',
          })
          firstSeen = rec.inserted
        } catch {
          // Ledger infra hiccup: do NOT fail the whole webhook on the dedupe write — the
          // order create-or-get is itself idempotent on checkout_session_id, so proceeding is
          // safe. We just lose duplicate suppression for this one delivery.
          firstSeen = true
        }

        if (!firstSeen) {
          emitEvent('webhook_duplicate_total', {
            route: 'stripe-webhook',
            state: event.type,
            truncated_hash: idTag(event.id),
          })
        } else {
          const result = await handleVerifiedPayment({
            verifiedSession: cs,
            verifiedEventId: event.id,
            source: 'webhook',
            canonicalMode: getCanonicalMode('translation'),
          })

          // PII-free observability for the payment→order boundary.
          if (result.amountMismatch) {
            emitEvent('webhook_amount_mismatch_total', {
              route: 'stripe-webhook',
              truncated_hash: idTag(cs.id),
              error_code: result.resultCode,
            })
          }
          if (result.priceMismatch) {
            emitEvent('webhook_price_mismatch_total', {
              route: 'stripe-webhook',
              truncated_hash: idTag(cs.id),
              error_code: result.resultCode,
            })
          }
          if (result.orderId == null) {
            // Verified-paid translation session that produced NO order (e.g. validation reject).
            emitEvent('payment_succeeded_order_missing', {
              route: 'stripe-webhook',
              truncated_hash: idTag(cs.id),
              error_code: result.resultCode,
            })
          } else {
            if (result.created) {
              emitEvent('orders_created_total', {
                product: 'translation',
                route: 'stripe-webhook',
                has_canonical: !!result.canonicalBound,
                internal_uuid: result.orderId,
              })
            }
            emitEvent('payment_to_order_latency', {
              route: 'stripe-webhook',
              duration_bucket: durationBucket(Date.now() - startedAt),
              internal_uuid: result.orderId,
            })
          }
        }
      } catch (e) {
        // A genuine infra failure → 5xx so Stripe retries the at-least-once delivery. No partial
        // state is left because createOrGetOrder is idempotent on checkout_session_id.
        console.error('[webhook] V2 order handling failed:', e instanceof Error ? e.message : e)
        return NextResponse.json({ error: 'order_handling_failed' }, { status: 500 })
      }
    }
  }

  // ── checkout.session.expired → mark pending checkout expired; NEVER a paid transition ────────────
  if (event.type === 'checkout.session.expired') {
    const cs = event.data.object as Stripe.Checkout.Session
    after(async () => {
      try {
        await recordStripeProcessedEvent({
          stripeEventId: event.id,
          eventType: event.type,
          checkoutSessionId: cs.id,
          resultCode: 'expired_noop',
        })
      } catch { /* dedupe ledger best-effort */ }
    })
    // No V2 order is created for an expired checkout (it was never paid). If a record existed it is
    // left as-is (an unpaid order never reaches queued). Nothing to transition.
  }

  // ── payment_intent.payment_failed → recorded; NEVER marks paid / creates order / delivery ───────
  if (event.type === 'payment_intent.payment_failed') {
    const pi = event.data.object as Stripe.PaymentIntent
    console.error('[webhook] payment failed:', pi.id, pi.last_payment_error?.code)
    // No action: user stays on the Stripe page and can retry. No operator/artifact/delivery.
  }

  // ── charge.refunded → review_required ONLY; never delete audit/artifact, never re-send ──────────
  if (event.type === 'charge.refunded') {
    const ch = event.data.object as Stripe.Charge
    after(async () => {
      try {
        await recordStripeProcessedEvent({
          stripeEventId: event.id,
          eventType: event.type,
          checkoutSessionId: (ch.payment_intent as string | null) ?? null,
          resultCode: 'refund_review_required',
        })
      } catch { /* dedupe ledger best-effort */ }
    })
    // Refund business policy (refund→cancel? partial? clawback an artifact?) is NOT yet defined.
    // Per the closeout rules we do NOT guess: we record the event for the operator to review and
    // make NO state-machine change here. A refund must never delete audit rows or immutable
    // artifacts, and must never trigger a re-send. Any cancellation is an operator action through
    // the allowed state machine (transition_translation_order), recorded in the audit ledger.
  }

  // ── Legacy compatibility step (SEPARATE; failure must NOT roll back V2) ──────────────────────────
  // Kept for the legacy operator UI / re-parole wizard. Runs in after(); a failure here is logged
  // and swallowed and CANNOT affect the authoritative V2 order created above.
  if (event.type === 'checkout.session.completed') {
    const cs = event.data.object as Stripe.Checkout.Session
    const service       = cs.metadata?.service ?? ''
    const plan          = cs.metadata?.plan ?? ''
    const wizardId      = cs.metadata?.wizard_session_id ?? ''
    const customerEmail = (cs.customer_details as { email?: string } | null)?.email ?? null
    const supabase = createAdminSupabaseClient()

    after(async () => {
      await supabase.from('audit_log').insert({
        action: 'stripe_payment_succeeded',
        target_table: service === 'translation' ? 'translation_orders' : 'wizard_sessions',
        target_id: wizardId || cs.id,
        detail: {
          stripe_checkout_id: cs.id,
          amount_total: cs.amount_total,
          customer_email: customerEmail,
          service_slug: service,
          plan,
        },
      }).then(({ error }) => {
        if (error) console.error('[webhook] audit_log insert failed:', error.message)
      })

      // Legacy translation_orders status flip (back-compat only; NOT the V2 authority).
      if (service === 'translation' && customerEmail) {
        const { error } = await supabase
          .from('translation_orders')
          .update({ status: 'emailed', stripe_checkout_id: cs.id })
          .eq('email', customerEmail)
          .eq('status', 'signed')
          .order('created_at', { ascending: false })
          .limit(1)
        if (error) console.error('[webhook] translation_orders update failed:', error.message)
      }

      // Re-Parole: update wizard session status (unchanged).
      if (service === 're-parole-u4u' && wizardId) {
        const { error } = await supabase
          .from('wizard_sessions')
          .update({ payment_status: 'paid', stripe_checkout_id: cs.id })
          .eq('id', wizardId)
        if (error) console.error('[webhook] wizard_sessions update failed:', error.message)
      }
    })
  }

  return NextResponse.json({ received: true })
}
