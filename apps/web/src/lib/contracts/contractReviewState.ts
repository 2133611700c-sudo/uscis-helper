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
