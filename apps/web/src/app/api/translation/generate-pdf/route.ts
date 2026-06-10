/**
 * POST /api/translation/generate-pdf
 *
 * Legacy wizard endpoint — now delegates to /api/translation/render
 * for real PDF generation via pdf-lib.
 *
 * v5.0: Removed "CERTIFIED COPY" watermark (was P0 legal violation).
 * Removed HTML-only path. Now returns real downloadable PDF.
 */
import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email/resend'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { generateTranslationPDF } from '@/lib/packet/pdf'
import { buildCertificationRecord } from '@/lib/translation/certificationRecord'
import { ExtractedField, SourceTrace } from '@/lib/translation/types'
import { isOwnerSession } from '@/lib/ownerAccess'
import { verifyStripeSessionPaid } from '@/lib/stripe/verifyPayment'
import { assertReviewGate } from '@/lib/translation/reviewGate'
import { hasUnresolvedCriticalForOutput } from '@/lib/documentSafety/ocrFieldSafetyGate'
import { classifyCriticality, isOcrFieldSafetyEnabled } from '@/lib/documentSafety/applyOcrFieldSafety'
import { validateConfirmedValue } from '@/lib/documentSafety/confirmedValueGuard'
import { buildAttestationRecord } from '@/lib/translation/attestation'
import { persistCertification } from '@/lib/translation/persistCertification'

export const dynamic = 'force-dynamic'

interface LegacyPdfPayload {
  profile: { name: string; email: string; phone: string; addr: string }
  selectedPlan: 'basic' | 'plus' | 'premium'
  spanishCopy: boolean
  locale: string
  signatureDataUrl: string | null
  signatureMethod: 'drawn_on_screen' | 'manual_wet_signature'
  signedAt: string
  certificationTextVersion: string
  session_id?: string
  fields?: ExtractedField[]
  source_traces?: SourceTrace[]
  doc_type?: string
  scope_title?: string
  /** Back-compat single confirmation flag (true ⇒ both checkboxes). */
  reviewConfirmed?: boolean
  /** Checkbox 1 — user reviewed the data and it is correct. */
  dataReviewed?: boolean
  /** Checkbox 2 — user understands the signature attests accuracy. */
  accuracyAttested?: boolean
}

const PLAN_LABEL: Record<string, string> = {
  basic:   'Basic ($14.99)',
  plus:    'Plus ($19.99)',
  premium: 'Premium ($29.99)',
}

export async function POST(req: NextRequest) {
  let payload: LegacyPdfPayload
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
  }

  // ── Pre-payment review check ───────────────────────────────────────────────
  // Block BEFORE Stripe charge if any extracted field still requires review.
  // This prevents the user from being charged for a PDF that reviewGate would
  // block with 403. Return 400 (client error) so the wizard can show a
  // "please confirm your fields first" message without triggering a charge.
  const unresolvedReviewFields = (payload.fields ?? []).filter((f) => f.review_required === true)
  if (unresolvedReviewFields.length > 0) {
    return NextResponse.json(
      {
        ok: false,
        error: 'fields_require_review',
        detail: 'Please confirm all highlighted fields on the review screen before completing payment.',
        unresolved_count: unresolvedReviewFields.length,
      },
      { status: 400 },
    )
  }

  // ── Payment gate (Severity-1 liability fix, 2026-05-27) ────────────────────
  //   This endpoint previously hardcoded payment_confirmed:true and never
  //   verified the Stripe session — anyone could POST and receive a translation
  //   PDF + email for free. Now: owner-bypass OR a valid Stripe checkout session
  //   whose payment_status==='paid' AND metadata.service==='translation'.
  //   Stripe checkout id is the cs_* set by ?cs={CHECKOUT_SESSION_ID} on the
  //   success redirect; the wizard sends it in the X-Payment-Token header
  //   (parity with TPS) or, as a fallback, in payload.session_id.
  const owner = await isOwnerSession(req)
  if (!owner.verified) {
    const token = req.headers.get('x-payment-token') || payload.session_id || ''
    if (!token) {
      return NextResponse.json(
        { ok: false, error: 'payment_required', detail: 'Complete checkout before generating translation.' },
        { status: 402 },
      )
    }
    const v = await verifyStripeSessionPaid(token, { expectedService: 'translation' })
    if (!v.paid || !v.correctService) {
      return NextResponse.json(
        { ok: false, error: 'payment_not_confirmed', reason: v.reason },
        { status: 402 },
      )
    }
  }

  const { profile, selectedPlan, signedAt, certificationTextVersion, session_id } = payload

  // ── Review Gate (hard block, 8 CFR §103.2(b)(3)) ───────────────────────────
  //   A signed translation may only be rendered after a human reviewed the
  //   machine draft and signed the certification. This endpoint previously
  //   rendered certified output from raw machine fields with only a payment
  //   check — a machine-only POST yielded a "certified" PDF. The gate is passed
  //   by an explicit reviewConfirmed checkbox OR a completed signature, and in
  //   both cases signer name + address are mandatory. Applies to the owner too:
  //   certification is a legal boundary, not a payment one.
  const gate = assertReviewGate({
    reviewConfirmed: payload.reviewConfirmed,
    dataReviewed: payload.dataReviewed,
    accuracyAttested: payload.accuracyAttested,
    signerName: profile?.name,
    signerAddress: profile?.addr,
    signedAt,
    signatureMethod: payload.signatureMethod,
    signatureDataUrl: payload.signatureDataUrl,
    extractedFields: (payload.fields ?? []).map((field) => ({
      field: field.field,
      normalized_value: field.normalized_value,
      review_required: field.review_required,
    })),
  })
  if (!gate.ok) {
    return NextResponse.json(
      { ok: false, error: 'review_required', gate: 'review', reason: gate.reason, detail: gate.detail },
      { status: 403 },
    )
  }

  // ── Phase 3.1 (ADR-017): D5 release values re-enter C3 server-side (ALWAYS ON) ──
  // "A confirmed field CAN become final — via C3, never by bypassing it."
  // The act of signing the certification IS the confirmation: every value the
  // user reviewed/edited on the review screen arrives here as normalized_value
  // and is about to be rendered into a LEGAL certified English translation.
  // Until now that release value went into the PDF with zero server-side
  // validation — Cyrillic, control chars, garbage. This guard is deterministic
  // INPUT SANITATION for a legal document, not an AI-safety experiment: it runs
  // unconditionally (NOT behind OCR_FIELD_SAFETY_ENABLED). Release values are
  // Latin post-KMU-55, so legitimate flows are unaffected; only genuine defects
  // (Cyrillic/control/over-length/bad-date) are caught.
  //   - CRITICAL field fails → 403 (field NAME only, never the value — PII rule)
  //   - non-critical fails   → value nulled (renders as MISSING), continue
  //   - pass                 → final_value set (the C3 re-run writing the release value)
  for (const f of payload.fields ?? []) {
    const verdict = validateConfirmedValue(f.field, f.normalized_value)
    const criticality = classifyCriticality(f.field)
    const critical = criticality === 'critical_identity' || criticality === 'critical_document'
    if (!verdict.ok) {
      if (critical) {
        return NextResponse.json(
          // PII rule: field NAME only — the rejected value is NEVER echoed.
          { ok: false, error: 'review_required', gate: 'confirmed_value_guard', field: f.field, reason: verdict.reason },
          { status: 403 },
        )
      }
      f.final_value = null      // non-critical: drop the bad value, render as missing
      f.normalized_value = ''   // belt-and-suspenders: no other consumer can read it
      continue
    }
    f.final_value = (f.normalized_value ?? '').trim() || null // C3 accepts the release value as final
  }

  // ── C3: machine-read critical-field output gate (OCR_FIELD_SAFETY_ENABLED, default OFF) ──
  // Separate concern from the confirmed-value guard above: this gates the
  // MACHINE-read candidate safety (a critical field the model read but the user
  // never confirmed). OFF ⇒ skipped (reviewGate already blocks unconfirmed
  // review_required fields). ON (canary) ⇒ block when any critical field is
  // still review/manual and not confirmed.
  if (isOcrFieldSafetyEnabled()) {
    const unresolved = hasUnresolvedCriticalForOutput(
      (payload.fields ?? []).map((f) => ({
        criticality: classifyCriticality(f.field),
        review_required: f.review_required,
        manual_required: (f as { manual_required?: boolean }).manual_required,
        confirmed: (f as { confirmed?: boolean }).confirmed,
      })),
    )
    if (unresolved) {
      return NextResponse.json(
        { ok: false, error: 'review_required', gate: 'ocr_field_safety', reason: 'unresolved_critical_field' },
        { status: 403 },
      )
    }
  }

  // Build certification record
  const certRecord = buildCertificationRecord({
    signerName: profile.name,
    signerAddress: profile.addr,
    signerPhone: profile.phone,
    signerEmail: profile.email,
    sourceLanguage: 'Ukrainian',
    signatureTypedName: profile.name,
  })

  // Generate real PDF
  let pdfBuffer: Buffer | null = null
  try {
    pdfBuffer = await generateTranslationPDF({
      scopeTitle: payload.scope_title ?? `English Translation of Ukrainian Document`,
      documentType: payload.doc_type ?? 'other',
      fields: payload.fields ?? [],
      sourceTraces: payload.source_traces ?? [],
      certificationRecord: certRecord,
      sessionId: session_id ?? 'legacy',
      signatureDataUrl: payload.signatureDataUrl,
    })
  } catch (err) {
    console.error('[generate-pdf] PDF generation failed:', err)
  }

  // Internal attestation/audit trail (8 CFR §103.2(b)(3)) — WHAT was attested and
  // WHEN. Persisted to translation_certification_audit (its own table). Not shown
  // on the customer PDF.
  const attestation = buildAttestationRecord({
    dataReviewed: payload.dataReviewed,
    accuracyAttested: payload.accuracyAttested,
    reviewConfirmed: payload.reviewConfirmed,
    signerName: profile?.name,
    signerAddress: profile?.addr,
    signedAt,
    signatureMethod: payload.signatureMethod,
    signatureDataUrl: payload.signatureDataUrl,
    certificationVersion: certificationTextVersion,
    content: payload.fields ?? [],
    recordedAt: new Date().toISOString(),
  })

  // S2 — Audit persistence is a HARD requirement, not best-effort. The
  // translation_certification_audit row IS our 8 CFR §103.2(b)(3) compliance
  // artifact: if it is not stored we must NOT return a "signed" PDF as if the
  // certification had been recorded. persistCertification inserts order + audit
  // with one retry each (transient-blip tolerance). (Prior code logged a warning
  // and returned the PDF anyway → a signed document with no audit trail.)
  const persist = await persistCertification(createAdminSupabaseClient(), {
    orderRow: {
      name: profile.name,                 // NOT NULL — review gate guarantees signer name
      email: profile.email || '',         // NOT NULL — wizard sends '' (no email collected)
      phone: profile.phone || null,
      address: profile.addr || null,
      plan: selectedPlan,
      spanish_copy: !!payload.spanishCopy,
      locale: payload.locale ?? 'en',
      signed_at: signedAt || null,
      signature_method: payload.signatureMethod,
      certification_version: certificationTextVersion,
      status: 'signed',                   // CHECK: one of signed | emailed | failed
      stripe_checkout_id: session_id ?? null,
    },
    auditRow: {
      stripe_checkout_id: session_id ?? null,
      locale: payload.locale ?? 'en',
      document_type: payload.doc_type ?? 'other',
      certifier_name_present: attestation.certifier_name_present,
      certifier_address_present: attestation.certifier_address_present,
      signature_present: attestation.signature_present,
      signature_method: attestation.signature_method,
      data_reviewed: attestation.data_reviewed,
      accuracy_attested: attestation.accuracy_attested,
      review_confirmed: attestation.review_confirmed,
      document_hash: attestation.document_hash,
      certification_version: attestation.certification_version,
      signed_at: signedAt || null,
      audit_payload: attestation,
    },
  })

  if (!persist.ok) {
    // Never lose a signed attestation: emit the full record as a structured
    // RECONCILE line (retained in logs) so it can be replayed into the DB. Then
    // fail closed — non-200, no PDF, no email, no "complete." The user already
    // paid + signed; the payment is verified by an idempotent Stripe session, so
    // a retry does NOT re-charge.
    console.error('[generate-pdf] AUDIT_RECONCILE', JSON.stringify({
      session_id: session_id ?? 'legacy',
      orderErr: persist.orderErr,
      auditErr: persist.auditErr,
      attestation,
    }))
    return NextResponse.json(
      {
        ok: false,
        error: 'audit_persist_failed',
        status: 'degraded',
        detail: 'Your signature was recorded, but the system could not save the certification record. You will not be charged again — please retry in a moment. If this keeps happening, contact support.',
        session_id: session_id ?? null,
      },
      { status: 503 },
    )
  }

  // Send confirmation email (text, not HTML attachment)
  const plan = PLAN_LABEL[selectedPlan] ?? selectedPlan
  const planLine = `${plan}${payload.spanishCopy ? ' + Spanish Copy (+$3.00)' : ''}`
  const emailBody = [
    `Thank you, ${profile.name}.`,
    '',
    `Your translation order has been received.`,
    `Plan: ${planLine}`,
    `Signed: ${new Date(signedAt).toLocaleString('en-US')}`,
    `Certification version: ${certificationTextVersion}`,
    '',
    `Your PDF translation document is attached to this email.`,
    '',
    'Messenginfo is not a law firm. You signed the certification under 8 CFR §103.2(b)(3) and accept full responsibility for the accuracy of the translation. Verify current requirements at uscis.gov before filing.',
  ].join('\n')

  try {
    await sendEmail({
      to: profile.email,
      subject: 'Your Translation Document — Messenginfo',
      html: `<pre style="font-family:monospace;font-size:13px">${emailBody.replace(/&/g,'&amp;').replace(/</g,'&lt;')}</pre>`,
      text: emailBody,
      type: 'translation_email' as const,
      ...(pdfBuffer ? {
        attachment: {
          filename: `translation-${(session_id ?? 'order').slice(0, 8)}.pdf`,
          content: pdfBuffer.toString('base64'),
        },
      } : {}),
    })
  } catch (err) {
    console.error('[generate-pdf] Email failed:', err)
  }

  // Return PDF directly if generated
  if (pdfBuffer) {
    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="translation-${(session_id ?? 'order').slice(0, 8)}.pdf"`,
        'X-Session-Id': session_id ?? '',
      },
    })
  }

  // Fallback: confirm without PDF (rare — means pdf-lib failed)
  return NextResponse.json({
    ok: true,
    status: 'email_sent',
    warning: 'PDF generation failed — order recorded, email sent without attachment. Support will follow up.',
    session_id,
  })
}
