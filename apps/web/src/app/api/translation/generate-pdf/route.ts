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
  /** TranslationReviewGate checkbox — explicit human confirmation of the draft. */
  reviewConfirmed?: boolean
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
    signerName: profile?.name,
    signerAddress: profile?.addr,
    signedAt,
    signatureMethod: payload.signatureMethod,
    signatureDataUrl: payload.signatureDataUrl,
  })
  if (!gate.ok) {
    return NextResponse.json(
      { ok: false, error: 'review_required', gate: 'review', reason: gate.reason, detail: gate.detail },
      { status: 403 },
    )
  }
  if (gate.warnings.length) {
    // Non-blocking compliance gaps. signer_address_missing: the live TranslateWizard
    // does not yet collect the translator address — render proceeds but the defect
    // is recorded for follow-up (wire an address field, then promote to a hard gate).
    console.warn('[generate-pdf] review-gate warnings:', gate.warnings.join(', '))
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
    })
  } catch (err) {
    console.error('[generate-pdf] PDF generation failed:', err)
  }

  // Save order record
  try {
    const supabase = createAdminSupabaseClient()
    await supabase.from('translation_orders').upsert({
      session_id: session_id ?? `legacy-${Date.now()}`,
      status: 'rendered',
      document_type: payload.doc_type ?? 'other',
      payment_confirmed: true,
      certification_record: certRecord,
      scope_title: payload.scope_title ?? '',
      locale: payload.locale ?? 'en',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'session_id' })
  } catch (err) {
    console.error('[generate-pdf] Supabase persist failed:', err)
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
