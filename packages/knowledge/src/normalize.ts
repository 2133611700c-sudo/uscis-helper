/**
 * Normalization Service — Phase 2
 * Takes raw OCR output → returns normalized fields with audit trail
 * 
 * Every field gets: raw_value, normalized_value, source, rule, confidence, review_required
 */

import { transliterateKMU55, transliterateRussian, detectNameScript, convertDateToUSCIS } from './transliterate';

/**
 * Romanize a NAME field by its OWN source script. A name whose own token carries a distinctive
 * Russian letter (ы/э/ё/ъ, no Ukrainian і/ї/є/ґ) → Russian table; UA and ambiguous ('unknown')
 * names → KMU-55. Same safety class as transliterationPolicy.romanizeBySourceScript: the script is
 * VISUALLY confirmed, not guessed, so it never Russifies a UA-or-ambiguous name (the regression the
 * gated RU_TRANSLIT_ENABLED path guards). Fixes Чёрный→Chernyy / Мышкин→Myshkin (KMU mis-Russified).
 * NOTE: ambiguous tokens (Сергеевич/Андрей, no distinctive letter) stay KMU — fixing those needs the
 * doc-level signal (gated romanizeNameForDocScript, owner decision).
 */
function romanizeNameBySourceScript(raw: string): string {
  return detectNameScript(raw) === 'ru' ? transliterateRussian(raw) : transliterateKMU55(raw);
}
import type { OutputMode } from './transliterate';
import {
  AUTHORITIES, AUTHORITY_PATTERNS, GEO_CORRECTIONS,
  SETTLEMENT_TYPES, FIELD_LABELS, SEX_MAP, GLOBAL_BLOCKLIST,
  normalizeOblastToNominative,
  type AuthorityEntry,
} from './dictionary';
import { lookupSettlement, translateCivilRegistryTerm } from './registry/registryLookup';

// ── TYPES ────────────────────────────────────────────────────

export interface NormalizedField {
  field: string;
  raw_value: string;
  normalized_value: string;
  source_document: string;
  rule_applied: string;
  confidence: number;
  review_required: boolean;
  review_reason?: string;
  controlling_spelling_conflict?: boolean;
}

export interface ControllingSpelling {
  field: string;
  latin_value: string;
  source: 'passport_mrz' | 'i94' | 'ead' | 'prior_uscis' | 'drivers_license';
}

export interface NormalizationContext {
  mode: OutputMode;
  controlling_spellings?: ControllingSpelling[];
  document_date?: string; // for historical authority detection
  is_historical_document?: boolean;
}

// ── CORE NORMALIZATION FUNCTIONS ─────────────────────────────

/**
 * Normalize a personal name field.
 * Priority: controlling spelling > raw Latin > KMU-55 transliteration
 */
export function normalizeName(
  raw: string,
  fieldType: 'surname' | 'given_name' | 'patronymic',
  source_doc: string,
  ctx: NormalizationContext,
): NormalizedField {
  const controlling = ctx.controlling_spellings?.find(
    cs => cs.field === fieldType
  );

  // Controlling spelling wins
  if (controlling) {
    const kmu55 = romanizeNameBySourceScript(raw);
    const conflict = kmu55.toLowerCase() !== controlling.latin_value.toLowerCase();
    return {
      field: fieldType,
      raw_value: raw,
      normalized_value: controlling.latin_value,
      source_document: source_doc,
      rule_applied: `controlling_spelling:${controlling.source}`,
      confidence: 0.99,
      review_required: conflict,
      review_reason: conflict
        ? `KMU-55 gives "${kmu55}" but controlling doc (${controlling.source}) has "${controlling.latin_value}"`
        : undefined,
      controlling_spelling_conflict: conflict,
    };
  }

  // Script-aware transliteration (KMU-55 for UA/ambiguous, Russian table for clearly-RU names)
  const normalized = romanizeNameBySourceScript(raw);
  return {
    field: fieldType,
    raw_value: raw,
    normalized_value: normalized,
    source_document: source_doc,
    rule_applied: detectNameScript(raw) === 'ru' ? 'ru_transliteration' : 'kmu55_transliteration',
    confidence: raw.length > 0 ? 0.90 : 0,
    review_required: false,
  };
}

/**
 * Normalize a date field to USCIS format (MM/DD/YYYY).
 */
export function normalizeDate(
  raw: string,
  field: string,
  source_doc: string,
): NormalizedField {
  const converted = convertDateToUSCIS(raw);
  if (!converted) {
    return {
      field,
      raw_value: raw,
      normalized_value: raw,
      source_document: source_doc,
      rule_applied: 'date_conversion_failed',
      confidence: 0.3,
      review_required: true,
      review_reason: `Could not parse date "${raw}" — manual entry required`,
    };
  }
  return {
    field,
    raw_value: raw,
    normalized_value: converted,
    source_document: source_doc,
    rule_applied: 'date_ua_to_uscis',
    confidence: 0.95,
    review_required: false,
  };
}

/**
 * Normalize sex/gender field.
 */
export function normalizeSex(raw: string, source_doc: string): NormalizedField {
  const trimmed = raw.trim();
  const mapped = SEX_MAP[trimmed] || SEX_MAP[trimmed.toLowerCase()];
  return {
    field: 'sex',
    raw_value: raw,
    normalized_value: mapped || raw,
    source_document: source_doc,
    rule_applied: mapped ? 'sex_map' : 'passthrough',
    confidence: mapped ? 0.99 : 0.5,
    review_required: !mapped,
    review_reason: mapped ? undefined : `Unknown sex value: "${raw}"`,
  };
}

/**
 * Normalize an authority/issuer name using the dictionary.
 * Handles historical mode: checks document text first, date as fallback.
 */
/**
 * Civil-registry authority enrichment (Step-8): a registry line like
 * "Тростянецкий райотдел ЗАГСа Винницкой обл." must NOT collapse to a bare
 * "Civil Registry Office (ZAGS)" — the DISTRICT and OBLAST are content, not noise.
 * Conservative by design: the OBLAST is derived reliably (genitive→nominative map);
 * the DISTRICT English form is only emitted when lookupSettlement CONFIRMS a real
 * settlement for the adjective stem (never fabricate a place name). Missing parts are
 * simply omitted. Returns the decorated value + whether anything was added.
 */
function enrichCivilRegistry(raw: string, baseEn: string): { value: string; enriched: boolean } {
  // ── district: leading adjective (Тростянецький/Тростянецкий + genitive forms) ──
  let districtEn: string | null = null
  const dm = raw.match(/^[\s«"(]*([А-ЯІЇЄҐ][А-Яа-яІЇЄҐіїєґ'’-]+?(?:ецьк|ецк|ськ|цьк|ск|цк|к)(?:ого|ий|ій|ому|им))/u)
  if (dm) {
    const W = dm[1]
    const endings = ['ецького', 'ецкого', 'ецький', 'ецкий', 'ського', 'ского', 'цького', 'цкого', 'ський', 'цький', 'ский', 'цкий', 'ького', 'кого', 'ого', 'ий', 'ій']
    const cands = new Set<string>([W])
    for (const e of endings) if (W.endsWith(e)) { const s = W.slice(0, -e.length); for (const suf of ['ець', 'ец', 'ь', 'ць', '']) cands.add(s + suf) }
    for (const c of cands) {
      if (c.length < 3) continue
      const hit = lookupSettlement(c)
      if (hit.matched && hit.official_en) { districtEn = `${hit.official_en} District`; break }
    }
  }
  // ── oblast: trailing genitive "<X> обл./область" → nominative English ──
  let oblastEn: string | null = null
  const om = raw.match(/([А-ЯІЇЄҐ][А-Яа-яІЇЄҐіїєґ'’-]+(?:ської|ской|цької|цкой|зької|зской|ої|ой))\s*(?:обл\.?|область|області)/u)
  if (om) {
    const o = normalizeOblastToNominative(`${om[1]} область`)
    if (o?.transliterated) oblastEn = /\boblast$/i.test(o.transliterated) ? o.transliterated : `${o.transliterated} Oblast`
  }
  if (!districtEn && !oblastEn) return { value: baseEn, enriched: false }
  let v = baseEn
  if (districtEn) v = `${districtEn} ${v}`
  if (oblastEn) v = `${v}, ${oblastEn}`
  return { value: v, enriched: true }
}

export function normalizeAuthority(
  raw: string,
  source_doc: string,
  ctx: NormalizationContext,
): NormalizedField {
  // Match against known authority patterns
  let matchedKey: string | undefined;
  for (const [pattern, key] of AUTHORITY_PATTERNS) {
    if (pattern.test(raw)) {
      matchedKey = key;
      break;
    }
  }

  if (!matchedKey) {
    return {
      field: 'issuing_authority',
      raw_value: raw,
      normalized_value: raw,
      source_document: source_doc,
      rule_applied: 'no_match_passthrough',
      confidence: 0.4,
      review_required: true,
      review_reason: `Authority "${raw}" not found in dictionary — manual translation required`,
    };
  }

  const entry = AUTHORITIES[matchedKey];
  if (!entry) {
    return {
      field: 'issuing_authority',
      raw_value: raw,
      normalized_value: raw,
      source_document: source_doc,
      rule_applied: 'dictionary_key_missing',
      confidence: 0.3,
      review_required: true,
      review_reason: `Matched key "${matchedKey}" but no dictionary entry`,
    };
  }

  // Civil registry: preserve district + oblast around the term (Step-8).
  if (matchedKey === 'CIVIL_REGISTRY') {
    const base = buildAuthorityResult(raw, entry, matchedKey, source_doc, ctx, `dictionary_match:${matchedKey}`)
    // Prefer the registry's sourced rendering ("Civil Registry Office (ZAGS)") as the base term.
    const reg = translateCivilRegistryTerm(raw, ctx.document_date)
    const baseTerm = reg.matched && reg.official_en ? reg.official_en : base.normalized_value
    const enr = enrichCivilRegistry(raw, baseTerm)
    if (enr.enriched) {
      return {
        ...base,
        normalized_value: enr.value,
        rule_applied: 'civil_registry_compound:district_oblast',
        confidence: 0.85,
        review_required: true,
        review_reason: 'Compound civil-registry authority (district/oblast preserved) — verify against source',
      }
    }
    return base
  }

  // Militsiya/Police transition: check text first, date as fallback
  if (matchedKey === 'NPU' && /міліці/i.test(raw)) {
    matchedKey = 'MILITSIYA';
    const mEntry = AUTHORITIES['MILITSIYA'];
    return buildAuthorityResult(raw, mEntry, 'MILITSIYA', source_doc, ctx,
      'text_override:militsiya_in_text');
  }

  return buildAuthorityResult(raw, entry, matchedKey, source_doc, ctx,
    `dictionary_match:${matchedKey}`);
}

function buildAuthorityResult(
  raw: string, entry: AuthorityEntry, key: string,
  source_doc: string, ctx: NormalizationContext,
  rule: string,
): NormalizedField {
  let value: string;
  switch (ctx.mode) {
    case 'legal_formal': value = entry.official_en; break;
    case 'uscis_normalized': value = entry.normalized_uscis_en; break;
    case 'plain': value = entry.plain_en_alias; break;
    default: value = entry.normalized_uscis_en;
  }

  return {
    field: 'issuing_authority',
    raw_value: raw,
    normalized_value: value,
    source_document: source_doc,
    rule_applied: rule,
    confidence: 0.92,
    review_required: false,
  };
}

/**
 * Normalize a place name (city/village/region).
 * Handles: KMU-55 transliteration, geography corrections,
 * settlement type expansion, historical preservation.
 */
export function normalizePlace(
  raw: string,
  field: string,
  source_doc: string,
  ctx: NormalizationContext,
): NormalizedField {
  let reviewRequired = false;
  let reviewReason: string | undefined;

  // Auto-convert genitive oblast to nominative + transliterate
  // "Вінницької області" → "Vinnytsia Oblast"
  const oblastResult = normalizeOblastToNominative(raw);
  if (oblastResult) {
    return {
      field,
      raw_value: raw,
      normalized_value: oblastResult.transliterated,
      source_document: source_doc,
      rule_applied: `oblast_genitive_to_nominative:${oblastResult.nominative_uk}`,
      confidence: 0.92,
      review_required: false,
      controlling_spelling_conflict: false,
    };
  }

  let normalized = transliterateKMU55(raw);
  let rule = 'kmu55_transliteration';

  // Check if this is a renamed city in a historical document
  if (ctx.is_historical_document) {
    for (const gc of GEO_CORRECTIONS) {
      if (gc.renamed_year && gc.historical_preserve) {
        const histLower = gc.historical_preserve.toLowerCase();
        if (normalized.toLowerCase().includes(histLower) ||
            raw.toLowerCase().includes(gc.wrong.toLowerCase())) {
          // Keep historical form — do NOT modernize
          rule = `historical_preserve:${gc.historical_preserve}`;
          break;
        }
      }
    }
  }

  // Apply geography corrections for modern context. Match BOTH the Russian/old
  // Latin form (gc.wrong, e.g. "Kirovograd") AND the KMU-55 form of the old name
  // (gc.historical_preserve, e.g. "Kirovohrad") — the latter is what KMU-55
  // produces from the Ukrainian Cyrillic, so without it the modern rename
  // (Кіровоград→Kropyvnytskyi, Дніпропетровськ→Dnipro) never fired on Cyrillic input.
  if (!ctx.is_historical_document) {
    for (const gc of GEO_CORRECTIONS) {
      const wrongLower = gc.wrong.toLowerCase();
      const histLower = gc.historical_preserve?.toLowerCase();
      if (normalized.toLowerCase() === wrongLower || (histLower && normalized.toLowerCase() === histLower)) {
        if (gc.renamed_year) {
          // RENAMED city (Дніпропетровськ→Dnipro 2016, Кіровоград→Kropyvnytskyi
          // 2016). Do NOT silently modernize: we cannot reliably know the
          // document's date, and CLAUDE.md requires historical place names be
          // PRESERVED. Keep the read (historical) form and flag REVIEW with the
          // modern name as a suggestion — the operator decides from the document
          // date they can see. (Was: silent overwrite → era-wrong translations.)
          reviewRequired = true;
          reviewReason = `Renamed place: document reads "${normalized}"; modern name is "${gc.correct}" (renamed ${gc.renamed_year}). Preserve the historical name unless the document post-dates the rename.`;
          rule = `geo_rename_review:${normalized}->${gc.correct}`;
        } else {
          normalized = gc.correct;
          rule = `geo_correction:${gc.wrong}->${gc.correct}`;
        }
        break;
      }
    }
  }

  // Expand settlement type abbreviations.
  //
  // A designator must be a WHOLE TOKEN, not a bare prefix. The previous
  // `startsWith(abbr)` test matched any string that merely began with the
  // designator letters — so the bare key «м» («м.»/«місто» → "city") split
  // «МОРИНЦІ» into «М» + «ОРИНЦІ» and emitted "city ORYNTSI", corrupting every
  // place whose NAME starts with М (Моринці, Миколаїв, Маріуполь, Мелітополь,
  // Мукачево) — and likewise «с» would have eaten «Село…»-shaped names, etc.
  //
  // A real designator is delimited from the place name: it ends with a dot
  // («м.», «смт.»), or is a standalone word followed by whitespace («місто Львів»,
  // «смт Вишневе»). We therefore require, AFTER the designator, either a dot
  // (when the abbr doesn't already include one) or a space — i.e. a separator —
  // before the place name. When the abbr already ends with «.», the dot itself
  // is the boundary. If no boundary follows, the leading characters are part of
  // the place name, not a designator, and we MUST NOT split (conservative: keep
  // the whole string as the place name).
  const rawTrimmed = raw.trimStart();
  const rawLower = rawTrimmed.toLowerCase();
  for (const [abbr, info] of Object.entries(SETTLEMENT_TYPES)) {
    const abbrLower = abbr.toLowerCase();
    if (!rawLower.startsWith(abbrLower)) continue;

    const after = rawTrimmed.slice(abbr.length);
    const endsWithDot = abbr.endsWith('.');
    // Boundary required unless the abbr itself supplied a trailing dot:
    //   «м.» → next char already past the dot, separator satisfied by the dot
    //   «місто»/«смт» → must be followed by a dot or whitespace
    const hasBoundary = endsWithDot || after.length === 0 || /^[\s.]/.test(after);
    if (!hasBoundary) continue;

    const remainder = after.replace(/^[\s.]+/, '').trim();
    // A designator with no place name after it is not a place expansion — skip
    // (e.g. a stray «м.» alone should not become "city ").
    if (remainder.length === 0) continue;

    const translitPlace = transliterateKMU55(remainder);
    // PREFIX, mirroring «смт Х» order ("urban-type settlement X"), consistent
    // with the translation adapter.
    normalized = `${info.en} ${translitPlace}`;
    rule = `settlement_type:${abbr}`;
    break;
  }

  // Check controlling spelling conflicts
  const controlling = ctx.controlling_spellings?.find(cs => cs.field === field);
  if (controlling) {
    const conflict = normalized.toLowerCase() !== controlling.latin_value.toLowerCase();
    if (conflict) {
      reviewRequired = true;
      reviewReason = `Normalized: "${normalized}" but USCIS record has "${controlling.latin_value}". Human must decide.`;
    }
  }

  return {
    field,
    raw_value: raw,
    normalized_value: normalized,
    source_document: source_doc,
    rule_applied: rule,
    confidence: 0.88,
    review_required: reviewRequired,
    review_reason: reviewReason,
    controlling_spelling_conflict: reviewRequired,
  };
}

/**
 * Validate that a normalized value doesn't contain blocked terms.
 */
export function validateOutput(field: NormalizedField): NormalizedField {
  for (const blocked of GLOBAL_BLOCKLIST) {
    if (field.normalized_value.includes(blocked)) {
      return {
        ...field,
        review_required: true,
        review_reason: `BLOCKED TERM DETECTED: "${blocked}" in output. Rule violation.`,
        confidence: 0,
      };
    }
  }
  // Patronymic must never be labeled as Middle Name
  if (field.field === 'patronymic') {
    const label = FIELD_LABELS['patronymic'];
    if (label.do_not_use?.some(bad => field.normalized_value.includes(bad))) {
      return {
        ...field,
        review_required: true,
        review_reason: 'Patronymic field contains "Middle Name" — BLOCKED',
        confidence: 0,
      };
    }
  }
  return field;
}
