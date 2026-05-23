/**
 * @messenginfo/knowledge — Ukrainian terminology & transliteration
 * Dictionary v1.2 | KMU-55 engine | Normalization layer
 */
export { transliterateKMU55, convertDateToUSCIS } from './transliterate';
export type { OutputMode } from './transliterate';

export {
  normalizeName, normalizeDate, normalizeSex,
  normalizeAuthority, normalizePlace, validateOutput,
} from './normalize';
export type { NormalizedField, ControllingSpelling, NormalizationContext } from './normalize';

export {
  AUTHORITIES, AUTHORITY_PATTERNS, GEO_CORRECTIONS,
  SETTLEMENT_TYPES, FIELD_LABELS, SEX_MAP, GLOBAL_BLOCKLIST,
  OBLAST_GENITIVE_TO_NOMINATIVE, normalizeOblastToNominative,
} from './dictionary';
export type { AuthorityEntry, GeoCorrection, FieldLabel } from './dictionary';
