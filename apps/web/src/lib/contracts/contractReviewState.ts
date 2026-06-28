/**
 * Phase 8 — review states + raw→PDF safety for the unified contract.
 *
 * 1. contractReviewState() maps a field to ONE explicit state the review UI consumes:
 *    candidate | confirmed | missing | unreadable | not_applicable | conflict.
 * 2. mustAlwaysReview() — critical HANDWRITTEN contract fields are ALWAYS
 *    reviewRequired (Constitution L6 + ADR-026), regardless of model confidence.
 * 3. shouldBlockRawPdfFallback() — when the unified contract is ON, a certificate
 *    doc may NOT fall back to the raw generic PDF; the final PDF is allowed ONLY
 *    from the schema/mirror (validated) path. Flag OFF → never blocks (identical).
 *
 * Pure functions; no I/O. No OCR/model/PDF-layout change.
 */
import {
  birthCertSovietV1Contract,
  fieldByRuntimeKey,
  readKeyToRuntime,
  isUnifiedDocContractEnabled,
  BIRTH_CERT_LEGACY_DOCTYPE,
} from './birthCertSovietV1Contract'

export type ContractFieldState =
  | 'candidate'
  | 'confirmed'
  | 'missing'
  | 'unreadable'
  | 'not_applicable'
  | 'conflict'

export interface ReviewLike {
  field?: string
  value?: string | null
  raw_cyrillic?: string | null
  review_required?: boolean | null
  confirmed?: boolean | null
  not_applicable?: boolean | null
  review_reasons?: string[] | null
}

const has = (s: string | null | undefined): boolean => !!s && s.trim().length > 0

/** Map a field to a single explicit review state. */
export function contractReviewState(f: ReviewLike): ContractFieldState {
  if (f.not_applicable === true) return 'not_applicable'
  if (f.review_reasons?.includes('conflict')) return 'conflict'
  if (f.confirmed === true) return 'confirmed'
  const hasRaw = has(f.raw_cyrillic)
  const hasVal = has(f.value)
  if (!hasRaw && !hasVal) return 'missing'
  if (hasRaw && !hasVal) return 'unreadable' // read something, no releasable value
  return 'candidate' // has a value, pending human confirmation
}

/** Resolve a field key (runtimeKey OR legacy read-side key) to its contract entry. */
function contractEntryFor(fieldKey: string) {
  return fieldByRuntimeKey(fieldKey) ?? fieldByRuntimeKey(readKeyToRuntime(fieldKey) ?? '')
}

/** Critical HANDWRITTEN contract fields are ALWAYS review-required. */
export function mustAlwaysReview(fieldKey: string): boolean {
  const e = contractEntryFor(fieldKey)
  if (!e) return false
  return e.alwaysReview === true || (e.criticality === 'critical' && e.rendering === 'handwritten')
}

/** All critical-handwritten contract field runtimeKeys (for guards/tests). */
export function alwaysReviewRuntimeKeys(): string[] {
  return birthCertSovietV1Contract
    .filter((f) => f.alwaysReview === true || (f.criticality === 'critical' && f.rendering === 'handwritten'))
    .map((f) => f.runtimeKey)
}

// ── Workstream A: annotate live review rows from the contract (flag-gated) ──────
//
// Merged extraction keys that are FULLY decomposed by the split (nothing editable
// remains on the merged field once its children exist) → mark evidence_only so the
// merged value is kept as read-only evidence, not a second editable duplicate.
const FULLY_SPLIT_MERGED: Record<string, string[]> = {
  certificate_series_number: ['document_series', 'document_number'],
  series_number: ['document_series', 'document_number'],
}

export interface AnnotatedReviewRow {
  field: string
  raw_value?: string | null
  normalized_value?: string | null
  review_required?: boolean | null
  confirmed?: boolean | null
  not_applicable?: boolean | null
  review_reasons?: string[] | null
  contract_review_state?: ContractFieldState
  /** merged legacy value kept as read-only evidence (its split children exist). */
  evidence_only?: boolean
}

/**
 * Add contract_review_state + evidence_only to review rows. Flag-gated on
 * UNIFIED_DOC_CONTRACT_ENABLED → OFF returns rows unchanged (same reference).
 */
export function annotateReviewFields<T extends AnnotatedReviewRow>(
  rows: T[],
  env: Record<string, string | undefined> = process.env,
): T[] {
  if (!isUnifiedDocContractEnabled(env)) return rows
  const present = new Set(rows.map((r) => r.field))
  return rows.map((r) => {
    const state = contractReviewState({
      field: r.field,
      value: r.normalized_value ?? null,
      raw_cyrillic: r.raw_value ?? null,
      review_required: r.review_required,
      confirmed: r.confirmed,
      not_applicable: r.not_applicable,
      review_reasons: r.review_reasons,
    })
    const children = FULLY_SPLIT_MERGED[r.field]
    const evidence_only = !!children && children.every((c) => present.has(c))
    return { ...r, contract_review_state: state, evidence_only }
  })
}

const CONTRACT_CERT_DOCTYPES = new Set<string>([BIRTH_CERT_LEGACY_DOCTYPE])

/**
 * When the unified contract is ON, a certificate may NOT emit a raw generic PDF —
 * the final PDF must come from the validated schema/mirror path. OFF → false.
 */
export function shouldBlockRawPdfFallback(
  docType: string | null | undefined,
  env: Record<string, string | undefined> = process.env,
): boolean {
  if (!isUnifiedDocContractEnabled(env)) return false
  return CONTRACT_CERT_DOCTYPES.has(docType ?? '')
}
