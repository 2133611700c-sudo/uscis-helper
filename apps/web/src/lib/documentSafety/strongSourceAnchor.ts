/**
 * documentSafety/strongSourceAnchor — R7: the real anchor model.
 *
 * Background: C3 (protectOcrField) treats a critical field with no `strong_source_anchor`
 * as SOFT-unsafe (no_strong_source_anchor → candidate_only). Until R7 the only anchor was a
 * valid MRZ (set per-field by the arbiter/route); every NON-MRZ critical was structurally
 * unanchored, so even a gazetteer-EXACT place or a math-checked date could never accept_final.
 *
 * R7 widens "strong anchor" to ANY of the following hard evidence signals:
 *   - MRZ-valid           (the source field came from a check-digit-valid MRZ),
 *   - consensus_reliable  (cross-read consensus vouched for the read — R4 marker),
 *   - dictionary-EXACT    (D2 provenance ∈ {gazetteer_exact, authority_dict}),
 *   - date passed guards  (a date field carrying NO date role/sequence conflict reason).
 *
 * GATED: this is only consulted when the caller passes flagOn=true (DICTIONARY_CLEARS_SOFT_REVIEW,
 * the R6/R7 sibling). flagOn=false → returns false → C3 sees today's MRZ-only anchoring, prod
 * byte-identical. Pure, PII-free (reads only provenance/source/reason metadata, never a value).
 */

/** D2 provenance tags that are EXACT, authoritative matches (not fuzzy / not derived). */
const EXACT_PROVENANCE = new Set<string>(['gazetteer_exact', 'authority_dict'])

/** Date role/sequence conflict reasons — a date carrying ANY of these did NOT pass the guards. */
const DATE_CONFLICT_REASONS = new Set<string>([
  'date_role_conflict',
  'date_sequence_conflict',
  'date_ensemble_disagreement',
  'date_month_disagreement',
])

function isDateField(key: string): boolean {
  const k = (key || '').toLowerCase()
  return /(^|_)(dob|date|expiry|expiration|issue|valid_from|valid_to|marriage)(_|$)/.test(k) ||
    k.includes('date_of_') || k.includes('_date')
}

export interface AnchorInputField {
  key: string
  /** SourceKind — 'mrz' for an MRZ-controlled field. */
  source?: string
  /** Did the MRZ check digit(s) pass (set on MRZ-controlled fields). */
  mrzCheckValid?: boolean
  /** R4 cross-read consensus marker. */
  consensus_reliable?: boolean
  /** D2 knowledge provenance tag. */
  knowledgeProvenance?: string
  /** Review reasons (used to detect date-guard conflicts). */
  reviewReasons?: string[]
}

/**
 * Compute the strong-source-anchor for one field.
 * flagOn=false → false (today: MRZ-only anchoring handled elsewhere; this helper is a no-op).
 * flagOn=true  → true when ANY hard-evidence signal is present (see module doc).
 */
export function computeStrongSourceAnchor(f: AnchorInputField, flagOn: boolean): boolean {
  if (!flagOn) return false

  // MRZ-valid: the field is MRZ-controlled and its check digits passed.
  if (f.source === 'mrz' && f.mrzCheckValid === true) return true

  // Cross-read consensus (R4 marker).
  if (f.consensus_reliable === true) return true

  // Dictionary-EXACT: gazetteer_exact / known authority.
  if (f.knowledgeProvenance && EXACT_PROVENANCE.has(f.knowledgeProvenance)) return true

  // A date that passed role+sequence guards: it IS a date field AND carries no
  // date-conflict reason. (A non-date field is never anchored by this clause.)
  if (isDateField(f.key)) {
    const reasons = f.reviewReasons ?? []
    const hasDateConflict = reasons.some((r) => DATE_CONFLICT_REASONS.has(r))
    if (!hasDateConflict) return true
  }

  return false
}
