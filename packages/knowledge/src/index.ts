/**
 * @messenginfo/knowledge — Ukrainian terminology & transliteration
 * Dictionary v1.3 | KMU-55 engine | Normalization layer | TPS Requirements
 */
export { transliterateKMU55, convertDateToUSCIS } from './transliterate';
export type { OutputMode } from './transliterate';

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
  SETTLEMENT_TYPES, FIELD_LABELS, SEX_MAP, GLOBAL_BLOCKLIST,
  OBLAST_GENITIVE_TO_NOMINATIVE, normalizeOblastToNominative,
  DOCUMENT_TYPES,
} from './dictionary';
export type { AuthorityEntry, GeoCorrection, FieldLabel, DocumentTypeEntry } from './dictionary';
