/**
 * POST /api/translation/[sessionId]/correct-field
 *
 * Applies a human correction to an extracted field value: records a versioned
 * correction, updates the normalized value, marks the field confirmed (raw NEVER
 * touched), and recomputes gates.
 *
 * RUNTIME-DECOUPLED: persistence via getRepositories() (in-memory default; Supabase
 * opt-in adapter NOT connected). No direct Supabase client import. The canonical
 * override-loop (flag default OFF) stays as the only DB-adjacent dependency.
 *
 * Returns: { ok, field, new_value, old_value, confirmed_at, correction_id, gates }
 */
import { NextRequest, NextResponse } from 'next/server'
import { getRepositories } from '@/lib/repositories'
import {
  validateSessionId, validateFieldName, validateCorrectionValue, normalizeValue,
} from '@/lib/translation/inputValidation'
import { getOverrideLoopMode } from '@/lib/canonical/overrideLoopMode'
import { appendCorrectionAsCanonicalOverride } from '@/lib/canonical/overrideLoop'

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const CRITICAL_FIELDS = ['surname', 'given_names', 'date_of_birth', 'place_of_birth', 'series', 'number', 'issued_by', 'date_of_issue']
const VALID_REASONS = ['ocr_error', 'controlling_spelling', 'one_document_exception', 'manual']

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params
  const body = await req.json().catch(() => ({})) as { field?: string; new_value?: string; reason?: string; canonical_document_id?: string }
  const { field, new_value, reason = 'manual', canonical_document_id } = body
  const repos = getRepositories()
  const audit = (event_type: string, metadata: Record<string, unknown>) =>
    repos.audit.append({ sessionId, eventType: event_type, at: new Date().toISOString(), detail: metadata as Record<string, string | number | boolean | null> }).catch(() => {})

  // ── Input validation ─────────────────────────────────────────────────────
  const sessionErr = validateSessionId(sessionId)
  if (sessionErr) return NextResponse.json({ ok: false, ...sessionErr }, { status: sessionErr.status })

  const fieldErr = validateFieldName(field)
  if (fieldErr) {
    await audit('validation_failed', { route: 'correct-field', error_code: 'invalid_field' })
    return NextResponse.json({ ok: false, ...fieldErr }, { status: fieldErr.status })
  }
  const safeField = field as string
  const valueErr = validateCorrectionValue(new_value, safeField)
  if (valueErr) {
    await audit('validation_failed', { route: 'correct-field', field: safeField, error_code: 'invalid_value' })
    return NextResponse.json({ ok: false, ...valueErr }, { status: valueErr.status })
  }

  const correctedValue = normalizeValue(new_value as string)
  const correctionType = VALID_REASONS.includes(reason ?? '') ? reason! : 'manual'
  const confirmedAt = new Date().toISOString()

  // ── Session + field existence ─────────────────────────────────────────────
  if (!(await repos.documents.getSession(sessionId))) {
    return NextResponse.json({ ok: false, error: 'session_not_found', message: 'Session not found.' }, { status: 404 })
  }
  const existing = await repos.review.getField(sessionId, safeField)
  if (!existing) {
    return NextResponse.json({ ok: false, error: 'field_not_found', message: `Field "${safeField}" not found for this session.` }, { status: 404 })
  }
  const oldValue = existing.normalizedValue ?? ''

  // ── Apply correction (raw preserved) ──────────────────────────────────────
  try {
    await repos.confirmation.correctField(sessionId, safeField, correctedValue, confirmedAt)
  } catch {
    await audit('error', { route: 'correct-field', field: safeField, error_code: 'update_failed' })
    return NextResponse.json({ ok: false, error: 'db_error', message: 'Could not update field.' }, { status: 500 })
  }

  // ── Record versioned user correction ──────────────────────────────────────
  let correctionId: string | null = null
  let versionNum = 0
  try {
    const rec = await repos.confirmation.recordUserCorrection(sessionId, safeField, oldValue, correctedValue, correctionType, confirmedAt)
    correctionId = rec.id; versionNum = rec.version
  } catch {
    await audit('error', { route: 'correct-field', field: safeField, step: 'user_corrections_insert' })
    return NextResponse.json({ ok: false, error: 'correction_log_failed', message: 'Correction could not be recorded.' }, { status: 500 })
  }

  await audit('field_corrected', { field: safeField, correction_type: correctionType, version: versionNum, old_value_length: oldValue.length, new_value_length: correctedValue.length })

  // ── CANONICAL_OVERRIDE_LOOP (P1): dual-write (flag default OFF) ────────────
  let canonicalLoop: 'off' | 'skipped_no_id' | 'appended' | 'not_found' | 'conflict' | 'storage_error' = 'off'
  if (getOverrideLoopMode() !== 'off') {
    if (typeof canonical_document_id === 'string' && UUID_RE.test(canonical_document_id)) {
      const res = await appendCorrectionAsCanonicalOverride({
        canonicalDocumentId: canonical_document_id, fieldKey: safeField, newValue: correctedValue,
        source: 'user_edit', actor: 'user', reason: correctionType,
      })
      canonicalLoop = res.ok ? 'appended' : res.kind === 'not_found' ? 'not_found' : res.kind === 'conflict' ? 'conflict' : 'storage_error'
    } else {
      canonicalLoop = 'skipped_no_id'
    }
  }

  // ── Recompute gates ──────────────────────────────────────────────────────
  const fields = await repos.review.listFields(sessionId)
  const criticalRows = fields.filter((f) => CRITICAL_FIELDS.includes(f.field))
  const criticalConfirmed = criticalRows.filter((f) => f.confirmed).length
  const canCertify = criticalRows.length > 0 && criticalConfirmed === criticalRows.length

  return NextResponse.json({
    ok: true,
    field: safeField,
    new_value: correctedValue,
    old_value: oldValue,
    confirmed_at: confirmedAt,
    correction_id: correctionId,
    correction_type: correctionType,
    canonical_loop: canonicalLoop,
    gates: { can_certify: canCertify, critical_confirmed: criticalConfirmed, critical_total: criticalRows.length },
  })
}
