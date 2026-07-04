/**
 * canonical/core/tpsAdapter.ts — B1 bridge: CanonicalDocumentResult → TPS types.
 *
 * Converts Core arbitration output into TpsModuleResult so the existing TPS
 * pipeline (contract firewall, postExtractNormalize, Brain fallback, audit) can
 * consume it unchanged. This is the thin product adapter for TPS/Re-Parole.
 *
 * FLAG TRUTH (2026-06-29): there is NO `ONE_CORE_TPS_ENABLED` runtime gate — the
 * TPS Core path is UNCONDITIONAL (the route always builds canonicalFields and, when
 * present, projects them via canonicalToTpsModuleResult; on empty it falls through to
 * legacy). The only recognition flag in the route is `ONE_BRAIN_RECOGNIZE_ENABLED`,
 * which selects the recognizeDocument orchestrator vs the inline readDocument spine —
 * it does NOT gate this adapter. (Prior comment referenced a flag that never existed.)
 * See docs/architecture/ONE_BRAIN_DECISION.md for the architecture contract.
 */
import type { CanonicalField } from '../types'
import type { TpsExtractedField, TpsModuleResult } from '@/lib/tps/types'

/**
 * Map TPS wizard docHint → docintel document type ID.
 *
 * ONE-BRAIN v2 Phase 2 (TPS coverage — the real critical path of the legacy collapse):
 * docintel SPECS already exist for the US-form slots (us_i94/us_ead/us_i797 — the EAD
 * route reads them today) and for military/birth (ua_military_id/ua_birth_certificate —
 * translation reads them today). Historically only passport/booklet were mapped, which
 * made every other TPS slot 100% dependent on the legacy modules.
 *
 * Rollout is per-hint behind the strict allowlist env `TPS_CORE_HINTS` (comma-separated,
 * e.g. 'i94,i797'). A hint NOT in the allowlist maps exactly as before (extended hints →
 * null → legacy module runs) — byte-identical. A hint IS enabled only after its own
 * Core-vs-legacy parity report (tpsHintParity harness). `dl` has NO docintel spec anywhere
 * — deliberately unmapped (L6: never guess), stays legacy until a spec exists.
 */
const TPS_BASE_HINT_MAP: Record<string, string> = {
  passport: 'ua_international_passport',
  booklet:  'ua_internal_passport_booklet',
}
const TPS_EXTENDED_HINT_MAP: Record<string, string> = {
  i94:               'us_i94',
  ead:               'us_ead',
  ead_old:           'us_ead',
  i797:              'us_i797',
  military_id:       'ua_military_id',
  birth_certificate: 'ua_birth_certificate',
}

/** Strict allowlist: TPS_CORE_HINTS='i94,i797' — only listed EXTENDED hints route to Core. */
export function tpsCoreHintAllowlist(env: Record<string, string | undefined> = process.env): Set<string> {
  const raw = (env.TPS_CORE_HINTS ?? '').trim()
  if (!raw) return new Set()
  return new Set(raw.split(',').map((s) => s.trim()).filter(Boolean))
}

export function mapTpsHintToDocintelId(
  hint: string,
  env: Record<string, string | undefined> = process.env,
): string | null {
  const base = TPS_BASE_HINT_MAP[hint]
  if (base) return base
  const extended = TPS_EXTENDED_HINT_MAP[hint]
  if (extended && tpsCoreHintAllowlist(env).has(hint)) return extended
  return null
}

/** Convert one CanonicalField to a TpsExtractedField. */
export function canonicalFieldToTpsField(
  f: CanonicalField,
  documentId: string,
): TpsExtractedField {
  const lang = (() => {
    // Fields that carry Cyrillic Ua values as rawValue
    if (['family_name_cyrillic','given_name_cyrillic','patronymic_cyrillic',
         'place_of_birth_raw'].includes(f.key)) return 'cyrillic' as const
    // Fields that always come from the MRZ (all-Latin)
    if (f.source === 'mrz') return 'mrz' as const
    // Dates and numbers are numeric/mixed
    if (['date_of_birth','dob','date_of_expiry','passport_number','sex'].includes(f.key)) return 'mixed' as const
    return 'latin' as const
  })()

  return {
    field:              f.key,
    raw_value:          f.rawValue ?? '',
    // Phase 3 (ADR-017 C3 contract): use finalValue when C3 has run.
    // finalValue=string → C3 accepted. finalValue=null → C3 rejected (block).
    // finalValue=undefined → C3 not run (flag OFF); fall back to normalizedValue for backward compat.
    normalized_value:   f.finalValue !== undefined ? f.finalValue : (f.normalizedValue ?? f.rawValue ?? null),
    extraction_source:  'canonical_core',
    source_document_id: documentId,
    source_zone:        f.source,
    bbox:               null,
    language_layer:     lang,
    confidence:         f.confidence.final ?? null,
    review_required:    f.reviewRequired,
    ocr_word_ids:       [],
    passes:             [],
    failures:           [],
    user_corrected:     false,
  }
}

/** Convert Core fields to a TpsModuleResult that feeds the existing TPS pipeline. */
/**
 * CORE→TPS key projection (One-Brain v2 Phase 2c, closes parity gap G3).
 * The TPS contract firewall consumes LEGACY field names verbatim; the docintel
 * registry emits canonical names. Without this projection, equivalent fields
 * (KEY_ALIASES-declared) were firewall-REJECTED (proved by tpsHintParity harness),
 * which is why only passport/booklet — whose specs already use legacy names —
 * could ever flip. This is a LAYOUT concern, so it lives in the adapter
 * (Invariant #10: the adapter lays out into product slots; semantics unchanged).
 * SAFETY (hint-scoped): the projection applies ONLY to the EXTENDED hints (dormant in
 * prod until listed in TPS_CORE_HINTS). The LIVE passport/booklet path is NEVER projected —
 * its MRZ candidates legitimately emit `date_of_birth` (mrzAuthority.ts) and downstream
 * consumes them as-is today; an unconditional projection changed that live key (caught by
 * formMapperCanonicalParity). Enforced by the tpsKeyProjection guard test.
 */
const CORE_TO_TPS_KEY: Readonly<Record<string, string>> = {
  i94_date_of_entry: 'last_entry_date',        // KEY_ALIASES equivalence
  i94_place_of_entry: 'place_of_last_entry',   // same fact ("Port of Entry")
  date_of_birth: 'dob',                        // KEY_ALIASES equivalence
  ead_category: 'ead_category_on_card',        // card "Category" line
  ead_validity_to: 'ead_expiration_date',      // card "Card Expires" line
}

/** Hints whose Core output is projected onto legacy/TPS keys (extended hints only). */
const PROJECTED_TPS_HINTS: ReadonlySet<string> = new Set([
  'i94', 'ead', 'ead_old', 'i797', 'military_id', 'birth_certificate',
])

export function projectCoreKeyToTps(key: string, docTypeHint: string): string {
  if (!PROJECTED_TPS_HINTS.has(docTypeHint)) return key
  return CORE_TO_TPS_KEY[key] ?? key
}

export function canonicalToTpsModuleResult(
  fields: CanonicalField[],
  docTypeHint: string,
  documentId: string,
): TpsModuleResult {
  const project = PROJECTED_TPS_HINTS.has(docTypeHint)
  const tpsFields = fields.map((f) =>
    canonicalFieldToTpsField(
      project && f.key in CORE_TO_TPS_KEY ? { ...f, key: CORE_TO_TPS_KEY[f.key] } : f,
      documentId,
    ),
  )
  const anyReview = fields.some((f) => f.reviewRequired)
  return {
    module: 'unknown' as import('@/lib/tps/types').TpsDocType, // refined by contract firewall downstream
    matched: tpsFields.length > 0,
    match_reason: tpsFields.length > 0 ? 'core_visual_read' : 'core_no_fields',
    fields: tpsFields,
    warnings: anyReview ? ['canonical_core: some fields require review'] : [],
    manual_review_required: anyReview,
    manual_review_reasons: anyReview ? ['core_review_required'] : [],
  }
}
