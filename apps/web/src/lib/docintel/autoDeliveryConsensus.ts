/**
 * autoDeliveryConsensus.ts — turn the "everything is review_required" product-fatal
 * default into safe AUTO-DELIVERY for fields that are verifiably reliable.
 *
 * THE PROBLEM (measured on the real-doc corpus): the reader produces CORRECT values
 * but ~100% of fields come back review_required=true (handwritten-blanket gate), so
 * AUTO-DELIVER ≈ 0. For 35-80yo no-experience users who will NOT manually correct,
 * the product then delivers nothing.
 *
 * THE SIGNAL: a single read's CONFIDENCE is NOT trustworthy on handwriting — Gemini
 * reports high confidence on a wrong handwritten month. The reliable signal is
 * CROSS-READ CONSENSUS: read the page K times with the primary model and compare per
 * field. A field whose raw source text is IDENTICAL across all reads AND read with
 * high confidence AND carries no hard review reason is reliable → AUTO-DELIVER. A
 * field that VARIES across reads (e.g. the unstable handwritten DOB 07/28 ↔ 05/29) or
 * is low-confidence or flagged → stays review_required.
 *
 * This module is PURE (no IO) and CONSERVATIVE: it ONLY lowers review_required when
 * the consensus is unanimous + confident + clean. It NEVER changes a value, NEVER
 * lowers review on a field carrying a hard reason. Genuinely uncertain fields are
 * never auto-delivered — correctness over coverage on a legal filing.
 */

/** Hard review reasons that must NEVER be auto-delivered, even with consensus. */
const HARD_REVIEW_REASONS = new Set<string>([
  'source_script_ambiguous',
  'canonical_value_unresolved',
  'fallback_model_used',
  'not_read_manual_entry',
  'date_ensemble_disagreement',
  'date_month_disagreement',
  'date_role_conflict',
  'self_consistency_identity_mismatch',
])

/** Normalize a source token for cross-read comparison (case/space/punctuation-insensitive). */
function normToken(s: string | null | undefined): string {
  return (s ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.,;:'"`’ʼ]/g, '')
}

export interface ConsensusField {
  field: string
  value: string | null
  raw_cyrillic?: string | null
  confidence?: number
  review_required?: boolean
  review_reasons?: string[]
}

/** One alternate read's per-field raw source (field → raw_cyrillic/value as read). */
export type ReadSnapshot = Map<string, string | null>

/**
 * Build a snapshot (field → comparable source token) from a read's fields. Accepts
 * both the canonical shape (raw_cyrillic/value) and the raw provider read shape
 * (VisionFieldRead, which carries `cyrillic`), so a re-read can be compared directly.
 */
export function snapshotOf(
  fields: Array<{ field: string; raw_cyrillic?: string | null; cyrillic?: string | null; value?: string | null }>,
): ReadSnapshot {
  const m: ReadSnapshot = new Map()
  for (const f of fields) m.set(f.field, (f.raw_cyrillic ?? f.cyrillic ?? f.value ?? null) as string | null)
  return m
}

export interface ConsensusOpts {
  /** Minimum read confidence to auto-deliver (default 0.90). Below → review. */
  confidenceFloor?: number
  /** If true, critical identity/date fields require consensus too (always true here). */
}

/**
 * Calibrate review_required using cross-read consensus. The PRIMARY read's fields are
 * `fields`; `otherSnapshots` are the same page read again (K-1 more times). A field
 * AUTO-DELIVERS (review_required=false) only if ALL of:
 *   - its source token is IDENTICAL across the primary read and every other read,
 *   - confidence ≥ confidenceFloor,
 *   - it carries NO hard review reason,
 *   - it has a non-null value.
 * Everything else keeps review_required=true. Values are never modified.
 */
export function applyConsensusAutoDelivery<T extends ConsensusField>(
  fields: T[],
  otherSnapshots: ReadSnapshot[],
  opts: ConsensusOpts = {},
): { fields: T[]; auto_delivered: number; reviewed: number } {
  const floor = opts.confidenceFloor ?? 0.9
  let auto = 0
  let rev = 0
  const out = fields.map((f) => {
    const reasons = f.review_reasons ?? []
    const hasHard = reasons.some((r) => HARD_REVIEW_REASONS.has(r))
    const conf = typeof f.confidence === 'number' ? f.confidence : 0
    const mine = normToken(f.raw_cyrillic ?? f.value)
    // Unanimous agreement across all other reads on the SAME source token.
    const agrees =
      mine.length > 0 &&
      otherSnapshots.every((snap) => normToken(snap.get(f.field)) === mine)
    const reliable = agrees && conf >= floor && !hasHard && f.value != null
    if (reliable) {
      auto++
      return { ...f, review_required: false }
    }
    rev++
    // Mark WHY it stayed in review (observability), without changing the value.
    const why = hasHard
      ? reasons
      : !agrees
        ? [...reasons, 'cross_read_disagreement']
        : conf < floor
          ? [...reasons, 'low_confidence']
          : reasons
    return { ...f, review_required: true, ...(why.length ? { review_reasons: Array.from(new Set(why)) } : {}) }
  })
  return { fields: out, auto_delivered: auto, reviewed: rev }
}
