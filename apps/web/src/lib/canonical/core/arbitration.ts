/**
 * canonical/core/arbitration.ts — the Core's judge (minimal authority policy, v1).
 *
 * Principle rules (knowable a priori, written now — see ONE_BRAIN_DECISION.md §5):
 *   1. valid MRZ controls passport MRZ fields.
 *   2. invalid MRZ → review (red flag), NOT silent fallback.
 *   3. a critical field with NO MRZ anchor → review (don't auto-trust an LLM on a
 *      critical legal field without a math anchor).
 *   4. a material conflict among candidates on a critical/high field → review.
 *   5. a fuzzy candidate → review.
 *   6. no candidate → no field (Law 1: no source → no recognized field).
 *
 * Empirical knobs (confidence thresholds, when-to-trust-Gemini-without-MRZ) come
 * LATER from the reader benchmark — not hard-coded by belief.
 *
 * Pure. Reuses lib/canonical/policy.ts (criticalityOf, materiallyDifferent,
 * sourceRank, buildConfidence).
 */
import type { CanonicalField, FieldEvidence } from '../types'
import { criticalityOf, materiallyDifferent, sourceRank, buildConfidence, REVIEW_THRESHOLD } from '../policy'
import type { FieldCandidate } from './types'

/** Fields the passport MRZ controls when its check digits are valid. */
export const PASSPORT_MRZ_FIELDS: ReadonlySet<string> = new Set([
  'passport_number',
  'date_of_birth',
  'dob',
  'date_of_expiry',
  'passport_expiration_date',
  'sex',
  'family_name',
  'given_name',
  'nationality',
  'country_of_nationality',
])

function toEvidence(c: FieldCandidate): FieldEvidence {
  return { value: c.value, source: c.source, confidence: c.confidence, provider: c.provider }
}

/**
 * Resolve ONE field from its candidates per the minimal authority policy.
 * Returns null when there is no usable candidate (no source → no field).
 */
export function arbitrateField(key: string, candidates: FieldCandidate[]): CanonicalField | null {
  const usable = candidates.filter((c) => (c.value ?? '').trim() !== '')
  if (usable.length === 0) return null

  const crit = criticalityOf(key)
  const evidence = usable.map(toEvidence)
  const reasons: string[] = []
  const mrz = usable.find((c) => c.source === 'mrz')

  // ── MRZ-controlled field with an MRZ candidate ────────────────────────────
  if (PASSPORT_MRZ_FIELDS.has(key) && mrz) {
    if (mrz.mrzCheckValid === true) {
      // valid MRZ = math authority → it wins; disagreement does not override it.
      return field(key, mrz.value, mrz.source, crit, false, [], evidence, mrz.confidence ?? 0.99)
    }
    // invalid MRZ = red flag (bad photo / OCR / tampering) → must be reviewed.
    reasons.push('mrz_check_failed')
    return field(key, mrz.value, mrz.source, crit, true, reasons, evidence, 0.3)
  }

  // ── No MRZ anchor: pick the highest-authority candidate ────────────────────
  const primary = [...usable].sort((a, b) => {
    const r = sourceRank(b.source) - sourceRank(a.source)
    if (r !== 0) return r
    return (b.confidence ?? 0) - (a.confidence ?? 0)
  })[0]

  // critical field with no math anchor → cannot be auto-trusted.
  if (crit === 'critical') reasons.push('critical_no_mrz_anchor')

  // material conflict on a critical/high field → review.
  const distinct = new Set(usable.map((c) => normalize(c.value)))
  if (distinct.size > 1 && (crit === 'critical' || crit === 'high')) reasons.push('provider_conflict')

  // fuzzy candidate → review.
  if (primary.fuzzy) reasons.push('fuzzy_match')

  // confidence-based review for critical/high.
  const conf = primary.confidence ?? 0
  if ((crit === 'critical' || crit === 'high') && conf < REVIEW_THRESHOLD && !reasons.includes('low_confidence')) {
    reasons.push('low_confidence')
  }

  // carry through reader-level review signals — if the reader already flagged
  // this candidate as needing review, the Core inherits that signal.
  if (primary.reviewRequired && primary.reviewReasons?.length) {
    for (const r of primary.reviewReasons) if (!reasons.includes(r)) reasons.push(r)
  } else if (primary.reviewRequired) {
    reasons.push('reader_review_required')
  }

  return field(key, primary.value, primary.source, crit, reasons.length > 0, reasons, evidence, conf)
}

/** Arbitrate every field key present in the candidate set. */
export function arbitrateDocument(candidates: FieldCandidate[]): CanonicalField[] {
  const byKey = new Map<string, FieldCandidate[]>()
  for (const c of candidates) {
    const arr = byKey.get(c.key)
    if (arr) arr.push(c)
    else byKey.set(c.key, [c])
  }
  const out: CanonicalField[] = []
  for (const [key, group] of byKey) {
    const f = arbitrateField(key, group)
    if (f) out.push(f)
  }
  return out
}

// ── helpers ────────────────────────────────────────────────────────────────
function normalize(s: string): string {
  return (s ?? '').normalize('NFC').replace(/\s+/g, '').toLocaleLowerCase()
}

function field(
  key: string,
  value: string,
  source: CanonicalField['source'],
  criticality: CanonicalField['criticality'],
  reviewRequired: boolean,
  reviewReasons: string[],
  evidence: FieldEvidence[],
  finalConf: number,
): CanonicalField {
  return {
    key,
    rawValue: value,
    // v1: arbitration picks the value; KMU-55 normalization of a Cyrillic
    // candidate is a downstream step, not the arbiter's job.
    normalizedValue: value,
    criticality,
    confidence: buildConfidence({ ocr: finalConf, field_match: null, normalization: null, source_match: null }),
    source,
    reviewRequired,
    reviewReasons,
    evidence,
  }
}
