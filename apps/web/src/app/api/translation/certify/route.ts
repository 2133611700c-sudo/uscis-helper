/**
 * POST /api/translation/certify
 * Records the human signer's certification record.
 * Validates completeness before allowing render.
 */
import { NextRequest, NextResponse } from 'next/server'
import { buildCertificationRecord, validateCertificationRecord } from '@/lib/translation/certificationRecord'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { rateLimit, getClientIP } from '@/lib/security/rate-limit'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const ip = getClientIP(req)
  const rl = await rateLimit(`translation_certify:${ip}`, 10, 60_000)
  if (!rl.allowed) return NextResponse.json({ ok: false, error: 'Too many requests' }, { status: 429 })

  const body = await req.json().catch(() => ({})) as {
    session_id?: string
    signer_name?: string
    signer_address?: string
    signer_phone?: string
    signer_email?: string
    source_language?: string
    signature_typed_name?: string
  }

  const { session_id, signer_name, signature_typed_name, source_language } = body

  if (!session_id) return NextResponse.json({ ok: false, error: 'session_id required' }, { status: 400 })
  if (!signer_name) return NextResponse.json({ ok: false, error: 'signer_name required' }, { status: 400 })
  if (!signature_typed_name) return NextResponse.json({ ok: false, error: 'signature_typed_name required' }, { status: 400 })

  const record = buildCertificationRecord({
    signerName: signer_name,
    signerAddress: body.signer_address,
    signerPhone: body.signer_phone,
    signerEmail: body.signer_email,
    sourceLanguage: source_language ?? 'Ukrainian',
    signatureTypedName: signature_typed_name,
  })

  const { valid, errors } = validateCertificationRecord(record)
  if (!valid) {
    return NextResponse.json({ ok: false, error: 'Certification record invalid', details: errors }, { status: 400 })
  }

  // Persist to Supabase
  try {
    const supabase = createAdminSupabaseClient()
    await supabase.from('translation_orders').update({
      certification_record: record,
      status: 'certified',
      updated_at: new Date().toISOString(),
    }).eq('session_id', session_id)
  } catch (err) {
    console.error('[translation/certify] persist failed:', err)
  }

  return NextResponse.json({
    ok: true,
    session_id,
    certified_at: record.signed_at,
    certification_version: record.certification_version,
    message: 'Certification recorded. Payment required before final render.',
  })
}
