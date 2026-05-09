/**
 * POST /api/translation/[sessionId]/confirm-field
 *
 * Marks a single extracted field as human-confirmed.
 * Required before certification is allowed for critical fields.
 *
 * Body: { field: string }   — snake_case field name (e.g. 'surname')
 *
 * Returns: { ok, field, confirmed_at, gates }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

const CRITICAL_FIELDS = [
  'surname', 'given_names', 'date_of_birth', 'place_of_birth',
  'series', 'number', 'issued_by', 'date_of_issue',
]

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params
  const body = await req.json().catch(() => ({})) as { field?: string }
  const { field } = body

  if (!sessionId) return NextResponse.json({ ok: false, error: 'sessionId required' }, { status: 400 })
  if (!field) return NextResponse.json({ ok: false, error: 'field required' }, { status: 400 })

  const supabase = createAdminSupabaseClient()
  const confirmedAt = new Date().toISOString()

  const { error } = await supabase
    .from('extracted_fields')
    .update({ confirmed: true, confirmed_at: confirmedAt })
    .eq('session_id', sessionId)
    .eq('field', field)

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  // Audit
  await supabase.from('audit_logs').insert({
    session_id: sessionId,
    event_type: 'field_confirmed',
    metadata: { field, confirmed_at: confirmedAt },
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
    confirmed_at: confirmedAt,
    gates: {
      can_certify: canCertify,
      critical_confirmed: criticalConfirmed,
      critical_total: criticalRows.length,
    },
  })
}
