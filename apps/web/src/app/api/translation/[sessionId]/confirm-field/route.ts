/**
 * POST /api/translation/[sessionId]/confirm-field
 *
 * Marks a single extracted field as human-confirmed. Required before certification
 * is allowed for critical fields.
 *
 * Body: { field: string }   — snake_case field name (e.g. 'surname')
 * Returns: { ok, field, confirmed_at, gates }
 *
 * RUNTIME-DECOUPLED: persistence goes through getRepositories() (in-memory by
 * default; Supabase only via the opt-in adapter — NOT connected). This route no
 * longer imports a Supabase client. The canonical override-loop (flag-gated, default
 * OFF) is the only DB-adjacent dependency and lives in the canonical adapter layer.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getRepositories } from '@/lib/repositories'
import { validateSessionId, validateFieldName } from '@/lib/translation/inputValidation'
// CANONICAL_OVERRIDE_LOOP (P1): dual-write into the canonical override chain —
// flag default OFF, legacy behaviour unchanged.
import { getOverrideLoopMode } from '@/lib/canonical/overrideLoopMode'
import { appendCorrectionAsCanonicalOverride } from '@/lib/canonical/overrideLoop'

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const CRITICAL_FIELDS = [
  'surname', 'given_names', 'date_of_birth', 'place_of_birth',
  'series', 'number', 'issued_by', 'date_of_issue',
]

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params
  const body = await req.json().catch(() => ({})) as { field?: string; canonical_document_id?: string }
  const { field, canonical_document_id } = body

  // ── Input validation ─────────────────────────────────────────────────────
  const sessionErr = validateSessionId(sessionId)
  if (sessionErr) return NextResponse.json({ ok: false, ...sessionErr }, { status: sessionErr.status })
  const fieldErr = validateFieldName(field)
  if (fieldErr) return NextResponse.json({ ok: false, ...fieldErr }, { status: fieldErr.status })

  const safeField = field as string
  const repos = getRepositories()

  // ── Session existence check ──────────────────────────────────────────────
  const session = await repos.documents.getSession(sessionId)
  if (!session) {
    return NextResponse.json({ ok: false, error: 'session_not_found', message: 'Session not found.' }, { status: 404 })
  }

  const confirmedAt = new Date().toISOString()

  // Load current value BEFORE confirm (for the canonical override dual-write).
  const existingField = await repos.review.getField(sessionId, safeField)

  try {
    await repos.confirmation.confirmField(sessionId, safeField, confirmedAt)
  } catch {
    await repos.audit.append({ sessionId, eventType: 'error', at: confirmedAt, detail: { route: 'confirm-field', field: safeField } }).catch(() => {})
    return NextResponse.json({ ok: false, error: 'db_error', message: 'Could not update field.' }, { status: 500 })
  }

  // ── Audit (best-effort, PII-free) ─────────────────────────────────────────
  await repos.audit.append({ sessionId, eventType: 'field_confirmed', at: confirmedAt, detail: { field: safeField } }).catch(() => {})

  // ── CANONICAL_OVERRIDE_LOOP (P1): dual-write into the canonical chain ──────
  let canonicalLoop: 'off' | 'skipped_no_id' | 'skipped_no_value' | 'appended' | 'not_found' | 'conflict' | 'storage_error' = 'off'
  const overrideLoopMode = getOverrideLoopMode()
  if (overrideLoopMode !== 'off') {
    const confirmedValue = existingField?.normalizedValue ?? null
    if (typeof canonical_document_id === 'string' && UUID_RE.test(canonical_document_id)) {
      if (typeof confirmedValue === 'string' && confirmedValue.length > 0) {
        const res = await appendCorrectionAsCanonicalOverride({
          canonicalDocumentId: canonical_document_id,
          fieldKey: safeField,
          newValue: confirmedValue,
          source: 'user_edit',
          actor: 'user',
          reason: 'confirm',
        })
        canonicalLoop = res.ok ? 'appended'
          : res.kind === 'not_found' ? 'not_found'
          : res.kind === 'conflict' ? 'conflict'
          : 'storage_error'
      } else {
        canonicalLoop = 'skipped_no_value'
      }
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
    confirmed_at: confirmedAt,
    canonical_loop: canonicalLoop,
    gates: { can_certify: canCertify, critical_confirmed: criticalConfirmed, critical_total: criticalRows.length },
  })
}
