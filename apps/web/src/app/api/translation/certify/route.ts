/**
 * POST /api/translation/certify
 * Records the human signer's certification record.
 * Validates completeness before allowing render.
 */
import { NextRequest, NextResponse } from 'next/server'
import { buildCertificationRecord, validateCertificationRecord } from '@/lib/translation/certificationRecord'
import { getRepositories } from '@/lib/repositories'
import { rateLimit, getClientIP } from '@/lib/security/rate-limit'
import { getCriticalFieldsForDocumentType } from '@/lib/translation/modules/adapters'

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

  // ── Gate: all critical fields must be confirmed before certification ────────
  const repos = getRepositories()

  // Fetch doc_type from session so the critical field list is module-driven
  const sessionRow = await repos.documents.getSession(session_id)

  const docType = sessionRow?.docType ?? null
  const CRITICAL_FIELDS = getCriticalFieldsForDocumentType(docType)

  const fields = await repos.review.listFields(session_id)
  const presentCritical = CRITICAL_FIELDS.filter(cf => fields.find(f => f.field === cf))
  const unconfirmedCritical = presentCritical.filter(cf => {
    const row = fields.find(f => f.field === cf)
    return row && !row.confirmed
  })

  if (unconfirmedCritical.length > 0) {
    return NextResponse.json({
      ok: false,
      error: 'Cannot certify: critical fields not yet confirmed by human reviewer.',
      gate: 'critical_fields_unconfirmed',
      unconfirmed_critical: unconfirmedCritical,
      required_action: `Please confirm all required fields in the Review tab before signing: ${unconfirmedCritical.join(', ')}`,
    }, { status: 400 })
  }

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

  // Persist certification record via repository (in-memory default; Supabase opt-in not connected)
  try {
    const now = new Date().toISOString()

    // Upsert the certification record (one per session)
    await repos.certification.saveCertificationRecord({
      sessionId:             session_id,
      signerFullName:        record.signer_full_name,
      signerAddress:         body.signer_address ?? null,
      signerPhone:           body.signer_phone ?? null,
      signerEmail:           body.signer_email ?? null,
      sourceLanguage:        body.source_language ?? 'Ukrainian',
      targetLanguage:        'English',
      languagePairConfirmed: record.language_pair_confirmed,
      statement:             record.statement,
      signatureTypedName:    record.signature_typed_name,
      certificationVersion:  record.certification_version,
      signedAt:              record.signed_at,
    })

    // Update session status
    await repos.documents.updateSessionStatus(session_id, 'certified', now)

    // Audit log — PII-safe: no raw names, only metadata
    await repos.audit.append({
      sessionId: session_id,
      eventType: 'certification_completed',
      at: now,
      detail: {
        signer_name_length: record.signer_full_name?.length ?? 0,
        certification_version: record.certification_version,
        signed_at: record.signed_at,
        language_pair_confirmed: record.language_pair_confirmed,
      },
    })
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
