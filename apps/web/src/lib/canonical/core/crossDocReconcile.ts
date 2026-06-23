/**
 * canonical/core/crossDocReconcile.ts — STAGE 3 cross-document reconciliation engine.
 *
 * THE BIGGEST REMAINING ACCURACY LEVER (RECOGNITION_MASTER_PLAN_2026-06-22.md §PART 3/4
 * STAGE 3, §PART 5 ua_birth_certificate "CROSS-DOC: if a passport/MRZ for the same person
 * exists, its checksummed DOB is authoritative"). Today each document is read in ISOLATION;
 * this module lets a HIGH-CONFIDENCE anchor from one of a person's documents (e.g. an
 * MRZ-checksum-validated passport date of birth) RESOLVE / VALIDATE the ambiguous
 * handwritten field of that SAME person's other documents (e.g. a faded birth-cert DOB the
 * model held for review).
 *
 * HARD INVARIANTS (CONSTITUTION L5/L6/L7/L8):
 *   - ADDITIVE, behind CROSS_DOC_RECONCILE_ENABLED, default OFF. flagOn=false ⇒ NO changes
 *     (byte-identical pass-through). No behavior change when off.
 *   - It RAISES confidence / fills a HELD field ONLY from a strictly-STRONGER anchor.
 *   - It NEVER overwrites a confidently-read value (L6: a confident read is not touched).
 *   - It NEVER invents a value no document produced (L6: never fabricate).
 *   - It writes ONLY `suggestedValue` + provenance `cross_doc_reconciled` and KEEPS
 *     reviewRequired=true → the cross-doc fill is a ONE-CLICK CONFIRM pre-filled from the
 *     passport, NOT a silent auto-apply. C3 (L5) remains the single writer of final_value;
 *     this module never writes finalValue.
 *
 * NAME-SCRIPT GUARD (CONSTITUTION L8 — SOURCE-FAITHFUL TRANSCRIPTION; CLAUDE.md HARD RULE
 * "Self-name on .gov.ua beats any third-party reference" / RU-vs-UA never silently convert):
 * a NAME anchor only reconciles across docs in the SAME SOURCE SCRIPT/language. A Ukrainian
 * passport's "Serhii" (raw Cyrillic Сергій) must NOT be pushed onto a Russian Soviet-era
 * birth-cert's "Sergey" (raw Cyrillic Сергей) — that is the RU/UA distinction the project
 * forbids harmonizing. DATES and NUMBERS are language-neutral and reconcile freely; only
 * NAME/PLACE reconciliation is gated on matching source script (detectNameScript on
 * rawCyrillic). When scripts differ or either is unknown → NO name reconciliation.
 *
 * Pure module. No I/O. Reuses detectNameScript from @uscis-helper/knowledge.
 */
import type { CanonicalField } from '../types'
import { detectNameScript } from '@uscis-helper/knowledge'

/** Feature flag (CONSTITUTION: additive, default OFF). */
export function isCrossDocReconcileEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.CROSS_DOC_RECONCILE_ENABLED === '1'
}

/**
 * Anchor strength ranking — STRICTLY STRONGER is the only direction a value flows.
 * Higher number = stronger authority (math-checked > printed > dictionary > consensus >
 * uncertain handwriting). A field is reconciled FROM an anchor only when the anchor's
 * strength is strictly greater than the receiving field's strength.
 */
export const ANCHOR_STRENGTH = {
  mrz_validated: 5, // MRZ check digits passed — the math anchor (L7 controlling)
  printed: 4, // printed/typed field read confidently (passport bio line, modern cert)
  dictionary_exact: 3, // closed-vocab EXACT snap (gazetteer_exact / authority_dict)
  consensus: 2, // cross-read consensus_reliable (K reads agreed)
  handwritten_uncertain: 1, // held-for-review / low-confidence handwriting — NEVER an anchor source
} as const

export type AnchorStrengthName = keyof typeof ANCHOR_STRENGTH

/** The set of identity fields cross-doc reconciliation operates on. */
export const RECONCILABLE_FIELDS = new Set<string>([
  'date_of_birth',
  'dob',
  'family_name',
  'given_name',
  'sex',
  'place_of_birth',
])

/** Name/place fields — gated on matching source script (L8 RU/UA guard). */
const NAME_LIKE_FIELDS = new Set<string>([
  'family_name',
  'given_name',
  'patronymic',
  'place_of_birth',
])

/** One person's per-document recognition result fed into reconciliation. */
export interface PerDocFields {
  /** Stable id of the document within the person's order/packet. */
  docId: string
  /** Doc type (passport / birth_certificate / ...) — provenance only. */
  docType: string
  /** The arbitrated canonical fields of this document. Mutated copies are returned, never the input. */
  fields: CanonicalField[]
}

/** One reconciliation that happened — for audit + UI ("filled from passport"). */
export interface ReconcileChange {
  docId: string
  fieldKey: string
  /** The value copied from the anchor into suggestedValue. */
  suggestedValue: string
  fromDocId: string
  fromDocType: string
  fromStrength: AnchorStrengthName
  toStrength: AnchorStrengthName
}

/** An anchor candidate: the strongest reading of a field across the person's docs. */
interface AnchorField {
  docId: string
  docType: string
  fieldKey: string
  value: string
  strength: AnchorStrengthName
  rawCyrillic: string | null
}

export interface ReconcileResult {
  /** Per-doc fields, with weaker held fields given a suggestedValue from the anchor. */
  docs: PerDocFields[]
  /** Every reconciliation performed (empty when flag OFF or nothing applied). */
  changes: ReconcileChange[]
}

// ---------------------------------------------------------------------------
// Strength classification of an already-arbitrated CanonicalField
// ---------------------------------------------------------------------------

/**
 * Classify the authority STRENGTH of a field AS READ on its own document.
 * A field that needs review / has no confident value is `handwritten_uncertain`
 * (it can RECEIVE a stronger anchor but can NEVER BE one).
 */
export function classifyStrength(f: CanonicalField): AnchorStrengthName {
  // MRZ math anchor: source is mrz and it was NOT forced to review (check digits passed).
  if (f.source === 'mrz' && !f.reviewRequired) return 'mrz_validated'

  // A held / review-required / value-less field is uncertain regardless of source.
  const confidentValue = !f.reviewRequired && hasValue(confidentlyReadValue(f))
  if (!confidentValue) return 'handwritten_uncertain'

  // Dictionary-EXACT provenance (gazetteer / authority dict).
  const prov = f.knowledgeProvenance ?? ''
  if (prov === 'gazetteer_exact' || prov === 'authority_dict') return 'dictionary_exact'

  // Printed/controlling sources read confidently.
  if (f.source === 'passport_visual' || f.source === 'i94' || f.source === 'ead' ||
      f.source === 'driver_license' || f.source === 'gov_ua' || f.source === 'mrz') {
    return 'printed'
  }

  // Cross-read consensus marker.
  if (f.consensus_reliable) return 'consensus'

  // Confident but ordinary OCR/vision read — treat as printed-tier confident.
  return 'printed'
}

/** The value a field confidently holds (final → normalized → raw), or null if none. */
function confidentlyReadValue(f: CanonicalField): string | null {
  // finalValue===null means C3 rejected → no released value. undefined means C3 didn't run.
  if (f.finalValue !== undefined && f.finalValue !== null) return f.finalValue
  if (f.finalValue === null) return null
  return f.normalizedValue ?? f.rawValue
}

function hasValue(v: string | null | undefined): v is string {
  return typeof v === 'string' && v.trim() !== ''
}

// ---------------------------------------------------------------------------
// The engine
// ---------------------------------------------------------------------------

/**
 * Reconcile identity fields across one person's documents.
 *
 * For each reconcilable identity field, find the STRONGEST anchor across all the person's
 * docs. For a doc whose SAME field is strictly WEAKER (held-for-review / lower strength),
 * set that field's `suggestedValue` FROM the stronger anchor and tag provenance
 * `cross_doc_reconciled`. The field KEEPS reviewRequired=true (one-click confirm). A field
 * that was itself confidently read is NEVER touched. No value is manufactured — the suggestion
 * is always a value some document produced.
 *
 * @param docs   the person's per-document fields (NOT mutated; copies returned)
 * @param flagOn CROSS_DOC_RECONCILE_ENABLED. false ⇒ pass-through, zero changes.
 */
export function reconcileAcrossDocuments(docs: PerDocFields[], flagOn: boolean): ReconcileResult {
  // Flag OFF (or trivial input) → byte-identical pass-through, no changes.
  if (!flagOn || docs.length < 2) {
    return { docs, changes: [] }
  }

  // Deep-ish copy so the input is never mutated (fields are copied per-doc, per-field).
  const outDocs: PerDocFields[] = docs.map((d) => ({
    ...d,
    fields: d.fields.map((f) => ({ ...f, reviewReasons: [...f.reviewReasons] })),
  }))

  const changes: ReconcileChange[] = []

  // Collect, per field key, every doc's reading + its strength.
  const byKey = new Map<string, Array<{ doc: PerDocFields; field: CanonicalField; strength: AnchorStrengthName; value: string | null }>>()
  for (const doc of outDocs) {
    for (const field of doc.fields) {
      if (!RECONCILABLE_FIELDS.has(field.key)) continue
      const strength = classifyStrength(field)
      const value = confidentlyReadValue(field)
      const list = byKey.get(field.key) ?? []
      list.push({ doc, field, strength, value })
      byKey.set(field.key, list)
    }
  }

  for (const [fieldKey, entries] of byKey) {
    // The anchor: the strongest entry that actually has a value and is itself NOT uncertain.
    const anchor = pickAnchor(fieldKey, entries)
    if (!anchor) continue

    for (const e of entries) {
      // Skip the anchor's own doc.
      if (e.doc.docId === anchor.docId) continue

      // ONLY fill a strictly-WEAKER field. Never overwrite an equal/stronger (confident) read.
      if (ANCHOR_STRENGTH[e.strength] >= ANCHOR_STRENGTH[anchor.strength]) continue

      // NAME/PLACE script guard (L8): only reconcile names across matching source script.
      if (NAME_LIKE_FIELDS.has(fieldKey) && !sameNameScript(anchor.rawCyrillic, e.field.rawCyrillic ?? null)) {
        continue
      }

      // Never overwrite a value the field already confidently holds (defense-in-depth:
      // a strictly-weaker field is held/uncertain, so confidentlyReadValue is null here,
      // but we still guard to honor L6 absolutely).
      if (hasValue(e.value)) continue

      // Apply: suggestedValue from the anchor, provenance tag, KEEP review (one-click confirm).
      e.field.suggestedValue = anchor.value
      e.field.knowledgeProvenance = 'cross_doc_reconciled'
      if (!e.field.reviewReasons.includes('cross_doc_reconciled')) {
        e.field.reviewReasons.push('cross_doc_reconciled')
      }
      e.field.reviewRequired = true // L6: still a held field; human confirms the pre-fill.

      changes.push({
        docId: e.doc.docId,
        fieldKey,
        suggestedValue: anchor.value,
        fromDocId: anchor.docId,
        fromDocType: anchor.docType,
        fromStrength: anchor.strength,
        toStrength: e.strength,
      })
    }
  }

  return { docs: outDocs, changes }
}

/** Strongest valued, non-uncertain entry for a field key → the anchor (or null). */
function pickAnchor(
  fieldKey: string,
  entries: Array<{ doc: PerDocFields; field: CanonicalField; strength: AnchorStrengthName; value: string | null }>,
): AnchorField | null {
  let best: AnchorField | null = null
  for (const e of entries) {
    // An uncertain/held field can never be an anchor source (L6).
    if (e.strength === 'handwritten_uncertain') continue
    if (!hasValue(e.value)) continue
    if (best === null || ANCHOR_STRENGTH[e.strength] > ANCHOR_STRENGTH[best.strength]) {
      best = {
        docId: e.doc.docId,
        docType: e.doc.docType,
        fieldKey,
        value: e.value,
        strength: e.strength,
        rawCyrillic: e.field.rawCyrillic ?? null,
      }
    }
  }
  return best
}

/**
 * NAME-SCRIPT GUARD (L8). Two name readings may be reconciled ONLY when their SOURCE
 * scripts match (both detect as 'ua' or both as 'ru'). If either is 'unknown' (no
 * distinctive letter) or they differ (ua vs ru) → DO NOT reconcile — surface for review
 * instead of silently converting Сергій↔Сергей.
 */
export function sameNameScript(anchorRaw: string | null, targetRaw: string | null): boolean {
  if (!hasValue(anchorRaw) || !hasValue(targetRaw)) return false
  const a = detectNameScript(anchorRaw)
  const b = detectNameScript(targetRaw)
  if (a === 'unknown' || b === 'unknown') return false
  return a === b
}
