/**
 * crossDocSuggestions.ts — CLIENT half of Seam A (cross-document reconciliation).
 *
 * The OCR extract routes return `cross_doc_suggestions: Array<{field_key, suggested_value,
 * from_doc_type}>` (empty unless CROSS_DOC_RECONCILE_ENABLED + a stronger sibling anchor). These
 * are ONE-CLICK CONFIRM pre-fills: a held field of THIS document pre-filled from a stronger
 * document of the SAME person (e.g. a passport MRZ date → a birth-cert's held date). The user
 * still confirms; nothing is auto-applied (C3 remains the single server-side writer).
 *
 * Pure helpers (mirror canonicalCarriage.ts): defensive, never throw, no PII logging. Tested
 * with plain data under vitest `environment: 'node'` — the wizard stays a thin caller.
 */

/** The server-emitted suggestion shape (identical to canonical/core/crossDocSession.ts). */
export interface CrossDocSuggestion {
  field_key: string
  suggested_value: string
  from_doc_type: string
}

/**
 * Minimal structural view of the wizard's FieldExtraction — only the members applyCrossDoc
 * Suggestion writes/reads. Kept local so this module + its unit test need NO wizard import.
 */
export interface CrossDocField {
  value: string
  source: string
  requires_review: boolean
  doc_slot: string
  source_document_id: string | null
  source_zone: string | null
  raw_value: string | null
  confidence: number | null
}

/**
 * Map a server canonical field key → the TPS wizard's field key. The reconciliation engine emits
 * canonical CanonicalField keys (e.g. `date_of_birth`); the wizard's mergedFields uses its own
 * names (e.g. `dob`). Only the identity fields reconciliation operates on are mapped; an unknown
 * key passes through unchanged (so a future key still surfaces if it already matches).
 */
const FIELD_KEY_ALIASES: Record<string, string> = {
  date_of_birth: 'dob',
  patronymic: 'middle_name',
  place_of_birth: 'place_of_birth',
}

/** Translate a server field_key to the wizard's field key (identity-preserving when unknown). */
export function wizardFieldKey(serverFieldKey: string): string {
  return FIELD_KEY_ALIASES[serverFieldKey] ?? serverFieldKey
}

/**
 * CAPTURE: pull & validate `cross_doc_suggestions` off an OCR extract response. Returns only
 * entries whose three keys are non-empty strings. Never throws. Flag-OFF ([]) ⇒ []. Malformed ⇒ [].
 */
export function extractCrossDocSuggestions(responseData: unknown): CrossDocSuggestion[] {
  if (!responseData || typeof responseData !== 'object') return []
  const raw = (responseData as { cross_doc_suggestions?: unknown }).cross_doc_suggestions
  if (!Array.isArray(raw)) return []
  const out: CrossDocSuggestion[] = []
  for (const e of raw) {
    if (!e || typeof e !== 'object') continue
    const { field_key, suggested_value, from_doc_type } = e as Record<string, unknown>
    if (
      typeof field_key === 'string' && field_key.trim() &&
      typeof suggested_value === 'string' && suggested_value.trim() &&
      typeof from_doc_type === 'string' && from_doc_type.trim()
    ) {
      out.push({ field_key, suggested_value, from_doc_type })
    }
  }
  return out
}

/**
 * APPLY (pure): return a NEW field pre-filled from a suggestion. The field STAYS held
 * (`requires_review: true`) — this only pre-fills the value for a one-click confirm; it never
 * auto-applies. `source: 'inferred'` (existing enum member: derived from another source).
 * Provenance encodes the origin doc so the review label can read "from passport". Does NOT mutate
 * the input.
 */
export function applyCrossDocSuggestion(
  currentField: CrossDocField | undefined,
  s: CrossDocSuggestion,
): CrossDocField {
  return {
    value: s.suggested_value,
    source: 'inferred',
    requires_review: true, // one-click confirm — never auto-applied
    doc_slot: currentField?.doc_slot ?? '',
    source_document_id: `cross_doc:${s.from_doc_type}`,
    source_zone: 'cross_doc_reconciled',
    raw_value: null,
    confidence: null,
  }
}
