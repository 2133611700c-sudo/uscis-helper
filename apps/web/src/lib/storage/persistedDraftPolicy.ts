/**
 * persistedDraftPolicy.ts — Browser-PII containment policy (Phase A).
 *
 * The 4 product wizards persist OCR-derived draft state in the browser
 * (localStorage / sessionStorage) so that field values survive a reload and
 * the Stripe round-trip. Persisting full extraction internals (raw OCR text,
 * confidence, evidence/source traces) widens the PII exposure window with no
 * functional benefit: the UI only needs the display VALUE + a review flag, and
 * the post-payment carriage only needs the opaque canonical_document_id (and,
 * for the translation operator hand-off, the raw Cyrillic source string).
 *
 * This module is the single source of truth for WHAT a persisted per-field
 * record is allowed to contain. `sanitizeDraftForStorage()` strips everything
 * else BEFORE `setItem`. The guard test (browserPiiGuard.test.ts) asserts the
 * sanitizer drops every prohibited key so a future edit cannot silently start
 * persisting raw OCR text / evidence again.
 *
 * IMPORTANT: This is Phase A (immediate containment). Phase B (server-side
 * session ledger — browser holds only an opaque token) is documented in
 * docs/reports/BROWSER_PII_AUDIT.md and intentionally NOT implemented here.
 */

/** 24h time-to-live for any persisted draft. Older drafts are discarded on load. */
export const DRAFT_TTL_MS = 24 * 60 * 60 * 1000

/**
 * Keys that must NEVER appear on a persisted per-field record. These carry
 * raw OCR text, model internals, or provenance traces — PII-bearing or
 * exposure-widening with no redisplay/carriage need.
 */
export const PROHIBITED_FIELD_KEYS = [
  'evidence',
  'raw_value',
  'rawValue',
  'raw_cyrillic', // allowed ONLY for the translation operator carriage (see policy below)
  'normalized_value',
  'sourceTraces',
  'source_traces',
  'source',
  'source_document_id',
  'source_zone',
  'confidence',
  'ensemble_candidate',
  'review_reasons',
  'kind',
  'passes',
  'ocr_ids',
] as const

export type WizardId = 'tps' | 'reparole' | 'translation' | 'ead'

/**
 * Allowed keys on a persisted per-field record, per wizard.
 *
 * - tps / reparole: {value, requires_review, doc_slot}. doc_slot is a slot
 *   label (passport/i94/…), not PII, and is needed by the slot-contract logic
 *   on restore. No raw / confidence / source.
 * - translation: {field, value, review_required, raw_cyrillic}. raw_cyrillic
 *   is load-bearing CARRIAGE: the post-payment submit-order hand-off resends it
 *   to the operator for the certified translation, so it must survive the
 *   Stripe round-trip. It is the single documented exception and is dropped for
 *   every other wizard.
 * - ead: persists nothing (React-memory only) — listed for completeness.
 */
export const ALLOWED_FIELD_KEYS: Record<WizardId, readonly string[]> = {
  tps: ['value', 'requires_review', 'doc_slot'],
  reparole: ['value', 'requires_review', 'doc_slot'],
  translation: ['field', 'value', 'review_required', 'raw_cyrillic'],
  ead: [],
}

type FieldRecord = Record<string, unknown>

/**
 * Accepts any plain object (including typed interfaces that lack an index
 * signature, e.g. the wizards' `FieldExtraction` / `ExtractedField`). The
 * sanitizer only READS keys, so this is safe.
 */
type AnyFieldLike = object

/**
 * Strip a single per-field record down to the wizard's allowed keys.
 * Anything not on the allowlist (raw OCR, confidence, source traces, …) is
 * dropped. Returns a NEW object — never mutates the input.
 */
export function sanitizeFieldForStorage(
  wizard: WizardId,
  field: AnyFieldLike | null | undefined,
): FieldRecord {
  if (!field || typeof field !== 'object') return {}
  const src = field as FieldRecord
  const allowed = new Set(ALLOWED_FIELD_KEYS[wizard])
  const out: FieldRecord = {}
  for (const k of Object.keys(src)) {
    if (allowed.has(k)) out[k] = src[k]
  }
  return out
}

/**
 * Sanitize a map of per-field records (keyed by canonical field name).
 * Used by the TPS / Re-Parole slot `fields` maps before persisting.
 */
export function sanitizeFieldMapForStorage(
  wizard: WizardId,
  fields: Record<string, AnyFieldLike> | null | undefined,
): Record<string, FieldRecord> {
  const out: Record<string, FieldRecord> = {}
  if (!fields || typeof fields !== 'object') return out
  const src = fields as Record<string, AnyFieldLike>
  for (const k of Object.keys(src)) {
    out[k] = sanitizeFieldForStorage(wizard, src[k])
  }
  return out
}

/**
 * Sanitize a list of per-field records (the Translation `extractedFields[]`).
 */
export function sanitizeFieldListForStorage(
  wizard: WizardId,
  fields: ReadonlyArray<AnyFieldLike> | null | undefined,
): FieldRecord[] {
  if (!Array.isArray(fields)) return []
  return fields.map((f) => sanitizeFieldForStorage(wizard, f))
}

/** True if a persisted draft is older than the TTL and should be discarded. */
export function isDraftExpired(savedAt: string | number | null | undefined, now = Date.now()): boolean {
  if (savedAt == null) return false // no timestamp → cannot judge; keep (back-compat)
  const ts = typeof savedAt === 'number' ? savedAt : Date.parse(savedAt)
  if (!Number.isFinite(ts)) return false
  return now - ts > DRAFT_TTL_MS
}
