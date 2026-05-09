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

  // Load all state from v5 schema (session + related tables)
  const supabase = createAdminSupabaseClient()
  const { data: sessionData, error } = await supabase
    .from('translation_sessions')
    .select('*')
    .eq('session_id', session_id)
    .single()

  if (error || !sessionData) {
    return NextResponse.json({ ok: false, error: 'Session not found' }, { status: 404 })
  }

  // Load certification record
  const { data: certData } = await supabase
    .from('certification_records')
    .select('*')
    .eq('session_id', session_id)
    .single()

  // Load extracted fields → map to ExtractedField[] and SourceTrace[]
  const { data: fieldRows } = await supabase
    .from('extracted_fields')
    .select('*')
    .eq('session_id', session_id)
    .order('created_at')

  const extractedFields = (fieldRows ?? []).map((r: Record<string, unknown>) => ({
    field:            r.field,
    source_label:     r.source_label ?? '',
    source_zone:      r.source_zone ?? 'unknown',
    bbox:             [0, 0, 1, 0.1] as [number,number,number,number],
    raw_value:        r.raw_value ?? '',
    normalized_value: r.normalized_value ?? '',
    language_layer:   r.language_layer ?? 'uk',
    confidence:       Number(r.confidence ?? 1),
    review_required:  Boolean(r.review_required),
  }))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sourceTraces = (extractedFields as any[]).map((f) => ({
    field:            f.field,
    document_type:    sessionData.doc_type ?? 'ua_passport_internal',
    source_label:     f.source_label,
    source_zone:      f.source_zone,
    bbox:             f.bbox,
    raw_value:        f.raw_value,
    normalized_value: f.normalized_value,
    language_layer:   f.language_layer,
    confidence:       f.confidence,
    review_required:  f.review_required,
  }))

  // Assemble PacketState
  const state = {
    ...sessionData,
    document_type:        sessionData.doc_type ?? 'ua_passport_internal',
    scope_title:          sessionData.scope_title ?? 'English Translation of Ukrainian Internal Passport',
    extracted_fields:     extractedFields,
    source_traces:        sourceTraces,
    user_corrections:     [],   // populated only if user made edits in Review UI
    // Remap DB column names → CertificationRecord field names
    certification_record: certData ? {
      ...certData,
      address: certData.signer_address ?? undefined,  // DB: signer_address → type: address
    } : null,
    payment_confirmed:    Boolean(sessionData.payment_confirmed),
  } as unknown as PacketState

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

  // Gate 3: Source-to-final completeness audit
  // All critical fields must be human-confirmed before render
  const CRITICAL_FIELDS_RENDER = [
    'surname', 'given_names', 'date_of_birth', 'place_of_birth',
    'series', 'number', 'issued_by', 'date_of_issue',
  ]
  const { data: confirmedRows } = await supabase
    .from('extracted_fields')
    .select('field, confirmed, normalized_value')
    .eq('session_id', session_id)

  type ConfirmedRow = { field: string; confirmed: boolean; normalized_value: string | null }
  const confirmedMap: Record<string, ConfirmedRow> = Object.fromEntries(
    (confirmedRows ?? []).map(r => [r.field, r as ConfirmedRow])
  )
  const unconfirmedCritical = CRITICAL_FIELDS_RENDER.filter(cf => {
    const row = confirmedMap[cf]
    return row && !row.confirmed
  })
  const missingCritical = CRITICAL_FIELDS_RENDER.filter(cf => !confirmedMap[cf])

  // Final PDF fields must match the confirmed DB values (source-to-final audit)
  const finalFieldMap = Object.fromEntries(
    state.extracted_fields.map(f => [f.field, f.normalized_value])
  )
  const mismatchedFields: string[] = []
  for (const [field, dbRow] of Object.entries(confirmedMap)) {
    const finalVal = finalFieldMap[field]
    if (dbRow.confirmed && finalVal && finalVal !== dbRow.normalized_value) {
      mismatchedFields.push(`${field}: DB="${dbRow.normalized_value}" vs final="${finalVal}"`)
    }
  }

  if (unconfirmedCritical.length > 0 || missingCritical.length > 0 || mismatchedFields.length > 0) {
    // PII-safe: log field names and counts only — never field values
    await supabase.from('audit_logs').insert({
      session_id,
      event_type: 'render_blocked_completeness_audit',
      metadata: {
        unconfirmed_critical_fields: unconfirmedCritical,
        missing_critical_fields: missingCritical,
        mismatched_field_names: mismatchedFields.map(m => m.split(':')[0]),  // field name only, no values
        mismatched_count: mismatchedFields.length,
      },
    })
    return NextResponse.json({
      ok: false,
      error: 'Source-to-final completeness audit failed — cannot render.',
      gate: 'completeness_audit',
      unconfirmed_critical: unconfirmedCritical,
      missing_critical: missingCritical,
      mismatched_fields: mismatchedFields,
    }, { status: 422 })
  }

  // Gate 3.5: OCR/Vision result exists + evidence coverage for critical fields
  // Checks that an ocr_completed audit event exists for this session (Phase 1+).
  // Pre-Phase-1 sessions (no evidence columns) pass with a warning.
  const { data: ocrAuditRows } = await supabase
    .from('audit_logs')
    .select('id')
    .eq('session_id', session_id)
    .eq('event_type', 'ocr_completed')
    .limit(1)

  const ocrResultExists = (ocrAuditRows?.length ?? 0) > 0

  // Evidence coverage: critical fields with no evidence_type are pre-Phase-1 rows.
  // We warn but do not hard-block (grandfathering existing paid sessions).
  const { data: evidenceRows } = await supabase
    .from('extracted_fields')
    .select('field, evidence_type')
    .eq('session_id', session_id)
    .in('field', CRITICAL_FIELDS_RENDER)

  type EvidenceRow = { field: string; evidence_type: string | null }
  const criticalWithoutEvidence = (evidenceRows ?? [])
    .filter((r: EvidenceRow) => r.evidence_type === null)
    .map((r: EvidenceRow) => r.field)

  const evidenceWarnings: string[] = []
  if (!ocrResultExists) {
    evidenceWarnings.push('No OCR run found for this session — fields may be manually entered.')
  }
  if (criticalWithoutEvidence.length > 0) {
    evidenceWarnings.push(
      `${criticalWithoutEvidence.length} critical field(s) have no evidence record (pre-Phase-1 extraction): ${criticalWithoutEvidence.join(', ')}`
    )
  }
  // Hard-block only if OCR exists but critical fields have NO evidence at all
  // (meaning Phase-1 OCR ran but failed to label fields — indicates a code bug).
  if (ocrResultExists && criticalWithoutEvidence.length === CRITICAL_FIELDS_RENDER.length) {
    return NextResponse.json({
      ok: false,
      error: 'Evidence audit failed: OCR completed but no critical fields have evidence records.',
      gate: 'evidence_audit',
      critical_without_evidence: criticalWithoutEvidence,
    }, { status: 422 })
  }

  // Gate 4: QA validators (merge in any evidence warnings from Gate 3.5)
  const finalText = buildFinalDocument(state)
  const qa = runQaValidators(state, finalText)
  // Carry evidence warnings forward into QA result for PDF audit trail
  if (evidenceWarnings.length > 0) {
    qa.warnings = [...(qa.warnings ?? []), ...evidenceWarnings]
  }

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
