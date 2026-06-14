/**
 * POST /api/translation/submit-order — operator-flow entry.
 *
 * Phase 2 (Translation Operator Pipeline V2) contract. The paid order is bound
 * to its canonical document and enqueued for operator review. The customer sees
 * /order/{id} and waits; the operator reviews/edits via /admin/manual-review and
 * the finished PDF is rendered from the resolved canonical + emailed.
 *
 * ── AUTHORITY ────────────────────────────────────────────────────────────────
 * Client field VALUES are NOT authoritative. The server binds only the
 * canonical_document_id (an opaque reference it independently re-verifies) and
 * the recipient email taken EXCLUSIVELY from the verified Stripe session.
 *
 * ── ROLLOUT ──────────────────────────────────────────────────────────────────
 * The V2 order row + canonical binding is ADDITIVE. getCanonicalMode('translation')
 * gates V2 persistence: 'off' → legacy only; 'shadow'/'enforce' → V2 order is
 * persisted alongside the legacy manual_review_queue row. The legacy path is
 * never removed. In 'enforce' a canonical_document_id is REQUIRED.
 *
 * ── STATUS CONTRACT ──────────────────────────────────────────────────────────
 *   422 malformed / missing required field
 *   402 unpaid / wrong-service Stripe session
 *   403 wrong session ownership OR wrong product on the canonical
 *   404 canonical_document_id supplied but not found
 *   409 conflicting canonical binding (hash mismatch / rebind)
 *   503 real infra only (queue / storage unavailable)
 *
 * PII: never log field values or raw emails — only keys, counts, ids.
 */
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, getClientIP } from '@/lib/security/rate-limit'
import { verifyStripeSessionPaid } from '@/lib/stripe/verifyPayment'
import { createManualReviewTicket, writeManualReviewEvent } from '@/lib/translation/manualReview/createManualReviewTicket'
import { notifyOperator } from '@/lib/translation/manualReview/notifications'
import { sendEmail } from '@/lib/email/resend'
import { orderReceivedEmail } from '@/lib/email/operatorFlowTemplates'
import { getCanonicalMode } from '@/lib/canonical/continuityMode'
import {
  loadCanonicalDocumentById,
  verifyCanonicalHash,
} from '@/lib/canonical/persistence'
import {
  createOrGetOrder,
  bindCanonicalDocument,
  getOrderById,
  transitionOrder,
  TranslationOrderError,
} from '@/lib/translation/orders'
import { emitEvent } from '@/lib/translation/observability/events'

export const dynamic = 'force-dynamic'

interface SubmitOrderBody {
  checkout_id?: string
  canonical_document_id?: string
  doc_type?: string
  locale?: string
  notes?: string
  /** Legacy/back-compat working copy; VALUES are NOT authoritative (ignored for binding). */
  fields?: Array<{ field: string; value: string | null; raw_cyrillic?: string | null; review_required?: boolean }>
}

function err(error: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, error, ...extra }, { status })
}

export async function POST(req: NextRequest) {
  const ip = getClientIP(req)
  const rl = await rateLimit(`submit-order:${ip}`, 10, 60_000)
  if (!rl.allowed) {
    return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 })
  }

  let body: SubmitOrderBody
  try {
    body = await req.json()
  } catch {
    return err('invalid_json', 422)
  }
  const checkoutId = body.checkout_id ?? ''
  if (!checkoutId) {
    return err('missing_checkout_id', 422)
  }

  const docType = body.doc_type || 'other'
  const locale = ['ru', 'uk', 'es', 'en'].includes(body.locale ?? '') ? (body.locale as string) : 'en'
  const canonicalId = (body.canonical_document_id ?? '').trim() || null

  // ── 1. Payment gate — the Stripe token is the capability. ────────────────────
  const v = await verifyStripeSessionPaid(checkoutId, { expectedService: 'translation' })
  if (!v.paid) {
    return err('payment_not_confirmed', 402, { reason: v.reason })
  }
  if (!v.correctService) {
    // Paid, but for the wrong product → forbidden, not a payment error.
    return err('wrong_product', 403, { reason: v.reason })
  }

  const mode = getCanonicalMode('translation')

  // enforce: a canonical binding is mandatory (no legacy-only orders).
  if (mode === 'enforce' && !canonicalId) {
    return err('canonical_document_id_required', 422)
  }

  // ── 2. Canonical verification (only when supplied + mode !== off) ────────────
  // The client may only reference a canonical id; the server re-verifies it.
  let verifiedCanonicalId: string | null = null
  if (canonicalId && mode !== 'off') {
    let canonical
    try {
      canonical = await loadCanonicalDocumentById(canonicalId)
    } catch {
      return err('canonical_storage_unavailable', 503)
    }
    if (!canonical) {
      return err('canonical_not_found', 404)
    }
    // Product binding: the canonical must be a translation canonical.
    if (canonical.product !== 'translation') {
      return err('canonical_wrong_product', 403)
    }
    // Session ownership: the canonical must belong to THIS checkout session.
    // documentSessionId is the upload/session reference; it must match the paid
    // checkout token (which the wizard reuses as the session key).
    if (
      canonical.documentSessionId &&
      canonical.documentSessionId !== checkoutId
    ) {
      return err('canonical_session_mismatch', 403)
    }
    // Integrity: stored fields_hash must still verify (tamper / drift → 409).
    let hashCheck
    try {
      hashCheck = await verifyCanonicalHash(canonicalId)
    } catch {
      return err('canonical_storage_unavailable', 503)
    }
    if (hashCheck.notFound) {
      return err('canonical_not_found', 404)
    }
    if (!hashCheck.valid) {
      return err('canonical_hash_mismatch', 409)
    }
    verifiedCanonicalId = canonicalId
  }

  // ── 3. Create-or-return the V2 order (idempotent on checkout_session_id) ──────
  // Only when V2 is active (mode !== off). Bind canonical + Stripe-verified email.
  let orderId: string | null = null
  let orderReused = false
  if (mode !== 'off') {
    try {
      const { order, created } = await createOrGetOrder({
        checkoutSessionId: checkoutId,
        verifiedRecipientEmail: v.customerEmail ?? null,
        canonicalDocumentId: verifiedCanonicalId,
        documentType: docType,
        sourceLanguage: 'uk',
        locale,
        legacy: verifiedCanonicalId == null,
      })
      orderId = order.id
      orderReused = !created
      if (created) {
        emitEvent('orders_created_total', {
          product: 'translation',
          route: 'submit-order',
          mode,
          has_canonical: !!verifiedCanonicalId,
          internal_uuid: order.id,
        })
      }

      // Bind canonical on a previously-legacy order if one is now supplied.
      if (verifiedCanonicalId && !order.canonicalDocumentId) {
        try {
          await bindCanonicalDocument(order.id, verifiedCanonicalId)
        } catch (e) {
          if (e instanceof TranslationOrderError && e.code !== 'ORDER_STORAGE_UNAVAILABLE') {
            // A rebind attempt on an order already bound to a DIFFERENT canonical.
            return err('canonical_binding_conflict', 409)
          }
          throw e
        }
      } else if (
        verifiedCanonicalId &&
        order.canonicalDocumentId &&
        order.canonicalDocumentId !== verifiedCanonicalId
      ) {
        // Idempotent re-submit pointing at a different canonical → conflict.
        return err('canonical_binding_conflict', 409)
      }

      // Enqueue operator review: brand-new orders start 'queued' by default
      // (Agent 1 default). Keep idempotent — only transition if just created and
      // not already past queued. A no-op/late transition is swallowed (PII-free).
      if (created && order.status !== 'queued') {
        await transitionOrder({
          orderId: order.id,
          expectedVersion: order.version,
          expectedStatus: order.status,
          toStatus: 'queued',
          actor: 'system',
          reason: 'submit_order',
          metadata: { source: 'submit_order', has_canonical: !!verifiedCanonicalId },
        }).catch(() => {})
      }
    } catch (e) {
      if (e instanceof TranslationOrderError) {
        emitEvent('order_transition_failures_total', {
          route: 'submit-order',
          mode,
          error_code: e.code,
          internal_uuid: orderId ?? undefined,
        })
        // Storage/infra problems are 503; everything else already returned above.
        return err('order_store_unavailable', 503, { code: e.code })
      }
      throw e
    }
  }

  // ── 4. Legacy manual_review_queue row (back-compat, ALWAYS written) ──────────
  // The operator UI still reads this; values are the operator's working copy and
  // are NEVER the binding authority. Mark the V2 linkage for traceability.
  const sourceFields: Record<string, string> = {}
  for (const f of body.fields ?? []) {
    const val = f.value ?? f.raw_cyrillic ?? ''
    if (f.field) sourceFields[f.field] = val
  }

  const ticket = await createManualReviewTicket({
    sessionId: checkoutId,
    reasons: ['operator_review_paid'],
    detectedDocumentType: docType,
    moduleType: 'translation',
    priority: 'high',
    safeSummary: `Paid translation order (${docType}); operator review per the operator-flow product model.`,
    v0Compat: {
      docType,
      sourceLang: 'uk',
      contactEmail: v.customerEmail ?? undefined,
      sourceFields,
    },
  })
  if (!ticket.ticketId) {
    return err('queue_unavailable', 503)
  }

  await writeManualReviewEvent({
    ticket_id: ticket.ticketId,
    session_id: checkoutId,
    event_type: 'manual_review_queued',
    metadata: {
      source: 'submit_order',
      doc_type: docType,
      reused: ticket.reused,
      v2_order_id: orderId,
      v2_canonical_bound: !!verifiedCanonicalId,
      canonical_mode: mode,
    },
  }).catch(() => {})

  // The V2 order id is the canonical handle once V2 is active; otherwise the
  // legacy ticket id (so /order/{id} keeps working in 'off' mode).
  const publicOrderId = orderId ?? ticket.ticketId

  const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://messenginfo.com'
  const orderUrl = `${base}/${locale}/order/${ticket.ticketId}`
  if (!ticket.reused && !orderReused) {
    notifyOperator({
      ticketId: ticket.ticketId,
      sessionId: checkoutId,
      eventType: 'manual_review_queued',
      priority: 'high',
      moduleType: 'translation',
      metadata: { source: 'submit_order', doc_type: docType },
    }).catch(() => {})
    if (v.customerEmail) {
      const tpl = orderReceivedEmail({ locale, orderUrl, docTypeLabel: docType })
      sendEmail({
        to: v.customerEmail,
        subject: tpl.subject,
        html: tpl.html,
        text: tpl.text,
        type: 'translation_email',
      }).catch(() => {})
    }
  }

  console.info('[submit-order]', JSON.stringify({
    ticket_id: ticket.ticketId,
    v2_order_id: orderId,
    canonical_bound: !!verifiedCanonicalId,
    canonical_mode: mode,
    doc_type: docType,
    reused: ticket.reused,
    fields: Object.keys(sourceFields).length,
    has_email: !!v.customerEmail,
  }))

  return NextResponse.json({
    ok: true,
    order_id: publicOrderId,
    v2_order_id: orderId,
    legacy_ticket_id: ticket.ticketId,
    reused: ticket.reused || orderReused,
    order_url: orderUrl,
  })
}
