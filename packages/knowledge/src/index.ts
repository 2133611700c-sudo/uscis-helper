/**
 * @messenginfo/knowledge — Ukrainian terminology & transliteration
 * Dictionary v1.3 | KMU-55 engine | Normalization layer | TPS Requirements
 */
export { transliterateKMU55, transliterateRussian, detectNameScript, detectDocumentScript, convertDateToUSCIS, UA_MONTHS } from './transliterate';
export type { OutputMode } from './transliterate';

// D2 Validator — patronymic (по батькові) engine: validate a read, reconstruct
// from given name + sex, reject OCR suffix fragments ("ович"/"Yovych").
export { isValidPatronymic, generatePatronymic, reconcilePatronymic } from './patronymic';
export { isValidPatronymicRu, generatePatronymicRu, reconcilePatronymicRu, sexFromPatronymic } from './patronymic';
export type { Sex, PatronymicResult } from './patronymic';

// D2 Validator — gazetteer: snap a handwriting-OCR place reading to a real
// Ukrainian place via Cyrillic-confusion-weighted edit distance.
export { snapCity, confusionDistance, GAZETTEER, isKnownSettlement, isKnownRaion } from './gazetteer';
export type { PlaceMatch } from './gazetteer';

// D2 CONSTRAINED-VOCABULARY auto-correction — snap a near-miss read to the UNIQUE
// nearest closed-set entry (oblast/sex/civil_status/country/date). Ambiguity ⇒ no
// correction (the caller keeps suggest/review). Gated by the caller's flag.
export {
  autoCorrectOblast, autoCorrectSex, autoCorrectCivilStatus,
  autoCorrectCountry, autoCorrectDateParts, AUTOCORRECT_THRESHOLD,
} from './autocorrect';
export type { AutoCorrectMatch, DateParts } from './autocorrect';

// S3 no-silent-correction — format a Latin person name without corrupting its
// controlling spelling (O'Brien / hyphenated / multi-word / deliberate mixed case).
export { formatLatinName } from './formatName';

// Civil registry terminology (birth/marriage/divorce certificates)
// eslint-disable-next-line @typescript-eslint/no-var-requires
export { default as civilRegistryTerms } from './civil_registry_terms.json';

export {
  normalizeName, normalizeDate, normalizeSex,
  normalizeAuthority, normalizePlace, validateOutput,
} from './normalize';
export type { NormalizedField, ControllingSpelling, NormalizationContext } from './normalize';

// TPS Ukraine procedural requirements (fees, eligibility, forms, common mistakes)
export {
  TPS_UKRAINE_ELIGIBILITY,
  TPS_FILING_TYPES,
  TPS_FORMS,
  TPS_FEES,
  EAD_CATEGORIES,
  SUBMISSION_RULES,
  COMMON_MISTAKES,
} from './tps_ukraine_requirements';
export type { TpsFilingType } from './tps_ukraine_requirements';

export {
  AUTHORITIES, AUTHORITY_PATTERNS, GEO_CORRECTIONS,
  SETTLEMENT_TYPES, settlementDesignatorEn, FIELD_LABELS, SEX_MAP, GLOBAL_BLOCKLIST,
  OBLAST_GENITIVE_TO_NOMINATIVE, normalizeOblastToNominative,
  DOCUMENT_TYPES, CIVIL_STATUS,
  COUNTRIES, lookupCountry, normalizeForeignPlace,
} from './dictionary';
export type { AuthorityEntry, GeoCorrection, FieldLabel, DocumentTypeEntry } from './dictionary';

// D-GLOSSARY — unified Glossary Registry (G1/G2). Single source of truth with
// provenance + era-gating. Runtime-safe (no fs; reads the generated rows).
export {
  lookupRegistry, lookupAuthority, lookupSettlement, normalizeSettlementType,
  normalizeOblastRegistry, translateCivilRegistryTerm, translatePassportAuthority,
  resolveAbbreviation, registryCatalog,
} from './registry/registryLookup';
export type { RegistryCategory, LookupResult, LookupOptions, RegistryRow } from './registry/registry.schema';

// U-STAGE 6 — document-number / series FORMAT validators (pure, additive).
// Single codex place to validate the SHAPE of UA/US doc numbers + EAD category map.
export {
  validateDocNumber, DOC_NUMBER_FORMATS, US_SERVICE_CENTER_PREFIXES,
  EAD_CATEGORY_MEANINGS, lookupEadCategory,
} from './docNumberFormats';
export type { DocNumberKind, DocNumberResult } from './docNumberFormats';

// MRZ (passport machine-readable zone) — controlling Latin name/number/DOB.
export { parseMrz, checkDigit, findMrzLines, findTd1Lines } from './mrz';
export { classifyGarbage, isGarbageValue } from './garbageGuard';
export type { MrzResult } from './mrz';
