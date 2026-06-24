/**
 * Document-number / series FORMAT validators (U-STAGE 6 — Codex dictionary DATA)
 *
 * PURPOSE: a single, source-cited place where ANY consumer (vision arbiter,
 * DeepSeek brain, TPS field maps, translation layer) can VALIDATE the *shape* of
 * a document number/series. This is a pure validator: data + format checks only,
 * NO behavior change to existing consumers (additive; opt-in).
 *
 * CONTRACT — this is for a LEGAL document:
 *   - Be PRECISE. Conservative by design.
 *   - When unsure, return { valid: false } (forces human review). NEVER a
 *     false-accept of a malformed number on a legal filing.
 *   - `normalized` is returned ONLY when we are confident of the canonical form
 *     (uppercased, separators regularized). It never invents missing characters.
 *
 * SOURCES (format facts):
 *   UA international passport (ID-3 booklet/card): 2 letters + 6 digits, e.g. MX481390
 *     — dmsu.gov.ua passport spec; ICAO Doc 9303 document-number field.
 *   UA ID card (паспорт громадянина України, ID-1) record number: 9 digits
 *     — dmsu.gov.ua "номер запису в Єдиному державному демографічному реєстрі".
 *   UA certificate series (свідоцтва ДРАЦС/РАЦС): Roman numerals + "-" + 2
 *     Cyrillic letters + " №" + digits, e.g. "II-БК № 530174" — КМУ №1025 acts.
 *   UA military ticket (військовий квиток): 2 Cyrillic letters + 6 digits,
 *     e.g. "НК 307258" — Міноборони військовий квиток blank.
 *   US A-Number (Alien Registration Number): "A" + up to 9 digits — USCIS;
 *     modern filings use exactly 9 digits (zero-padded).
 *   US EAD (Form I-766) card number: 3 letters + 10 digits, e.g. SRC2290012345
 *     — USCIS service-center prefix (EAC/WAC/SRC/MSC/LIN/IOE) + 10 digits.
 *   US EAD category code: letter + 2 digits, e.g. C08, C19, A12 — 8 CFR 274a.12.
 *   US I-94 admission number: 11 characters (digits; CBP legacy paper forms may
 *     carry a trailing letter) — CBP I-94 spec.
 *   US I-797 receipt number: 3-letter service-center prefix
 *     (EAC/WAC/SRC/MSC/LIN/IOE) + 10 digits — USCIS receipt format.
 *
 * NOTE (out of scope, next data step): the full КАТОТТГ village/raion tier is NOT
 * loaded here — it requires an external data download + a bundle-size decision and
 * is the next dictionary-data stage. This module is numbers/series only.
 */

export type DocNumberKind =
  | 'ua_intl_passport'
  | 'ua_id_card_record'
  | 'ua_certificate_series'
  | 'ua_military_ticket'
  | 'us_a_number'
  | 'us_ead_card'
  | 'us_ead_category'
  | 'us_i94'
  | 'us_i797_receipt';

export interface DocNumberResult {
  valid: boolean;
  /** Canonical/normalized form — present ONLY when valid and confidently canonical. */
  normalized?: string;
  /** Why it was rejected (review hint). Present only when valid === false. */
  reason?: string;
}

// USCIS / CBP service-center (lockbox) prefixes used on I-797 receipts and the
// EAD card number. IOE = electronic/ELIS filings. Source: USCIS receipt format.
export const US_SERVICE_CENTER_PREFIXES = ['EAC', 'WAC', 'SRC', 'MSC', 'LIN', 'IOE'] as const;

// ── REGEXES ──────────────────────────────────────────────────
// Cyrillic letter class (Ukrainian uppercase set incl. Ґ Є І Ї).
const CYR = '[А-ЩЬЮЯҐЄІЇ]';
// Latin OR Cyrillic letter (the UA passport doc-number field is printed in a
// font where many letters are visually Latin/Cyrillic identical; ICAO requires
// A–Z, but readers/OCR may yield a Cyrillic look-alike — accept both, normalize
// the latin-identical ones is NOT done here to avoid changing the legal value).
const LAT_OR_CYR = '[A-ZА-ЩЬЮЯҐЄІЇ]';

export const DOC_NUMBER_FORMATS: Record<DocNumberKind, RegExp> = {
  // 2 letters (Latin or Cyrillic look-alike) + 6 digits, e.g. MX481390
  ua_intl_passport: new RegExp(`^${LAT_OR_CYR}{2}\\d{6}$`),
  // 9 digits
  ua_id_card_record: /^\d{9}$/,
  // Roman numerals + "-" + 2 Cyrillic letters + " №" + digits, e.g. "II-БК № 530174"
  // Roman set restricted to the characters that actually appear on series blanks.
  ua_certificate_series: new RegExp(`^[IVXLCDM]+-${CYR}{2}\\s*№\\s*\\d+$`),
  // 2 Cyrillic letters + 6 digits, e.g. "НК 307258"
  ua_military_ticket: new RegExp(`^${CYR}{2}\\s*\\d{6}$`),
  // "A" + exactly 9 digits (modern zero-padded A-Number)
  us_a_number: /^A\d{9}$/,
  // 3 letters + 10 digits, e.g. SRC2290012345
  us_ead_card: /^[A-Z]{3}\d{10}$/,
  // letter + 2 digits, e.g. C08, C19, A12
  us_ead_category: /^[A-Z]\d{2}$/,
  // 11 chars: 11 digits, OR 10 digits + 1 trailing letter (legacy paper I-94)
  us_i94: /^(?:\d{11}|\d{10}[A-Z])$/,
  // 3-letter service-center prefix + 10 digits
  us_i797_receipt: /^[A-Z]{3}\d{10}$/,
};

// Normalizers per kind: collapse internal whitespace, uppercase. We do NOT
// invent characters or pad — only regularize separators/case.
function preNormalize(kind: DocNumberKind, raw: string): string {
  const upper = raw.trim().toUpperCase();
  switch (kind) {
    case 'ua_certificate_series':
      // canonical " №" spacing: "II-БК № 530174"
      return upper
        .replace(/\s+/g, ' ')
        .replace(/\s*-\s*/g, '-')
        .replace(/\s*№\s*/g, ' № ')
        .trim();
    case 'ua_military_ticket':
      // canonical single space between the 2 letters and 6 digits: "НК 307258"
      return upper
        .replace(/\s+/g, '')
        .replace(/^([А-ЩЬЮЯҐЄІЇ]{2})(\d{6})$/u, '$1 $2');
    case 'ua_intl_passport':
    case 'ua_id_card_record':
    case 'us_a_number':
    case 'us_ead_card':
    case 'us_ead_category':
    case 'us_i94':
    case 'us_i797_receipt':
      // these have no internal separators — strip ALL whitespace
      return upper.replace(/\s+/g, '');
    default:
      return upper;
  }
}

// Extra semantic checks beyond the regex (kept conservative).
function semanticReason(kind: DocNumberKind, normalized: string): string | null {
  if (kind === 'us_i797_receipt' || kind === 'us_ead_card') {
    const prefix = normalized.slice(0, 3);
    if (!US_SERVICE_CENTER_PREFIXES.includes(prefix as (typeof US_SERVICE_CENTER_PREFIXES)[number])) {
      return `unknown_service_center_prefix:${prefix}`;
    }
  }
  return null;
}

/**
 * Validate the FORMAT of a document number / series for the given kind.
 *
 * Returns { valid, normalized?, reason? }. Conservative: empty/non-string and
 * any non-match → { valid:false } so the caller routes to review. Never throws.
 *
 * @example
 *   validateDocNumber('ua_intl_passport', 'MX481390')      // { valid:true, normalized:'MX481390' }
 *   validateDocNumber('us_a_number', 'A123456789')         // { valid:true, normalized:'A123456789' }
 *   validateDocNumber('us_ead_card', 'SRC2290012345')      // { valid:true, normalized:'SRC2290012345' }
 *   validateDocNumber('us_a_number', 'A12345')             // { valid:false, reason:'format_mismatch' }
 */
export function validateDocNumber(
  kind: DocNumberKind,
  value: string | null | undefined,
): DocNumberResult {
  if (!value || typeof value !== 'string') {
    return { valid: false, reason: 'empty_or_non_string' };
  }
  const re = DOC_NUMBER_FORMATS[kind];
  if (!re) {
    return { valid: false, reason: `unknown_kind:${String(kind)}` };
  }
  const normalized = preNormalize(kind, value);
  if (!normalized) {
    return { valid: false, reason: 'empty_after_normalize' };
  }
  if (!re.test(normalized)) {
    return { valid: false, reason: 'format_mismatch' };
  }
  const semantic = semanticReason(kind, normalized);
  if (semantic) {
    return { valid: false, reason: semantic };
  }
  return { valid: true, normalized };
}

// ── EAD CATEGORY → MEANING (display data only — NOT a decision) ────────────────
// Small display map so a UI/translation can show what an EAD category code means.
// This is informational only; eligibility/decision logic lives elsewhere and must
// NOT branch on this map. Source: 8 CFR 274a.12 eligibility-category list.
export const EAD_CATEGORY_MEANINGS: Record<string, string> = {
  A12: 'TPS approved',
  C19: 'TPS pending',
  C08: 'asylum application pending',
  C09: 'adjustment of status (AOS) pending',
};

/** Look up the human-readable meaning of an EAD category code (display only). */
export function lookupEadCategory(code: string | null | undefined): string | null {
  if (!code || typeof code !== 'string') return null;
  return EAD_CATEGORY_MEANINGS[code.trim().toUpperCase()] ?? null;
}
