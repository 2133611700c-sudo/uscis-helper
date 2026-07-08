/**
 * canonicalRegistry.ts — PHASE 1 of the One Brain Foundation: the CANONICAL document registry.
 *
 * This is the single source of truth that CONSTRAINS all future intake, classification, routing,
 * and review-policy. Doctrine: provider proposes · REGISTRY CONSTRAINS · One Brain arbitrates · C3
 * writes · service presents. No free-text doc types; every classification must resolve to an enum
 * here (or to the honest fail-closed pseudo-types `unknown` / `unsupported` / `not_a_document`).
 *
 * ADDITIVE + STANDALONE (Phase 1 rule: no extraction-behavior change): this does NOT touch the
 * runtime docintel `documentRegistry.ts` that `readDocument()` consumes. It is the intake-level
 * taxonomy the DocumentIntakeBrain (Phase 3) will classify INTO; the mapping from these canonical
 * ids to the reader-level docintel ids happens later (Phase 3/7). Pure data + a pure validator.
 *
 * Design: docs/architecture/DOCUMENT_INTAKE_BRAIN_DESIGN.md. Spec: owner Phase 1 GO (2026-07-08).
 */

// ─────────────────────────────────────────────────────────────────────────────
// Closed enums (a provider/classifier can never produce a value outside these)
// ─────────────────────────────────────────────────────────────────────────────
export const DOCUMENT_TYPE_IDS = [
  'i94', 'ead_card', 'i797_notice', 'us_drivers_license', 'passport',
  'ua_birth_certificate_soviet', 'ua_birth_certificate_modern', 'ua_marriage_certificate',
  'unknown', 'unsupported', 'not_a_document',
] as const
export type DocumentTypeId = (typeof DOCUMENT_TYPE_IDS)[number]

export const DOCUMENT_FAMILIES = [
  'us_immigration_record', 'us_immigration_notice', 'identity_document', 'civil_record',
  'driver_license', 'unknown', 'not_a_document',
] as const
export type DocumentFamily = (typeof DOCUMENT_FAMILIES)[number]

export const COUNTRY_CODES = ['US', 'UA', 'SU', 'UNKNOWN'] as const
export type CountryCode = (typeof COUNTRY_CODES)[number]

export const ISSUING_SYSTEMS = [
  'cbp', 'uscis', 'state_identity', 'dmv', 'soviet_legacy', 'ukraine_modern',
  // era-ambiguous: a civil record (e.g. marriage) whose issuing era can be Soviet OR modern UA.
  'ukraine_or_soviet_legacy',
  'unknown', 'none',
] as const
export type IssuingSystem = (typeof ISSUING_SYSTEMS)[number]

export const SCRIPT_CODES = ['latin', 'cyrillic', 'mixed', 'unknown'] as const
export type ScriptCode = (typeof SCRIPT_CODES)[number]

export const LANGUAGE_CODES = ['en', 'uk', 'ru', 'es', 'mixed', 'unknown'] as const
export type LanguageCode = (typeof LANGUAGE_CODES)[number]

export const SERVICE_ROUTE_IDS = ['translation', 'tps', 'reparole', 'ead'] as const
export type ServiceRouteId = (typeof SERVICE_ROUTE_IDS)[number]

export const READER_ROUTE_IDS = [
  'us_i94_reader', 'us_ead_card_reader', 'us_i797_reader', 'us_drivers_license_reader',
  'passport_reader', 'civil_record_reader', 'unknown_reader', 'none',
] as const
export type ReaderRouteId = (typeof READER_ROUTE_IDS)[number]

export const SUPPORTED_STATUSES = [
  'LIVE', 'PARTIAL', 'SHADOW_ONLY', 'BLOCKED_EXTERNAL', 'PLANNED', 'SUPPORTED_FAIL_CLOSED', 'UNSUPPORTED',
] as const
export type SupportedStatus = (typeof SUPPORTED_STATUSES)[number]

export const HANDWRITING_POLICIES = [
  'not_expected', 'force_review', 'force_review_if_handwritten', 'unknown', 'none',
] as const
export type HandwritingPolicy = (typeof HANDWRITING_POLICIES)[number]

export const REVIEW_POLICIES = [
  'review_critical_dates', 'review_all_identity_fields', 'review_receipt_and_dates',
  'review_identity_and_mrz_conflicts', 'force_review_handwritten_fields',
  'review_civil_record_identity_fields', 'review_spouse_identity_fields',
  'manual_review_required', 'reject_or_retake',
] as const
export type ReviewPolicy = (typeof REVIEW_POLICIES)[number]

export const PROVIDER_IDS = ['openai', 'gemini', 'google_vision', 'htr', 'rule', 'deepseek', 'tesseract'] as const
export type ProviderId = (typeof PROVIDER_IDS)[number]

export const PAGE_SIDES = ['front', 'back', 'single', 'unknown'] as const
export type PageSideId = (typeof PAGE_SIDES)[number]

export const LANGUAGE_MODES = ['monolingual', 'bilingual', 'unknown'] as const
export type LanguageMode = (typeof LANGUAGE_MODES)[number]

export const EVIDENCE_LEVELS = ['none', 'pilot', 'partial', 'strong'] as const
export type EvidenceLevel = (typeof EVIDENCE_LEVELS)[number]

/** Canonical field vocabulary — the union of every field any registry entry expects. Closed set
 *  so expectedFields/riskyFields can be validated (no free-text field names). */
export const CANONICAL_FIELDS = [
  // US immigration
  'first_name', 'last_name', 'dob', 'country_of_citizenship', 'class_of_admission',
  'admit_until_date', 'last_entry_date', 'i94_number', 'uscis_number', 'category', 'card_expires',
  'receipt_number', 'notice_date', 'case_type', 'applicant_name',
  'license_number', 'expiration_date', 'state',
  // passport
  'surname', 'given_names', 'passport_number', 'nationality', 'sex', 'date_of_issue', 'date_of_expiry',
  // civil records (UA/SU)
  'given_name', 'patronymic', 'birth_date', 'birth_place', 'father_name', 'mother_name',
  'parents', 'record_number', 'issue_date', 'spouse_1_name', 'spouse_2_name', 'marriage_date',
] as const
export type CanonicalFieldId = (typeof CANONICAL_FIELDS)[number]

// ─────────────────────────────────────────────────────────────────────────────
// Entry contract
// ─────────────────────────────────────────────────────────────────────────────
export interface CanonicalRegistryEntry {
  // identity
  id: DocumentTypeId
  displayName: string
  family: DocumentFamily
  countries: CountryCode[]
  issuingSystem: IssuingSystem
  supportedStatus: SupportedStatus
  // language & script
  scripts: ScriptCode[]
  languages: LanguageCode[]
  languageMode: LanguageMode
  // classification anchors
  printedAnchors: string[]
  negativeAnchors: string[]
  visualAnchors: string[]
  layoutHints: string[]
  machineReadableAnchors: string[]
  // routing
  serviceRoutes: ServiceRouteId[]
  readerRoute: ReaderRouteId
  allowedPageSides: PageSideId[]
  defaultPageSide: PageSideId
  // fields
  expectedFields: CanonicalFieldId[]
  requiredFields: CanonicalFieldId[]
  riskyFields: CanonicalFieldId[]
  machineReadableFields: CanonicalFieldId[]
  // policy
  handwritingPolicy: HandwritingPolicy
  reviewPolicy: ReviewPolicy
  minConfidenceToRoute: number
  minConfidenceToTrust: number
  providerPriority: ProviderId[]
  knownFailureModes: string[]
  externalBlockers: string[]
  // metrics (truth rule: nothing trusted without measurement)
  metricsStatus: SupportedStatus | 'UNVERIFIED'
  minimumNForTrust: number
  currentEvidenceLevel: EvidenceLevel
}

// Shared defaults so every entry carries the full schema without repetition noise.
const DEFAULTS = {
  negativeAnchors: [] as string[],
  visualAnchors: [] as string[],
  layoutHints: [] as string[],
  machineReadableAnchors: [] as string[],
  machineReadableFields: [] as CanonicalFieldId[],
  allowedPageSides: ['front', 'single'] as PageSideId[],
  defaultPageSide: 'front' as PageSideId,
  languageMode: 'monolingual' as LanguageMode,
  knownFailureModes: [] as string[],
  externalBlockers: [] as string[],
  metricsStatus: 'UNVERIFIED' as const,
  minimumNForTrust: 25,
  currentEvidenceLevel: 'none' as EvidenceLevel,
}

// ─────────────────────────────────────────────────────────────────────────────
// The registry
// ─────────────────────────────────────────────────────────────────────────────
export const CANONICAL_DOCUMENT_REGISTRY: Record<DocumentTypeId, CanonicalRegistryEntry> = {
  i94: {
    ...DEFAULTS,
    id: 'i94', displayName: 'US Form I-94 (Arrival/Departure Record)',
    family: 'us_immigration_record', countries: ['US'], issuingSystem: 'cbp', supportedStatus: 'PARTIAL',
    scripts: ['latin'], languages: ['en'], languageMode: 'monolingual',
    printedAnchors: ['I-94', 'Admission Record', 'Class of Admission', 'Admit Until Date'],
    machineReadableAnchors: ['i94_number'],
    serviceRoutes: ['tps', 'reparole', 'ead'], readerRoute: 'us_i94_reader',
    expectedFields: ['first_name', 'last_name', 'dob', 'country_of_citizenship', 'class_of_admission', 'admit_until_date', 'last_entry_date', 'i94_number'],
    requiredFields: ['first_name', 'last_name', 'i94_number'],
    riskyFields: ['dob', 'admit_until_date', 'last_entry_date', 'class_of_admission'],
    machineReadableFields: ['i94_number'],
    handwritingPolicy: 'not_expected', reviewPolicy: 'review_critical_dates',
    minConfidenceToRoute: 0.8, minConfidenceToTrust: 0.9,
    providerPriority: ['google_vision', 'openai', 'gemini'],
    // Vision billing was verified 403-off on 2026-06-22 but re-measured 200/paid on 2026-07-08,
    // so it is no longer an external blocker here (availability is measured, not assumed).
    externalBlockers: [] as string[],
    knownFailureModes: ['date_parser_format_mismatch', 'legacy_path_bypasses_shared_reader'],
  },
  ead_card: {
    ...DEFAULTS,
    id: 'ead_card', displayName: 'US Employment Authorization Card (I-766)',
    family: 'us_immigration_record', countries: ['US'], issuingSystem: 'uscis', supportedStatus: 'PARTIAL',
    scripts: ['latin'], languages: ['en'],
    printedAnchors: ['Employment Authorization Card', 'USCIS', 'Category', 'Card Expires'],
    serviceRoutes: ['ead', 'tps'], readerRoute: 'us_ead_card_reader',
    expectedFields: ['first_name', 'last_name', 'dob', 'uscis_number', 'category', 'card_expires'],
    requiredFields: ['first_name', 'last_name', 'uscis_number'],
    riskyFields: ['dob', 'category', 'card_expires', 'uscis_number'],
    handwritingPolicy: 'not_expected', reviewPolicy: 'review_all_identity_fields',
    minConfidenceToRoute: 0.8, minConfidenceToTrust: 0.9,
    providerPriority: ['google_vision', 'openai', 'gemini'],
  },
  i797_notice: {
    ...DEFAULTS,
    id: 'i797_notice', displayName: 'US Form I-797 (Notice of Action)',
    family: 'us_immigration_notice', countries: ['US'], issuingSystem: 'uscis', supportedStatus: 'SHADOW_ONLY',
    scripts: ['latin'], languages: ['en'],
    printedAnchors: ['I-797', 'Notice of Action', 'Receipt Number', 'USCIS'],
    serviceRoutes: ['tps', 'reparole', 'ead'], readerRoute: 'us_i797_reader',
    expectedFields: ['receipt_number', 'notice_date', 'case_type', 'applicant_name'],
    requiredFields: ['receipt_number'],
    riskyFields: ['receipt_number', 'notice_date', 'case_type'],
    handwritingPolicy: 'not_expected', reviewPolicy: 'review_receipt_and_dates',
    minConfidenceToRoute: 0.8, minConfidenceToTrust: 0.9,
    providerPriority: ['google_vision', 'openai', 'gemini'],
  },
  us_drivers_license: {
    ...DEFAULTS,
    id: 'us_drivers_license', displayName: 'US Driver License',
    family: 'driver_license', countries: ['US'], issuingSystem: 'dmv', supportedStatus: 'SHADOW_ONLY',
    scripts: ['latin'], languages: ['en'],
    printedAnchors: ['Driver License', 'DL', 'DOB', 'EXP'],
    serviceRoutes: ['tps', 'ead'], readerRoute: 'us_drivers_license_reader',
    expectedFields: ['first_name', 'last_name', 'dob', 'license_number', 'expiration_date', 'state'],
    requiredFields: ['first_name', 'last_name', 'license_number'],
    riskyFields: ['dob', 'expiration_date', 'license_number'],
    handwritingPolicy: 'not_expected', reviewPolicy: 'review_all_identity_fields',
    minConfidenceToRoute: 0.8, minConfidenceToTrust: 0.9,
    providerPriority: ['google_vision', 'openai', 'gemini'],
    knownFailureModes: ['Phase0 found no registry entry previously'],
  },
  passport: {
    ...DEFAULTS,
    id: 'passport', displayName: 'Passport (identity page)',
    family: 'identity_document', countries: ['UA', 'US', 'UNKNOWN'], issuingSystem: 'state_identity', supportedStatus: 'PARTIAL',
    scripts: ['latin', 'cyrillic', 'mixed'], languages: ['uk', 'en', 'mixed'], languageMode: 'bilingual',
    printedAnchors: ['PASSPORT', 'P<', 'Date of birth', 'Nationality'],
    visualAnchors: ['photo', 'mrz_zone'],
    machineReadableAnchors: ['MRZ', 'P<'],
    allowedPageSides: ['front', 'back', 'single'],
    serviceRoutes: ['translation', 'tps', 'reparole', 'ead'], readerRoute: 'passport_reader',
    expectedFields: ['surname', 'given_names', 'dob', 'passport_number', 'nationality', 'sex', 'date_of_issue', 'date_of_expiry'],
    requiredFields: ['surname', 'given_names', 'passport_number'],
    riskyFields: ['surname', 'given_names', 'dob', 'passport_number', 'date_of_expiry'],
    machineReadableFields: ['surname', 'given_names', 'passport_number', 'dob', 'date_of_expiry', 'sex', 'nationality'],
    handwritingPolicy: 'not_expected', reviewPolicy: 'review_identity_and_mrz_conflicts',
    minConfidenceToRoute: 0.85, minConfidenceToTrust: 0.95,
    providerPriority: ['openai', 'gemini', 'google_vision'],
    knownFailureModes: ['MRZ may omit punctuation/hyphen nuance', 'back page may be non-data page'],
    currentEvidenceLevel: 'pilot', // printed intl passport read cleanly via GPT this session
  },
  ua_birth_certificate_soviet: {
    ...DEFAULTS,
    id: 'ua_birth_certificate_soviet', displayName: 'Ukrainian Birth Certificate (Soviet-era)',
    family: 'civil_record', countries: ['SU', 'UA'], issuingSystem: 'soviet_legacy', supportedStatus: 'PARTIAL',
    scripts: ['cyrillic'], languages: ['ru', 'uk', 'mixed'], languageMode: 'bilingual',
    printedAnchors: ['СВИДЕТЕЛЬСТВО О РОЖДЕНИИ', 'СВІДОЦТВО ПРО НАРОДЖЕННЯ', 'УССР', 'родился', 'РОДИТЕЛИ'],
    serviceRoutes: ['translation'], readerRoute: 'civil_record_reader',
    expectedFields: ['surname', 'given_name', 'patronymic', 'birth_date', 'birth_place', 'father_name', 'mother_name', 'record_number', 'issue_date'],
    requiredFields: ['surname', 'given_name', 'birth_date'],
    riskyFields: ['surname', 'patronymic', 'birth_date', 'birth_place', 'father_name', 'mother_name', 'record_number', 'issue_date'],
    handwritingPolicy: 'force_review', reviewPolicy: 'force_review_handwritten_fields',
    minConfidenceToRoute: 0.85, minConfidenceToTrust: 0.95,
    providerPriority: ['htr', 'gemini', 'openai'],
    // NOTE: "blocker" here = OUR-OWN self-hosted HTR (raxtemur, open weights) not yet wired — our
    // infra work, NOT a third-party dependency. Kept in this list only so resolveReaderRouteFromRegistry
    // flags needsHTR; it is not a genuine external dependency like Google Vision billing.
    externalBlockers: ['htr_self_hosted_not_yet_wired'],
    knownFailureModes: ['LLM fabricates handwritten cursive', 'native crop does not reliably fix handwritten surname', 'contrast preprocessing does not fix GPT handwriting'],
    currentEvidenceLevel: 'pilot', // orientation+type+language proven on 1 real doc; handwriting NOT solved
  },
  ua_birth_certificate_modern: {
    ...DEFAULTS,
    id: 'ua_birth_certificate_modern', displayName: 'Ukrainian Birth Certificate (modern)',
    family: 'civil_record', countries: ['UA'], issuingSystem: 'ukraine_modern', supportedStatus: 'PLANNED',
    scripts: ['cyrillic'], languages: ['uk'],
    printedAnchors: ['СВІДОЦТВО ПРО НАРОДЖЕННЯ', 'Україна', 'народився', 'батьки'],
    serviceRoutes: ['translation'], readerRoute: 'civil_record_reader',
    expectedFields: ['surname', 'given_name', 'patronymic', 'birth_date', 'birth_place', 'parents', 'record_number', 'issue_date'],
    requiredFields: ['surname', 'given_name', 'birth_date'],
    riskyFields: ['surname', 'birth_date', 'parents', 'record_number'],
    handwritingPolicy: 'force_review_if_handwritten', reviewPolicy: 'review_civil_record_identity_fields',
    minConfidenceToRoute: 0.85, minConfidenceToTrust: 0.95,
    providerPriority: ['gemini', 'openai'],
  },
  ua_marriage_certificate: {
    ...DEFAULTS,
    id: 'ua_marriage_certificate', displayName: 'Ukrainian Marriage Certificate',
    family: 'civil_record', countries: ['UA', 'SU'], issuingSystem: 'ukraine_or_soviet_legacy', supportedStatus: 'PLANNED',
    scripts: ['cyrillic'], languages: ['uk', 'ru', 'mixed'], languageMode: 'bilingual',
    printedAnchors: ['шлюб', 'брак', 'marriage', 'актовий запис'],
    serviceRoutes: ['translation'], readerRoute: 'civil_record_reader',
    expectedFields: ['spouse_1_name', 'spouse_2_name', 'marriage_date', 'record_number', 'issue_date'],
    requiredFields: ['spouse_1_name', 'spouse_2_name'],
    riskyFields: ['spouse_1_name', 'spouse_2_name', 'marriage_date', 'record_number'],
    handwritingPolicy: 'force_review_if_handwritten', reviewPolicy: 'review_spouse_identity_fields',
    minConfidenceToRoute: 0.85, minConfidenceToTrust: 0.95,
    providerPriority: ['gemini', 'openai'],
  },
  // ── Fail-closed pseudo-types (honest states; never auto-proceed) ──
  unknown: {
    ...DEFAULTS,
    id: 'unknown', displayName: 'Unknown document', family: 'unknown', countries: ['UNKNOWN'],
    issuingSystem: 'unknown', supportedStatus: 'SUPPORTED_FAIL_CLOSED', scripts: ['unknown'], languages: ['unknown'],
    languageMode: 'unknown', printedAnchors: [], serviceRoutes: [], readerRoute: 'unknown_reader',
    allowedPageSides: ['unknown'], defaultPageSide: 'unknown',
    expectedFields: [], requiredFields: [], riskyFields: [],
    handwritingPolicy: 'unknown', reviewPolicy: 'manual_review_required',
    minConfidenceToRoute: 1, minConfidenceToTrust: 1, providerPriority: [],
  },
  unsupported: {
    ...DEFAULTS,
    id: 'unsupported', displayName: 'Recognized but unsupported document', family: 'unknown', countries: ['UNKNOWN'],
    issuingSystem: 'unknown', supportedStatus: 'SUPPORTED_FAIL_CLOSED', scripts: ['unknown'], languages: ['unknown'],
    languageMode: 'unknown', printedAnchors: [], serviceRoutes: [], readerRoute: 'unknown_reader',
    allowedPageSides: ['unknown'], defaultPageSide: 'unknown',
    expectedFields: [], requiredFields: [], riskyFields: [],
    handwritingPolicy: 'unknown', reviewPolicy: 'manual_review_required',
    minConfidenceToRoute: 1, minConfidenceToTrust: 1, providerPriority: [],
  },
  not_a_document: {
    ...DEFAULTS,
    id: 'not_a_document', displayName: 'Not a document', family: 'not_a_document', countries: [],
    issuingSystem: 'none', supportedStatus: 'SUPPORTED_FAIL_CLOSED', scripts: [], languages: [],
    languageMode: 'unknown', printedAnchors: [], serviceRoutes: [], readerRoute: 'none',
    allowedPageSides: ['unknown'], defaultPageSide: 'unknown',
    expectedFields: [], requiredFields: [], riskyFields: [],
    handwritingPolicy: 'none', reviewPolicy: 'reject_or_retake',
    minConfidenceToRoute: 1, minConfidenceToTrust: 1, providerPriority: [],
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// Validator (pure) — validateCanonicalDocumentRegistry
// ─────────────────────────────────────────────────────────────────────────────
export interface RegistryValidationResult {
  ok: boolean
  errors: string[]
}

export function validateCanonicalDocumentRegistry(
  reg: Record<string, CanonicalRegistryEntry> = CANONICAL_DOCUMENT_REGISTRY,
): RegistryValidationResult {
  const errors: string[] = []
  const entries = Object.entries(reg)
  const ids = entries.map(([, e]) => e.id)
  const knownField = new Set<string>(CANONICAL_FIELDS)
  const routeReaderTypes = new Set<string>(READER_ROUTE_IDS)
  const serviceTypes = new Set<string>(SERVICE_ROUTE_IDS)
  const familyTypes = new Set<string>(DOCUMENT_FAMILIES)
  const statusTypes = new Set<string>(SUPPORTED_STATUSES)
  const hwTypes = new Set<string>(HANDWRITING_POLICIES)
  const reviewTypes = new Set<string>(REVIEW_POLICIES)
  const providerTypes = new Set<string>(PROVIDER_IDS)

  // ids unique + key matches id
  const seen = new Set<string>()
  for (const [key, e] of entries) {
    if (key !== e.id) errors.push(`entry key '${key}' != id '${e.id}'`)
    if (seen.has(e.id)) errors.push(`duplicate id '${e.id}'`)
    seen.add(e.id)
  }
  // required pseudo-types
  for (const req of ['unknown', 'unsupported', 'not_a_document']) {
    if (!ids.includes(req as DocumentTypeId)) errors.push(`missing required fail-closed type '${req}'`)
  }
  // us_drivers_license must exist (Phase 0 gap)
  if (!ids.includes('us_drivers_license')) errors.push(`missing us_drivers_license (Phase 0 gap must be closed)`)

  for (const [, e] of entries) {
    const tag = `[${e.id}]`
    if (!familyTypes.has(e.family)) errors.push(`${tag} family not in enum: ${e.family}`)
    if (!statusTypes.has(e.supportedStatus)) errors.push(`${tag} supportedStatus not in enum: ${e.supportedStatus}`)
    if (!hwTypes.has(e.handwritingPolicy)) errors.push(`${tag} handwritingPolicy not in enum: ${e.handwritingPolicy}`)
    if (!reviewTypes.has(e.reviewPolicy)) errors.push(`${tag} reviewPolicy not in enum: ${e.reviewPolicy}`)
    if (!routeReaderTypes.has(e.readerRoute)) errors.push(`${tag} readerRoute not in enum: ${e.readerRoute}`)
    for (const s of e.serviceRoutes) if (!serviceTypes.has(s)) errors.push(`${tag} unknown serviceRoute: ${s}`)
    for (const p of e.providerPriority) if (!providerTypes.has(p)) errors.push(`${tag} unknown provider: ${p}`)
    // supported/partial/shadow → must have a real reader route (not 'none'/'unknown' unless fail-closed)
    const isActiveish = e.supportedStatus === 'LIVE' || e.supportedStatus === 'PARTIAL' || e.supportedStatus === 'SHADOW_ONLY'
    if (isActiveish && (e.readerRoute === 'none')) errors.push(`${tag} active status ${e.supportedStatus} but readerRoute 'none'`)
    // fields
    for (const f of e.expectedFields) if (!knownField.has(f)) errors.push(`${tag} expectedField not in canonical fields: ${f}`)
    for (const f of e.requiredFields) if (!e.expectedFields.includes(f)) errors.push(`${tag} requiredField '${f}' not in expectedFields`)
    for (const f of e.riskyFields) if (!e.expectedFields.includes(f)) errors.push(`${tag} riskyField '${f}' not in expectedFields`)
    for (const f of e.machineReadableFields) if (!e.expectedFields.includes(f)) errors.push(`${tag} machineReadableField '${f}' not in expectedFields`)
    // confidence ordering
    if (e.minConfidenceToRoute > e.minConfidenceToTrust) errors.push(`${tag} minConfidenceToRoute > minConfidenceToTrust`)
    // BLOCKED_EXTERNAL must never masquerade as LIVE
    if (e.supportedStatus === 'BLOCKED_EXTERNAL' && e.externalBlockers.length === 0) errors.push(`${tag} BLOCKED_EXTERNAL without externalBlockers`)
  }

  // handwritten civil records must force review
  for (const [, e] of entries) {
    if (e.family === 'civil_record' && e.issuingSystem === 'soviet_legacy') {
      if (e.handwritingPolicy !== 'force_review') errors.push(`[${e.id}] soviet civil record must be handwritingPolicy 'force_review'`)
    }
  }

  return { ok: errors.length === 0, errors }
}

/** Convenience getter (fail-closed to 'unknown' for an unrecognized id). */
export function getCanonicalEntry(id: string): CanonicalRegistryEntry {
  return (CANONICAL_DOCUMENT_REGISTRY as Record<string, CanonicalRegistryEntry>)[id] ?? CANONICAL_DOCUMENT_REGISTRY.unknown
}
