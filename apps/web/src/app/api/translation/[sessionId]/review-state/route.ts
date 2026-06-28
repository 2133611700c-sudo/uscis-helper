/**
 * GET /api/translation/[sessionId]/review-state
 *
 * Returns full review state for the Evidence Review UI:
 *   - session metadata (status, doc_type, scope_title)
 *   - extracted_fields with confirmation status
 *   - uploaded document storage URL (signed, 1hr)
 *   - certification_record (if exists)
 *   - payment_confirmed
 *   - review_progress: { total, confirmed, critical_total, critical_confirmed }
 *   - gates: { can_certify, can_render, missing_confirmations }
 *
 * Hard rule: no raw DB row returned. All PII fields are present by design
 * (this is the translator's own work product).
 */
import { NextRequest, NextResponse } from 'next/server'
import { getRepositories } from '@/lib/repositories'
// CANONICAL_OVERRIDE_LOOP (P1): resolve the canonical_document_id for this session so
// the review UI can thread it into correct-field/confirm-field (dual-write). Only
// resolved when the flag is on; absent/null → UI sends nothing → legacy-only (fail-safe).
import { getOverrideLoopMode } from '@/lib/canonical/overrideLoopMode'
import { getCanonicalDocumentId } from '@/lib/canonical/persistence'
import { annotateReviewFields } from '@/lib/contracts/contractReviewState'

export const dynamic = 'force-dynamic'

const CRITICAL_FIELDS = [
  'surname', 'given_names', 'date_of_birth', 'place_of_birth',
  'series', 'number', 'issued_by', 'date_of_issue',
]

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params
  if (!sessionId) {
    return NextResponse.json({ ok: false, error: 'sessionId required' }, { status: 400 })
  }

  const repos = getRepositories()

  // Load session
  const sessionRec = await repos.documents.getSession(sessionId)
  if (!sessionRec) {
    return NextResponse.json({ ok: false, error: 'Session not found' }, { status: 404 })
  }
  // Re-shape to the snake_case the response contract exposes.
  const session = {
    session_id: sessionRec.sessionId,
    status: sessionRec.status,
    doc_type: sessionRec.docType,
    scope_title: sessionRec.scopeTitle ?? null,
    payment_confirmed: sessionRec.paymentConfirmed ?? false,
    uploaded_pages: sessionRec.uploadedPages ?? null,
    created_at: sessionRec.createdAt,
    updated_at: sessionRec.updatedAt,
  }

  // Load extracted fields (evidence_type + bbox_status added in Phase 1 migration)
  const fieldRecords = await repos.review.listFields(sessionId)
  // newest-first stability is not required here; keep insertion order via createdAt when present
  const fields = [...fieldRecords]
    .sort((a, b) => ((a.createdAt ?? '') < (b.createdAt ?? '') ? -1 : 1))
    .map(f => ({
      id: f.id ?? null,
      field: f.field,
      source_label: f.sourceLabel ?? null,
      source_zone: f.sourceZone ?? null,
      raw_value: f.rawValue,
      normalized_value: f.normalizedValue,
      language_layer: f.languageLayer ?? null,
      confidence: f.confidence ?? null,
      review_required: f.reviewRequired,
      confirmed: f.confirmed,
      confirmed_at: f.confirmedAt ?? null,
      evidence_type: f.evidenceType ?? null,
      bbox_status: f.bboxStatus ?? null,
      created_at: f.createdAt ?? null,
    }))

  // Load most-recent uploaded document for image preview
  const latestDoc = await repos.documents.getLatestDocument(sessionId)
  let documentImageUrl: string | null = null
  if (latestDoc) {
    documentImageUrl = await repos.storage.createSignedUrl('translation-documents', latestDoc.storageKey, 3600)
  }

  // Load certification record
  const certRec = await repos.certification.getCertificationRecord(sessionId)
  const certData = certRec
    ? {
        signer_full_name: certRec.signerFullName,
        signer_address: certRec.signerAddress,
        signer_phone: certRec.signerPhone,
        signer_email: certRec.signerEmail,
        source_language: certRec.sourceLanguage,
        signature_typed_name: certRec.signatureTypedName,
        certification_version: certRec.certificationVersion,
        signed_at: certRec.signedAt,
      }
    : null

  // Compute review progress
  const totalFields = fields.length
  const confirmedFields = fields.filter(f => f.confirmed).length
  const criticalRows = fields.filter(f => CRITICAL_FIELDS.includes(f.field))
  const criticalTotal = criticalRows.length
  const criticalConfirmed = criticalRows.filter(f => f.confirmed).length

  const unconfirmedCritical = CRITICAL_FIELDS.filter(cf => {
    const row = fields.find(f => f.field === cf)
    return row && !row.confirmed
  })

  const missingCritical = CRITICAL_FIELDS.filter(cf => !fields.find(f => f.field === cf))

  const canCertify =
    criticalTotal > 0 &&
    criticalConfirmed === criticalTotal &&
    unconfirmedCritical.length === 0

  const canRender =
    canCertify &&
    Boolean(certData) &&
    Boolean(session.payment_confirmed)

  // CANONICAL_OVERRIDE_LOOP (P1): best-effort resolve the canonical document id so
  // the UI can dual-write corrections into the canonical chain. Flag OFF → null
  // (UI sends nothing → legacy-only). A lookup failure is swallowed → null (fail-safe).
  let canonicalDocumentId: string | null = null
  if (getOverrideLoopMode() !== 'off' && session.doc_type) {
    try {
      canonicalDocumentId = await getCanonicalDocumentId(sessionId, session.doc_type as string)
    } catch {
      canonicalDocumentId = null
    }
  }

  return NextResponse.json({
    ok: true,
    canonical_document_id: canonicalDocumentId,
    session: {
      session_id: session.session_id,
      status: session.status,
      doc_type: session.doc_type,
      scope_title: session.scope_title,
      payment_confirmed: session.payment_confirmed,
      uploaded_pages: session.uploaded_pages,
      created_at: session.created_at,
      updated_at: session.updated_at,
    },
    // Workstream A — annotate rows with contract_review_state + evidence_only
    // (flag UNIFIED_DOC_CONTRACT_ENABLED, default OFF → rows unchanged).
    fields: annotateReviewFields(fields.map(f => ({
      id: f.id,
      field: f.field,
      source_label: f.source_label,
      source_zone: f.source_zone,
      raw_value: f.raw_value,
      normalized_value: f.normalized_value,
      language_layer: f.language_layer,
      confidence: f.confidence,
      review_required: f.review_required,
      confirmed: f.confirmed,
      confirmed_at: f.confirmed_at,
      // Phase 1 evidence provenance — may be null for pre-Phase-1 rows
      evidence_type: (f as Record<string, unknown>).evidence_type ?? null,
      bbox_status: (f as Record<string, unknown>).bbox_status ?? null,
      is_critical: CRITICAL_FIELDS.includes(f.field),
    }))),
    document_image_url: documentImageUrl,
    certification_record: certData ?? null,
    review_progress: {
      total: totalFields,
      confirmed: confirmedFields,
      critical_total: criticalTotal,
      critical_confirmed: criticalConfirmed,
      percent: totalFields > 0 ? Math.round((confirmedFields / totalFields) * 100) : 0,
    },
    gates: {
      can_certify: canCertify,
      can_render: canRender,
      unconfirmed_critical: unconfirmedCritical,
      missing_critical: missingCritical,
    },
  })
}
