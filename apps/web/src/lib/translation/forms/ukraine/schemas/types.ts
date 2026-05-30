/**
 * Official Ukrainian form schema types. A schema mirrors the FACTUAL field
 * structure of an official state form (per its normative act) — it is the
 * single source of truth for what the bureau-style translation renders and in
 * what order. RULE: a schema must carry an `officialSource` (see
 * docs/official-forms/ukraine/source-ledger.json) or it must not exist.
 */

export type ExpectedScript = 'cyrillic' | 'latin' | 'numeric' | 'mixed'
export type TranslationRule =
  | 'transliterate_kmu55'   // names — transliteration, never translation
  | 'date_normalize'        // date → English, source preserved
  | 'glossary_authority'    // agency/authority via controlled glossary
  | 'locked_verbatim'       // numbers/series/act-record — kept exactly
  | 'translate_prose'       // free text → LLM prose (names/numbers locked)
  | 'place_gazetteer'       // place → snap to gazetteer + KMU-55

export type LayoutSection =
  | 'header' | 'issuingAuthority' | 'personFields' | 'actRecord'
  | 'signatures' | 'seals' | 'certification'

/** Conditions under which a field MUST be sent to human review. */
export type ReviewCondition =
  | 'handwritten' | 'low_confidence' | 'split_from_full_name'
  | 'bilingual_conflict' | 'agency_not_in_glossary' | 'legacy_organization'
  | 'fuzzy_geography' | 'signature_only' | 'illegible' | 'present_but_low_confidence'

export interface FormFieldSpec {
  key: string
  sourceLabelUk: string
  sourceLabelEn: string
  required: boolean
  fieldGroup: string          // e.g. 'groom' | 'bride' | 'marriage' | 'issuing'
  expectedScript: ExpectedScript
  translationRule: TranslationRule
  lockedEntity: boolean       // true → never re-translated (name/number/date)
  evidenceRequired: boolean   // must trace to a visible region of the source
  // ── Field Contract (official-document platform) ───────────────────────────
  canGuess?: boolean          // default FALSE — value is NEVER inferred; absent → review
  sourceRule?: string         // provenance clause, e.g. 'ua_kmu_1025_2010.birth.child_identity'
  reviewRequiredIf?: ReviewCondition[]
  eraDependent?: boolean      // present only in certain editions (e.g. UNZR/RNOKPP post-2019)
}

/** A historical/edition variant of the SAME document type. Era matters: a Soviet
 *  bilingual certificate is NOT processed as a modern Ukrainian-only one. */
export interface DocumentVariant {
  id: string
  description: string
  languageProfile: 'uk_only' | 'uk_ru_bilingual' | 'latin_mrz'
  active: boolean
  reviewRequired?: boolean
}

export interface OfficialFormSchema {
  docType: string
  titleEn: string
  officialSource: { act: string; url: string; authority: string; effectiveDate: string }
  /** source_id into docs/official-forms ledger; a schema MUST reference a verified source. */
  sourceId?: string
  variants?: DocumentVariant[]
  fields: FormFieldSpec[]
  layoutSections: LayoutSection[]
}
