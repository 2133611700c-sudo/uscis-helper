/**
 * Phase 10 / Workstream B — single server-side confirmation boundary for the
 * FINAL PDF. Every renderer (mirror, official translation, generic) must pass a
 * document through assertDocumentReadyForFinalPdf BEFORE emitting a downloadable/
 * final PDF (or a preview equivalent to the final).
 *
 * Gate flag: FINAL_PDF_CONFIRMATION_GATE_ENABLED (default OFF).
 *   OFF → { ready:true, enforced:false } so callers keep their legacy gates and the
 *         OFF golden stays byte-identical.
 *   ON  → enforce: a final PDF is allowed ONLY from a confirmed, validated, non-raw
 *         document. The check is server-side; callers MUST feed server-persisted
 *         fields, never blindly the client payload (a client cannot grant 'confirmed').
 *
 * Reuses existing safety primitives: classifyCriticality (applyOcrFieldSafety),
 * contractReviewState / mustAlwaysReview (contractReviewState.ts). No OCR/model/
 * PDF-layout change. Pure function.
 */
import { classifyCriticality } from '@/lib/documentSafety/applyOcrFieldSafety'
import { contractReviewState, mustAlwaysReview } from './contractReviewState'

export function isFinalPdfConfirmationGateEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.FINAL_PDF_CONFIRMATION_GATE_ENABLED === '1'
}

/** Minimal field shape the gate inspects (server-persisted ExtractedField subset). */
export interface FinalPdfField {
  field: string
  raw_value?: string | null
  normalized_value?: string | null
  final_value?: string | null
  review_required?: boolean | null
  confirmed?: boolean | null
  review_reasons?: string[] | null
  not_applicable?: boolean | null
}

export interface FinalPdfGateResult {
  ready: boolean
  enforced: boolean
  blockedReasons: string[]
  /** field-key → reason, for observability (PII-free: keys only). */
  blockedFields: Array<{ field: string; reason: string }>
}

const isCritical = (field: string): boolean => {
  const c = classifyCriticality(field)
  return c === 'critical_identity' || c === 'critical_document'
}

const hasValue = (f: FinalPdfField): boolean =>
  !!((f.final_value ?? f.normalized_value ?? f.raw_value ?? '').toString().trim())

const releasable = (f: FinalPdfField): boolean =>
  !!((f.final_value ?? f.normalized_value ?? '').toString().trim())

/**
 * Decide whether a document may be rendered to a FINAL PDF. OFF → always ready
 * (legacy). ON → block unless every safety condition holds.
 */
export function assertDocumentReadyForFinalPdf(
  fields: FinalPdfField[],
  docType: string | null | undefined,
  env: Record<string, string | undefined> = process.env,
): FinalPdfGateResult {
  if (!isFinalPdfConfirmationGateEnabled(env)) {
    return { ready: true, enforced: false, blockedReasons: [], blockedFields: [] }
  }

  const blockedFields: Array<{ field: string; reason: string }> = []
  const add = (field: string, reason: string) => blockedFields.push({ field, reason })

  // raw-only document: nothing has a releasable (normalized/confirmed) value.
  if (fields.length === 0 || !fields.some(releasable)) {
    add('*', 'raw_only_document')
  }

  for (const f of fields) {
    const state = contractReviewState({
      field: f.field,
      value: f.normalized_value ?? f.final_value ?? null,
      raw_cyrillic: f.raw_value ?? null,
      review_required: f.review_required,
      confirmed: f.confirmed,
      not_applicable: f.not_applicable,
      review_reasons: f.review_reasons,
    })
    const critical = isCritical(f.field)
    const needsReview = f.review_required === true || mustAlwaysReview(f.field)

    // forged client payload: claims confirmed but carries no usable value.
    if (f.confirmed === true && !hasValue(f)) { add(f.field, 'forged_confirmed_empty'); continue }
    // unresolved conflict anywhere → block.
    if (state === 'conflict') { add(f.field, 'unresolved_conflict'); continue }
    if (!critical) continue
    // critical-field rules:
    if (state === 'missing') { add(f.field, 'missing_mandatory'); continue }
    if (state === 'unreadable') { add(f.field, 'unreadable_mandatory'); continue }
    if (needsReview && f.confirmed !== true) { add(f.field, 'unconfirmed_critical'); continue }
  }

  const blockedReasons = [...new Set(blockedFields.map((b) => b.reason))]
  return { ready: blockedReasons.length === 0, enforced: true, blockedReasons, blockedFields }
}
