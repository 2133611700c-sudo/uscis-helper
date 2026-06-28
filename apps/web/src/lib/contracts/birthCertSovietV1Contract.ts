/**
 * Unified Document Form Contract — ua_birth_certificate_soviet_bilingual_v1.
 *
 * ONE source of truth that ties together the previously-scattered birth-certificate
 * layers (see docs/architecture/contracts/ua_birth_certificate_soviet_v1/):
 *   A read-side  : documentRegistry.ts  DocTypeSpec 'ua_birth_certificate'  (readSideKey)
 *   B output     : birth-certificate.schema.ts OfficialFormSchema            (outputKey)
 *   C crop       : FIELD_BOX_TEMPLATES (3/12 name fields)                    (locator='fixed_region')
 *   D canonical  : CanonicalField.key / KEY_ALIASES                          (runtimeKey)
 *   E PDF/labels : renderOfficialTranslation + translationFieldLabels        (englishLabel/section/order)
 *
 * DECISIONS BAKED IN (see open-decisions.md):
 *  #1 stored key = FLAT runtimeKey (canonicalKey is the dotted human SoT / projection).
 *  #2/#3 RESOLVED BY EXISTING CODE: buildMirrorValues maps issuing_authority→place_of_registration,
 *        so read-side `issuing_authority` ≡ output `place_of_registration` ≡ registry.office.name.
 *        A separate `document.issuing_authority` exists for the re-issue (ПОВТОРНО) case only and has
 *        NO legacy key yet.
 *  #4 series/number SPLIT: legacy single key (certificate_series_number / series_number) attaches to
 *        document.series and `splitsInto` document.number.
 *  #5 parents kept COMPOSITE (full_name) for v1.
 *
 * This module is pure data + helpers. It changes NO runtime behaviour on its own; the
 * accompanying test locks it to the live A and B layers so drift is caught in CI.
 * No real PII — only printed label text + format metadata.
 */

export type ContractSection = 'child' | 'birthPlace' | 'actRecord' | 'parents' | 'issuing'
export type Occurrence = 'REQUIRED_ONCE' | 'OPTIONAL_ONCE' | 'REQUIRED_MULTIPLE' | 'OPTIONAL_MULTIPLE'
export type Criticality = 'critical' | 'high' | 'medium' | 'low'
export type Rendering = 'handwritten' | 'printed' | 'derived' | 'handwritten_plus_seal'
export type LocatorStrategy =
  | 'fixed_region'
  | 'anchor_relative'
  | 'table_cell'
  | 'deterministic'
  | 'full_page_semantic'
  | 'not_applicable'
export type ReaderRoute =
  | 'full_page_semantic_llm'
  | 'fixed_crop_htr'
  | 'dual_reader_llm_plus_htr'
  | 'deterministic_parser'
  | 'human_only'

export interface BirthCertFieldContract {
  /** Dotted human source-of-truth key (documentation/projection layer). */
  canonicalKey: string
  /** Flat key actually stored on CanonicalField.key today (decision #1). */
  runtimeKey: string
  /** Read-side documentRegistry field name, if this concept is read there. */
  readSideKey?: string
  /** Output-side OfficialFormSchema key, if this concept is rendered there. */
  outputKey?: string
  /** English label — single source for PDF + review (must equal B.sourceLabelEn when outputKey set). */
  englishLabel: string
  section: ContractSection
  order: number
  occurrence: Occurrence
  criticality: Criticality
  rendering: Rendering
  locator: LocatorStrategy
  readerRoute: ReaderRoute
  autoFinalize: boolean
  alwaysReview: boolean
  /** Soviet-only fields absent from the modern KMU-1025 blank. */
  scopeEra?: 'soviet_pre1991'
  /** A legacy key that carries several canonical values lists the others here. */
  splitsInto?: string[]
  note?: string
}

export const BIRTH_CERT_SOVIET_V1_TEMPLATE_ID = 'ua_birth_certificate_soviet_bilingual_v1'
/** The legacy DocTypeSpec / OfficialFormSchema docType this contract refines. */
export const BIRTH_CERT_LEGACY_DOCTYPE = 'ua_birth_certificate'

export const birthCertSovietV1Contract: readonly BirthCertFieldContract[] = [
  {
    canonicalKey: 'person.child.surname', runtimeKey: 'family_name',
    readSideKey: 'child_family_name', outputKey: 'child_surname',
    englishLabel: 'Surname', section: 'child', order: 1,
    occurrence: 'REQUIRED_ONCE', criticality: 'critical', rendering: 'handwritten',
    locator: 'fixed_region', readerRoute: 'dual_reader_llm_plus_htr', autoFinalize: false, alwaysReview: true,
  },
  {
    canonicalKey: 'person.child.given_name', runtimeKey: 'given_name',
    readSideKey: 'child_given_name', outputKey: 'child_given_name',
    englishLabel: 'Given name', section: 'child', order: 2,
    occurrence: 'REQUIRED_ONCE', criticality: 'critical', rendering: 'handwritten',
    locator: 'fixed_region', readerRoute: 'dual_reader_llm_plus_htr', autoFinalize: false, alwaysReview: true,
  },
  {
    canonicalKey: 'person.child.patronymic', runtimeKey: 'patronymic',
    readSideKey: 'child_patronymic', outputKey: 'child_patronymic',
    englishLabel: 'Patronymic', section: 'child', order: 3,
    occurrence: 'REQUIRED_ONCE', criticality: 'critical', rendering: 'handwritten',
    locator: 'fixed_region', readerRoute: 'dual_reader_llm_plus_htr', autoFinalize: false, alwaysReview: true,
    note: 'NEVER "Middle Name".',
  },
  {
    canonicalKey: 'person.child.sex', runtimeKey: 'sex',
    englishLabel: 'Sex', section: 'child', order: 4,
    occurrence: 'OPTIONAL_ONCE', criticality: 'high', rendering: 'derived',
    locator: 'not_applicable', readerRoute: 'deterministic_parser', autoFinalize: false, alwaysReview: false,
    note: 'No printed sex field on this Soviet template; derive from patronymic ending.',
  },
  {
    canonicalKey: 'event.birth.date', runtimeKey: 'date_of_birth',
    readSideKey: 'dob', outputKey: 'date_of_birth',
    englishLabel: 'Date of birth', section: 'child', order: 5,
    occurrence: 'REQUIRED_ONCE', criticality: 'critical', rendering: 'handwritten',
    locator: 'anchor_relative', readerRoute: 'full_page_semantic_llm', autoFinalize: false, alwaysReview: true,
    note: 'Year/day also spelled out ("цифрами и прописью") — cross-check, not a separate field.',
  },
  {
    canonicalKey: 'event.birth.settlement', runtimeKey: 'place_of_birth',
    readSideKey: 'place_of_birth_city', outputKey: 'place_of_birth',
    englishLabel: 'Place of birth', section: 'birthPlace', order: 6,
    occurrence: 'REQUIRED_ONCE', criticality: 'high', rendering: 'handwritten',
    locator: 'anchor_relative', readerRoute: 'full_page_semantic_llm', autoFinalize: false, alwaysReview: true,
    splitsInto: ['event.birth.settlement_type', 'event.birth.district', 'event.birth.oblast', 'event.birth.republic'],
    note: 'A/B collapse settlement+district+oblast+republic into one field; contract splits (additive).',
  },
  {
    canonicalKey: 'event.birth.settlement_type', runtimeKey: 'place_of_birth_settlement_type',
    englishLabel: 'Settlement type', section: 'birthPlace', order: 7,
    occurrence: 'OPTIONAL_ONCE', criticality: 'medium', rendering: 'handwritten',
    locator: 'anchor_relative', readerRoute: 'deterministic_parser', autoFinalize: false, alwaysReview: false,
    note: 'keep_type: "смт" = urban-type settlement, NEVER city/town.',
  },
  {
    canonicalKey: 'event.birth.district', runtimeKey: 'place_of_birth_district',
    englishLabel: 'District', section: 'birthPlace', order: 8,
    occurrence: 'OPTIONAL_ONCE', criticality: 'medium', rendering: 'handwritten',
    locator: 'anchor_relative', readerRoute: 'full_page_semantic_llm', autoFinalize: false, alwaysReview: false,
  },
  {
    canonicalKey: 'event.birth.oblast', runtimeKey: 'place_of_birth_oblast',
    englishLabel: 'Oblast', section: 'birthPlace', order: 9,
    occurrence: 'OPTIONAL_ONCE', criticality: 'medium', rendering: 'handwritten',
    locator: 'anchor_relative', readerRoute: 'full_page_semantic_llm', autoFinalize: false, alwaysReview: false,
    note: 'genitive→nominative DMS-verified.',
  },
  {
    canonicalKey: 'event.birth.republic', runtimeKey: 'place_of_birth_republic',
    englishLabel: 'Republic', section: 'birthPlace', order: 10,
    occurrence: 'OPTIONAL_ONCE', criticality: 'low', rendering: 'handwritten',
    locator: 'anchor_relative', readerRoute: 'full_page_semantic_llm', autoFinalize: false, alwaysReview: false,
    scopeEra: 'soviet_pre1991', note: 'e.g. УССР — Soviet-only; not_applicable on modern certs.',
  },
  {
    canonicalKey: 'registry.record.number', runtimeKey: 'act_record_number',
    readSideKey: 'act_record_number', outputKey: 'act_record_number',
    englishLabel: 'Act record No.', section: 'actRecord', order: 11,
    occurrence: 'REQUIRED_ONCE', criticality: 'critical', rendering: 'handwritten',
    locator: 'anchor_relative', readerRoute: 'full_page_semantic_llm', autoFinalize: false, alwaysReview: true,
    note: 'NOT the certificate number; silent-wrong incident on a real cert (2026-06-11).',
  },
  {
    canonicalKey: 'registry.record.date', runtimeKey: 'act_record_date',
    readSideKey: 'act_record_date', outputKey: 'act_record_date',
    englishLabel: 'Act record date', section: 'actRecord', order: 12,
    occurrence: 'OPTIONAL_ONCE', criticality: 'high', rendering: 'handwritten',
    locator: 'anchor_relative', readerRoute: 'full_page_semantic_llm', autoFinalize: false, alwaysReview: true,
  },
  {
    canonicalKey: 'registry.office.name', runtimeKey: 'place_of_registration',
    readSideKey: 'issuing_authority', outputKey: 'place_of_registration',
    englishLabel: 'Place of state registration', section: 'issuing', order: 13,
    occurrence: 'OPTIONAL_ONCE', criticality: 'high', rendering: 'handwritten',
    locator: 'anchor_relative', readerRoute: 'full_page_semantic_llm', autoFinalize: false, alwaysReview: true,
    splitsInto: ['registry.office.district', 'registry.office.oblast'],
    note: 'Decision #2/#3: existing buildMirrorValues maps issuing_authority→place_of_registration → same field.',
  },
  {
    canonicalKey: 'registry.office.district', runtimeKey: 'registry_office_district',
    englishLabel: 'Registry district', section: 'issuing', order: 14,
    occurrence: 'OPTIONAL_ONCE', criticality: 'low', rendering: 'handwritten',
    locator: 'anchor_relative', readerRoute: 'deterministic_parser', autoFinalize: false, alwaysReview: false,
  },
  {
    canonicalKey: 'registry.office.oblast', runtimeKey: 'registry_office_oblast',
    englishLabel: 'Registry oblast', section: 'issuing', order: 15,
    occurrence: 'OPTIONAL_ONCE', criticality: 'low', rendering: 'handwritten',
    locator: 'anchor_relative', readerRoute: 'deterministic_parser', autoFinalize: false, alwaysReview: false,
  },
  {
    canonicalKey: 'person.parent.father.full_name', runtimeKey: 'father_full_name',
    readSideKey: 'father_full_name', outputKey: 'father_full_name',
    englishLabel: 'Father', section: 'parents', order: 16,
    occurrence: 'OPTIONAL_ONCE', criticality: 'high', rendering: 'handwritten',
    locator: 'anchor_relative', readerRoute: 'full_page_semantic_llm', autoFinalize: false, alwaysReview: true,
    note: 'Composite kept for v1 (decision #5).',
  },
  {
    canonicalKey: 'person.parent.father.nationality', runtimeKey: 'father_nationality',
    englishLabel: 'Father — nationality', section: 'parents', order: 17,
    occurrence: 'OPTIONAL_ONCE', criticality: 'low', rendering: 'handwritten',
    locator: 'anchor_relative', readerRoute: 'full_page_semantic_llm', autoFinalize: false, alwaysReview: false,
    scopeEra: 'soviet_pre1991',
  },
  {
    canonicalKey: 'person.parent.mother.full_name', runtimeKey: 'mother_full_name',
    readSideKey: 'mother_full_name', outputKey: 'mother_full_name',
    englishLabel: 'Mother', section: 'parents', order: 18,
    occurrence: 'OPTIONAL_ONCE', criticality: 'high', rendering: 'handwritten',
    locator: 'anchor_relative', readerRoute: 'full_page_semantic_llm', autoFinalize: false, alwaysReview: true,
  },
  {
    canonicalKey: 'person.parent.mother.nationality', runtimeKey: 'mother_nationality',
    englishLabel: 'Mother — nationality', section: 'parents', order: 19,
    occurrence: 'OPTIONAL_ONCE', criticality: 'low', rendering: 'handwritten',
    locator: 'anchor_relative', readerRoute: 'full_page_semantic_llm', autoFinalize: false, alwaysReview: false,
    scopeEra: 'soviet_pre1991',
  },
  {
    canonicalKey: 'document.series', runtimeKey: 'document_series',
    readSideKey: 'certificate_series_number', outputKey: 'series_number',
    englishLabel: 'Series and No.', section: 'issuing', order: 20,
    occurrence: 'REQUIRED_ONCE', criticality: 'high', rendering: 'printed',
    locator: 'anchor_relative', readerRoute: 'deterministic_parser', autoFinalize: false, alwaysReview: true,
    splitsInto: ['document.number'],
    note: 'A/B store series+number merged; adapter splits into document.series + document.number (decision #4).',
  },
  {
    canonicalKey: 'document.number', runtimeKey: 'document_number',
    englishLabel: 'Number', section: 'issuing', order: 21,
    occurrence: 'REQUIRED_ONCE', criticality: 'high', rendering: 'printed',
    locator: 'anchor_relative', readerRoute: 'deterministic_parser', autoFinalize: false, alwaysReview: true,
    note: 'Distinct from registry.record.number.',
  },
  {
    canonicalKey: 'document.issue_date', runtimeKey: 'date_of_issue',
    readSideKey: 'date_of_issue', outputKey: 'date_of_issue',
    englishLabel: 'Date of issue', section: 'issuing', order: 22,
    occurrence: 'OPTIONAL_ONCE', criticality: 'high', rendering: 'handwritten',
    locator: 'anchor_relative', readerRoute: 'full_page_semantic_llm', autoFinalize: false, alwaysReview: true,
  },
  {
    canonicalKey: 'document.issuing_authority', runtimeKey: 'issuing_authority',
    englishLabel: 'Issuing authority', section: 'issuing', order: 23,
    occurrence: 'OPTIONAL_ONCE', criticality: 'medium', rendering: 'handwritten_plus_seal',
    locator: 'anchor_relative', readerRoute: 'full_page_semantic_llm', autoFinalize: false, alwaysReview: true,
    note: 'Re-issue (ПОВТОРНО) case only; may equal registry.office.name. No legacy key yet (decision #2/#3).',
  },
] as const

export interface BirthCertMark {
  type: 'seal' | 'stamp' | 'signature' | 'handwritten_note'
  page: number
  description: string
  affectsValidity: boolean
  reviewRequired: boolean
}

export const birthCertSovietV1Marks: readonly BirthCertMark[] = [
  { type: 'seal', page: 2, description: 'round ЗАГС official seal (purple), over signature', affectsValidity: true, reviewRequired: true },
  { type: 'stamp', page: 1, description: 'blue rectangular registration/verification stamp over title', affectsValidity: false, reviewRequired: true },
  { type: 'stamp', page: 2, description: 'later top-right date stamp (apostille/processing)', affectsValidity: false, reviewRequired: true },
  { type: 'signature', page: 2, description: 'registrar (заведующий) signature', affectsValidity: true, reviewRequired: true },
] as const

// ── helpers (the single-namespace bridge other layers can derive from) ─────────

/** Read-side (A) documentRegistry key → flat runtimeKey. */
export function readKeyToRuntime(readSideKey: string): string | undefined {
  return birthCertSovietV1Contract.find((f) => f.readSideKey === readSideKey)?.runtimeKey
}

/** Output-side (B) schema key → flat runtimeKey. */
export function outputKeyToRuntime(outputKey: string): string | undefined {
  return birthCertSovietV1Contract.find((f) => f.outputKey === outputKey)?.runtimeKey
}

/** runtimeKey → its contract entry. */
export function fieldByRuntimeKey(runtimeKey: string): BirthCertFieldContract | undefined {
  return birthCertSovietV1Contract.find((f) => f.runtimeKey === runtimeKey)
}

/** dotted canonicalKey → flat runtimeKey (decision #1 projection). */
export function canonicalToRuntime(canonicalKey: string): string | undefined {
  return birthCertSovietV1Contract.find((f) => f.canonicalKey === canonicalKey)?.runtimeKey
}
