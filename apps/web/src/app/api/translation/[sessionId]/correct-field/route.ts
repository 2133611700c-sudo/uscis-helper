/**
 * POST /api/translation/[sessionId]/correct-field
 *
 * Applies a human correction to an extracted field value.
 * Records a user_corrections row, updates extracted_fields.normalized_value,
 * and marks the field as confirmed in a single operation.
 *
 * Body: {
 *   field: string               — e.g. 'surname'
 *   new_value: string           — corrected English value
 *   reason?: string             — optional reason (ocr_error | controlling_spelling | one_document_exception)
 * }
 *
 * Returns: { ok, field, new_value, confirmed_at, correction_id }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

const CRITICAL_FIELDS = [
  'surname', 'given_names', 'date_of_birth', 'place_of_birth',
  'series', 'number', 'issued_by', 'date_of_issue',
]

const VALID_REASONS = ['ocr_error', 'controlling_spelling', 'one_document_exception', 'manual']

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params
  const body = await req.json().catch(() => ({})) as {
    field?: string
    new_value?: string
    reason?: string
  }

  const { field, new_value, reason = 'manual' } = body

  if (!sessionId) return NextResponse.json({ ok: false, error: 'sessionId required' }, { status: 400 })
  if (!field) return NextResponse.json({ ok: false, error: 'field required' }, { status: 400 })
  if (typeof new_value !== 'string' || new_value.trim() === '') {
    return NextResponse.json({ ok: false, error: 'new_value required (non-empty string)' }, { status: 400 })
  }

  const correctionType = VALID_REASONS.includes(reason) ? reason : 'manual'
  const confirmedAt = new Date().toISOString()
  const supabase = createAdminSupabaseClient()

  // Load current value for the correction record
  const { data: existing } = await supabase
    .from('extracted_fields')
    .select('id, normalized_value')
    .eq('session_id', sessionId)
    .eq('field', field)
    .single()

  if (!existing) {
    return NextResponse.json({ ok: false, error: `Field "${field}" not found for session` }, { status: 404 })
  }

  const oldValue = existing.normalized_value ?? ''

  // Update field: new value + mark confirmed
  const { error: updateErr } = await supabase
    .from('extracted_fields')
    .update({
      normalized_value: new_value.trim(),
      confirmed: true,
      confirmed_at: confirmedAt,
      review_required: false,
    })
    .eq('session_id', sessionId)
    .eq('field', field)

  if (updateErr) {
    return NextResponse.json({ ok: false, error: updateErr.message }, { status: 500 })
  }

  // Record correction in user_corrections
  const { data: version } = await supabase
    .from('user_corrections')
    .select('id', { count: 'exact', head: false })
    .eq('session_id', sessionId)
    .eq('field', field)

  const versionNum = (version?.length ?? 0) + 1

  const { data: correctionRow } = await supabase
    .from('user_corrections')
    .insert({
      session_id: sessionId,
      field,
      old_value: oldValue,
      new_value: new_value.trim(),
      reason: correctionType,
      correction_type: correctionType,
      version: versionNum,
    })
    .select('id')
    .single()

  // Audit
  await supabase.from('audit_logs').insert({
    session_id: sessionId,
    event_type: 'field_corrected',
    metadata: {
      field,
      old_value: oldValue,
      new_value: new_value.trim(),
      correction_type: correctionType,
      version: versionNum,
    },
  })

  // Recompute gates
  const { data: allFields } = await supabase
    .from('extracted_fields')
    .select('field, confirmed')
    .eq('session_id', sessionId)

  const fields = allFields ?? []
  const criticalRows = fields.filter(f => CRITICAL_FIELDS.includes(f.field))
  const criticalConfirmed = criticalRows.filter(f => f.confirmed).length
  const canCertify = criticalRows.length > 0 && criticalConfirmed === criticalRows.length

  return NextResponse.json({
    ok: true,
    field,
    new_value: new_value.trim(),
    old_value: oldValue,
    confirmed_at: confirmedAt,
    correction_id: correctionRow?.id ?? null,
    correction_type: correctionType,
    gates: {
      can_certify: canCertify,
      critical_confirmed: criticalConfirmed,
      critical_total: criticalRows.length,
    },
  })
}
