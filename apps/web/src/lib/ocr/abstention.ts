/**
 * Track A6 — ONE canonical AbstentionReason for the document-translation product.
 *
 * The codebase has accumulated many free-text review/abstention strings
 * (mrz_check_failed, fabricated, not_read_manual_entry, fallback_model_used, …).
 * This module gives them a single typed vocabulary WITHOUT losing the original
 * string (audit-preserving): mapAbstentionReason() returns the canonical enum + the
 * verbatim original. Classification only — it does NOT decide null vs value; the
 * fail-closed behaviour stays in the existing gates (anti-fabrication, finalPdfGate,
 * C3). Pure functions, no I/O.
 */

export enum AbstentionReason {
  LOW_IMAGE_QUALITY = 'LOW_IMAGE_QUALITY',
  HANDWRITING_UNREADABLE = 'HANDWRITING_UNREADABLE',
  NO_SOURCE_EVIDENCE = 'NO_SOURCE_EVIDENCE',
  ENGINE_DISAGREEMENT = 'ENGINE_DISAGREEMENT',
  SCRIPT_AMBIGUITY = 'SCRIPT_AMBIGUITY',
  UNKNOWN_DOCUMENT_TYPE = 'UNKNOWN_DOCUMENT_TYPE',
  FIELD_NOT_PRESENT = 'FIELD_NOT_PRESENT',
  PROVIDER_FAILURE = 'PROVIDER_FAILURE',
  UNSUPPORTED_DOCUMENT = 'UNSUPPORTED_DOCUMENT',
  MANUAL_ENTRY_REQUIRED = 'MANUAL_ENTRY_REQUIRED',
}

export interface MappedAbstention {
  reason: AbstentionReason
  /** the verbatim original reason string (audit — never dropped). */
  original: string
}

/**
 * Ordered substring rules (first match wins). Specific → general. Anything
 * unmatched falls back to MANUAL_ENTRY_REQUIRED (safe: route to a human), never to a
 * "confident" classification.
 */
const RULES: ReadonlyArray<[RegExp, AbstentionReason]> = [
  [/image[_-]?quality|low[_-]?quality|blur|too[_-]?small|retake/i, AbstentionReason.LOW_IMAGE_QUALITY],
  [/handwrit|cursive|\bhtr\b/i, AbstentionReason.HANDWRITING_UNREADABLE],
  [/fabricat|no[_-]?source|no[_-]?evidence|unread|not[_-]?read|empty[_-]?source/i, AbstentionReason.NO_SOURCE_EVIDENCE],
  [/mrz[_-]?mismatch|mrz[_-]?check|disagree|conflict|provider[_-]?conflict|consensus/i, AbstentionReason.ENGINE_DISAGREEMENT],
  [/script[_-]?ambig|mixed[_-]?script|homoglyph|ru[_-]?ua[_-]?ambig/i, AbstentionReason.SCRIPT_AMBIGUITY],
  [/unknown[_-]?(document|template|doc[_-]?type)/i, AbstentionReason.UNKNOWN_DOCUMENT_TYPE],
  [/unsupported|not[_-]?supported/i, AbstentionReason.UNSUPPORTED_DOCUMENT],
  [/not[_-]?present|field[_-]?absent|not[_-]?applicable|missing[_-]?field/i, AbstentionReason.FIELD_NOT_PRESENT],
  [/provider[_-]?failure|fallback[_-]?model|provider[_-]?error|timeout|429|5\d\d|unavailable/i, AbstentionReason.PROVIDER_FAILURE],
  [/manual[_-]?entry|manual[_-]?review|needs[_-]?review|requires[_-]?review|route[_-]?to[_-]?manual|force[_-]?review|always[_-]?review|low[_-]?final[_-]?confidence|c3[_-]?rejected/i, AbstentionReason.MANUAL_ENTRY_REQUIRED],
]

/** Map a single free-text reason → canonical, preserving the original verbatim. */
export function mapAbstentionReason(raw: string | null | undefined): MappedAbstention | null {
  const original = (raw ?? '').trim()
  if (!original) return null
  for (const [re, reason] of RULES) if (re.test(original)) return { reason, original }
  // Unrecognized → require a human; never silently treat as confident.
  return { reason: AbstentionReason.MANUAL_ENTRY_REQUIRED, original }
}

/** Map a set of free-text reasons → unique canonical reasons (originals preserved). */
export function mapAbstentionReasons(raws: ReadonlyArray<string | null | undefined>): MappedAbstention[] {
  const out: MappedAbstention[] = []
  const seen = new Set<string>()
  for (const r of raws) {
    const m = mapAbstentionReason(r)
    if (m && !seen.has(`${m.reason}::${m.original}`)) { seen.add(`${m.reason}::${m.original}`); out.push(m) }
  }
  return out
}

/** Is this a value the product may NEVER auto-confirm (always needs a human)? */
export function blocksAutoConfirm(reason: AbstentionReason): boolean {
  // Every abstention reason blocks auto-confirm by definition (fail-closed).
  return Object.values(AbstentionReason).includes(reason)
}
