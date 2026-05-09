/**
 * POST /api/translation/render
 *
 * Final render — generates real PDF using pdf-lib.
 * HARD GATES (all must pass before render):
 *   1. payment_confirmed = true (verified server-side via Stripe checkout ID)
 *   2. CertificationRecord complete and valid
 *   3. QA validators pass (no forbidden phrases, source traces present)
 *   4. All critical fields have source trace
 *
 * Returns: application/pdf binary or { ok: false, qa_failures }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { runQaValidators } from '@/lib/translation/translationQaValidator'
import { buildFinalDocument } from '@/lib/translation/bureauStyleRenderer'
import { validateCertificationRecord } from '@/lib/translation/certificationRecord'
import { PacketState } from '@/lib/translation/types'
import { generateTranslationPDF } from '@/lib/packet/pdf'
import Stripe from 'stripe'

export const dynamic = 'force-dynamic'

async function verifyStripePayment(checkoutId: string): Promise<boolean> {
  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) return false
  try {
    const stripe = new Stripe(secretKey, { apiVersion: '2026-04-22.dahlia' })
    const session = await stripe.checkout.sessions.retrieve(checkoutId)
    return session.payment_status === 'paid'
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as {
    session_id?: string
    checkout_id?: string   // Stripe checkout session ID for payment verification
  }

  const { session_id, checkout_id } = body
  if (!session_id) return NextResponse.json({ ok: false, error: 'session_id required' }, { status: 400 })

  // Load state from Supabase (v5 schema: translation_sessions)
  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase
    .from('translation_sessions')
    .select('*')
    .eq('session_id', session_id)
    .single()

  if (error || !data) {
    return NextResponse.json({ ok: false, error: 'Session not found' }, { status: 404 })
  }

  const state = data as unknown as PacketState

  // Gate 1: Payment verification
  const paymentVerified = checkout_id
    ? await verifyStripePayment(checkout_id)
    : state.payment_confirmed

  if (!paymentVerified) {
    return NextResponse.json({
      ok: false,
      error: 'Payment not confirmed. Complete checkout before rendering final document.',
      gate: 'payment',
    }, { status: 402 })
  }

  // Gate 2: Certification record
  if (!state.certification_record) {
    return NextResponse.json({
      ok: false,
      error: 'Certification record missing. Translator must sign before render.',
      gate: 'certification',
    }, { status: 400 })
  }

  const { valid, errors: certErrors } = validateCertificationRecord(state.certification_record)
  if (!valid) {
    return NextResponse.json({
      ok: false,
      error: 'Certification record incomplete',
      details: certErrors,
      gate: 'certification',
    }, { status: 400 })
  }

  // Gate 3: QA validators
  const finalText = buildFinalDocument(state)
  const qa = runQaValidators(state, finalText)

  if (qa.status === 'FAIL') {
    return NextResponse.json({
      ok: false,
      error: 'QA validation failed — cannot render final document',
      qa_failures: qa.failures,
      qa_required_actions: qa.required_actions,
      gate: 'qa',
    }, { status: 422 })
  }

  // All gates passed — generate real PDF
  try {
    const pdfBuffer = await generateTranslationPDF({
      scopeTitle: state.scope_title,
      documentType: state.document_type ?? 'other',
      fields: state.extracted_fields,
      sourceTraces: state.source_traces,
      certificationRecord: state.certification_record,
      sessionId: session_id,
      qaWarnings: qa.warnings,
    } as Parameters<typeof generateTranslationPDF>[0])

    // Mark session as rendered
    await supabase.from('translation_sessions').update({
      status: 'rendered',
      updated_at: new Date().toISOString(),
    }).eq('session_id', session_id)

    // Persist final_renders row
    const storageKey = `renders/${session_id}/${Date.now()}.pdf`
    await supabase.from('final_renders').insert({
      session_id,
      storage_key: storageKey,
      content_type: 'application/pdf',
      file_size_bytes: pdfBuffer.length,
      qa_passed: true,
      qa_report: { status: qa.status, warnings: qa.warnings ?? [], failures: qa.failures ?? [] },
    })

    // Audit log
    await supabase.from('audit_logs').insert({
      session_id,
      event_type: 'final_rendered',
      metadata: {
        file_size_bytes: pdfBuffer.length,
        qa_status: qa.status,
        storage_key: storageKey,
      },
    })

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="translation-${session_id.slice(0,8)}.pdf"`,
        'Content-Length': String(pdfBuffer.length),
      },
    })
  } catch (err) {
    console.error('[translation/render] PDF generation failed:', err)
    // Audit failure
    await supabase.from('audit_logs').insert({
      session_id,
      event_type: 'error',
      metadata: { step: 'render', error: String(err) },
    })
    return NextResponse.json({ ok: false, error: 'PDF generation failed', details: String(err) }, { status: 500 })
  }
}
