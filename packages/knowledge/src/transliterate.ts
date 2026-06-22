/**
 * KMU-55 Ukrainian Transliteration Engine
 * Source: CMU Resolution No.55 (27 Jan 2010)
 * Verified: czo.gov.ua/en/translit, mfa.gov.ua/en/correctua
 */

// Standard mappings (non-position-dependent)
const MAP: Record<string, string> = {
  'А': 'A', 'а': 'a', 'Б': 'B', 'б': 'b', 'В': 'V', 'в': 'v',
  'Г': 'H', 'г': 'h', 'Ґ': 'G', 'ґ': 'g', 'Д': 'D', 'д': 'd',
  'Е': 'E', 'е': 'e', 'Ж': 'Zh', 'ж': 'zh', 'З': 'Z', 'з': 'z',
  'И': 'Y', 'и': 'y', 'І': 'I', 'і': 'i', 'К': 'K', 'к': 'k',
  'Л': 'L', 'л': 'l', 'М': 'M', 'м': 'm', 'Н': 'N', 'н': 'n',
  'О': 'O', 'о': 'o', 'П': 'P', 'п': 'p', 'Р': 'R', 'р': 'r',
  'С': 'S', 'с': 's', 'Т': 'T', 'т': 't', 'У': 'U', 'у': 'u',
  'Ф': 'F', 'ф': 'f', 'Х': 'Kh', 'х': 'kh', 'Ц': 'Ts', 'ц': 'ts',
  'Ч': 'Ch', 'ч': 'ch', 'Ш': 'Sh', 'ш': 'sh',
  'Щ': 'Shch', 'щ': 'shch',
};

// Position-dependent: word-initial
const INITIAL: Record<string, string> = {
  'Є': 'Ye', 'є': 'ye', 'Ї': 'Yi', 'ї': 'yi',
  'Й': 'Y', 'й': 'y', 'Ю': 'Yu', 'ю': 'yu', 'Я': 'Ya', 'я': 'ya',
};

// Position-dependent: non-initial
const MIDDLE: Record<string, string> = {
  'Є': 'Ie', 'є': 'ie', 'Ї': 'I', 'ї': 'i',
  'Й': 'I', 'й': 'i', 'Ю': 'Iu', 'ю': 'iu', 'Я': 'Ia', 'я': 'ia',
};

// Characters to skip (soft sign, hard sign, apostrophe variants)
const SKIP = new Set(["Ь", "ь", "Ъ", "ъ", "'", "'", "ʼ", "\u0027"]);

// Ukrainian Cyrillic character check
const UA_CYRILLIC = /[\u0400-\u04FF\u0490\u0491]/;

// Russian-only letters with NO Ukrainian KMU-55 mapping \u2192 romanize so KMU-55 output
// can NEVER leak raw Cyrillic. See the defense-in-depth note in transliterateKMU55.
// BGN/PCGN Russian convention (\u042D\u2192E, \u042B\u2192Y, \u0401\u2192Ye). Re-added after an integration regression.
const KMU_RU_FALLBACK: Record<string, string> = {
  "\u0401": "Ye", "\u0451": "ye", "\u042D": "E", "\u044D": "e", "\u042B": "Y", "\u044B": "y",
};

function isWordStart(text: string, i: number): boolean {
  if (i === 0) return true;
  // Look back past apostrophes/soft signs to find the real previous character
  let j = i - 1;
  while (j >= 0 && SKIP.has(text[j])) j--;
  if (j < 0) return true;
  const prev = text[j];
  return !UA_CYRILLIC.test(prev) && !MAP[prev] && !INITIAL[prev] && !MIDDLE[prev];
}

/**
 * Transliterate Ukrainian Cyrillic text to Latin per KMU-55.
 * Handles: position-dependent letters, ЗГ→Zgh, soft sign, apostrophe.
 * Auto-detects ALL-CAPS input and uppercases output accordingly.
 */
export function transliterateKMU55(input: string): string {
  if (!input) return '';
  
  // Detect if input is ALL-CAPS Cyrillic (for passport/MRZ-like input)
  const cyrillicChars = input.split('').filter(c => UA_CYRILLIC.test(c));
  const isAllCaps = cyrillicChars.length > 0 && cyrillicChars.every(c => c === c.toUpperCase() && c !== c.toLowerCase());

  const result: string[] = [];
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];

    // Skip soft sign and apostrophe
    if (SKIP.has(ch)) continue;

    // Special case: ЗГ → Zgh (not Zh)
    if ((ch === 'З' || ch === 'з') && i + 1 < input.length && (input[i + 1] === 'Г' || input[i + 1] === 'г')) {
      result.push(ch === 'З' ? 'Zgh' : 'zgh');
      i++; // skip the Г
      continue;
    }

    // Position-dependent letters
    if (INITIAL[ch]) {
      result.push(isWordStart(input, i) ? INITIAL[ch] : MIDDLE[ch]);
      continue;
    }

    // Standard mapping
    if (MAP[ch]) {
      result.push(MAP[ch]);
      continue;
    }

    // DEFENSE-IN-DEPTH (no-Cyrillic-leak): KMU-55 is the Ukrainian table and has no
    // mapping for the Russian-only letters Ё/Э/Ы (Ъ/Ь are in SKIP). Without this they
    // fall to the pass-through below and LEAK as raw Cyrillic into the Latin value
    // (СОЛОВЬЁВ→SOLOVЁV). The correct fix for clearly-Russian source is to route to the
    // Russian table (transliterationPolicy.romanizeBySourceScript); this map guarantees
    // KMU-55 output can NEVER contain a U+0400–U+04FF char even if a Russian letter
    // reaches it. BGN/PCGN Russian convention (Э→E, Ы→Y, Ё→Ye). [Re-added after an
    // integration regression clobbered it; caught by a live ru_printed leak.]
    if (KMU_RU_FALLBACK[ch]) {
      result.push(KMU_RU_FALLBACK[ch]);
      continue;
    }

    // Pass through non-Cyrillic characters
    result.push(ch);
  }
  const output = result.join('');
  return isAllCaps ? output.toUpperCase() : output;
}

// ── Russian as-written romanization — BGN/PCGN (owner-approved 2026-06-10) ────
// A Soviet/bilingual line written in RUSSIAN uses BGN/PCGN simplified Russian, NOT
// KMU-55 (Ukrainian, which would give г→h, и→y). Required outputs:
//   Иван→Ivan · Иванович→Ivanovich · Петрович→Petrovich
//   Ганна→Hanna · Петрівна→Petrivna · Іваненко→Ivanenko
// BGN/PCGN rule that matters here: е/ё → "ye"/"yё" at word start, after a vowel,
// or after ъ/ь; "e"/"ё→e" after a consonant. я→ya, ю→yu, й→y, ы→y, э→e, ъ/ь→omit.
const RU_BASE: Record<string, string> = {
  'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd',
  'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
  'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
  'ф': 'f', 'х': 'kh', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'shch',
  'ы': 'y', 'э': 'e', 'ю': 'yu', 'я': 'ya',
}
const RU_SKIP = new Set(['ъ', 'ь'])
const RU_VOWELS = new Set(['а', 'е', 'ё', 'и', 'о', 'у', 'ы', 'э', 'ю', 'я'])

/** Transliterate RUSSIAN Cyrillic to Latin per BGN/PCGN simplified (as-written). */
export function transliterateRussian(input: string): string {
  if (!input) return ''
  const out: string[] = []
  const chars = [...input]
  for (let k = 0; k < chars.length; k++) {
    const ch = chars[k]
    const lower = ch.toLowerCase()
    const isUpper = ch === ch.toUpperCase() && ch !== ch.toLowerCase()

    if (RU_SKIP.has(lower)) continue

    // е/ё are position-dependent: "ye" at start / after vowel / after ъ,ь; else "e".
    if (lower === 'е' || lower === 'ё') {
      // find the previous source char (skipping ъ/ь, which we drop)
      let j = k - 1
      while (j >= 0 && RU_SKIP.has(chars[j].toLowerCase())) j--
      const prev = j >= 0 ? chars[j].toLowerCase() : null
      const yeForm = prev === null || RU_VOWELS.has(prev) || (k - 1 >= 0 && RU_SKIP.has(chars[k - 1].toLowerCase()))
      const base = yeForm ? 'ye' : 'e'
      out.push(isUpper ? base.charAt(0).toUpperCase() + base.slice(1) : base)
      continue
    }

    const mapped = RU_BASE[lower]
    if (mapped === undefined) { out.push(ch); continue } // pass through non-Cyrillic
    out.push(isUpper ? mapped.charAt(0).toUpperCase() + mapped.slice(1) : mapped)
  }
  return out.join('')
}

/** Cyrillic letters that exist ONLY in Russian (not Ukrainian) — a script signal. */
const RU_ONLY = /[ыэёъ]/i
/** Ukrainian-only letters (not Russian) — a script signal. */
const UA_ONLY = /[іїєґ]/i

/**
 * Decide which transliteration system a name line should use, by its SOURCE script.
 * Returns 'ru' for Russian-script lines, 'ua' for Ukrainian, 'unknown' when ambiguous.
 * NOTE: ambiguity (shared letters) is NOT auto-resolved here — the caller should
 * review rather than guess (the project's as-written, no-harmonize rule).
 */
export function detectNameScript(input: string): 'ua' | 'ru' | 'unknown' {
  const s = input ?? ''
  const ua = UA_ONLY.test(s)
  const ru = RU_ONLY.test(s)
  if (ua && !ru) return 'ua'
  if (ru && !ua) return 'ru'
  return 'unknown' // both or neither distinctive letter → caller decides/reviews
}

/**
 * Convert Ukrainian date string to USCIS format (MM/DD/YYYY).
 * Input: "01 січня 1990 року" or "01.01.1990"
 */
export const UA_MONTHS: Record<string, string> = {
  'січня': '01', 'лютого': '02', 'березня': '03', 'квітня': '04',
  'травня': '05', 'червня': '06', 'липня': '07', 'серпня': '08',
  'вересня': '09', 'жовтня': '10', 'листопада': '11', 'грудня': '12',
  // Russian fallback
  'января': '01', 'февраля': '02', 'марта': '03', 'апреля': '04',
  'мая': '05', 'июня': '06', 'июля': '07', 'августа': '08',
  'сентября': '09', 'октября': '10', 'ноября': '11', 'декабря': '12',
};

// Month ABBREVIATIONS as they appear on real documents (stamps, handwritten
// dates, table headers). Keys are stored WITHOUT a trailing dot and lowercased;
// the lookup strips any trailing '.' first. Matched EXACTLY against a whole
// token — never as a substring — so "мар" cannot be triggered by "марта" and
// "ма" cannot over-match. Full-word forms live in UA_MONTHS above; only true
// abbreviations belong here. Conservative by design: a form is included only
// when it is unambiguous. (e.g. bare "май"/"мая" = May is in UA_MONTHS already.)
const MONTH_ABBREV: Record<string, string> = {
  // Ukrainian
  'січ': '01', 'лют': '02', 'бер': '03', 'кв': '04', 'трав': '05',
  'черв': '06', 'лип': '07', 'липн': '07', 'серп': '08', 'вер': '09',
  'жовт': '10', 'листоп': '11', 'лист': '11', 'груд': '12',
  // Russian
  'ян': '01', 'янв': '01', 'февр': '02', 'фев': '02', 'мар': '03',
  'апр': '04', 'июн': '06', 'июл': '07', 'авг': '08', 'сент': '09',
  'сен': '09', 'окт': '10', 'нояб': '11', 'дек': '12',
};

// 3-letter Latin month codes (passport/visa bilingual lines).
const LATIN_MONTH: Record<string, string> = {
  'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04', 'may': '05', 'jun': '06',
  'jul': '07', 'aug': '08', 'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12',
};

// Cyrillic 3-letter passport month abbreviations (no dot), UA & RU. Only the
// confident, standard passport codes — used to cross-check against the Latin
// code in a bilingual date. Both scripts must AGREE or the date goes to review.
const CYR_PASSPORT_MONTH: Record<string, string> = {
  // Ukrainian passport codes
  'січ': '01', 'лют': '02', 'бер': '03', 'кві': '04', 'тра': '05', 'чер': '06',
  'лип': '07', 'сер': '08', 'вер': '09', 'жов': '10', 'лис': '11', 'гру': '12',
  // Russian passport codes
  'янв': '01', 'фев': '02', 'мар': '03', 'апр': '04', 'май': '05', 'июн': '06',
  'июл': '07', 'авг': '08', 'сен': '09', 'окт': '10', 'ноя': '11', 'дек': '12',
};

/** Resolve a single month token (full word OR abbreviation) to "MM" or null. */
function resolveMonthToken(token: string): string | null {
  const t = token.replace(/\.$/, ''); // strip a single trailing dot
  return UA_MONTHS[t] ?? MONTH_ABBREV[t] ?? null;
}

/** 2-digit year → 4-digit. <30 → 20xx, else 19xx (passport/old-document pivot). */
function expandTwoDigitYear(yy: string): string {
  const n = parseInt(yy, 10);
  return n < 30 ? `20${yy}` : `19${yy}`;
}

export function convertDateToUSCIS(input: string): string | null {
  // Format: DD.MM.YYYY
  const dotMatch = input.match(/^(\d{1,2})\.(\d{2})\.(\d{4})$/);
  if (dotMatch) return `${dotMatch[2]}/${dotMatch[1].padStart(2, '0')}/${dotMatch[3]}`;

  // Bilingual passport format: "25 ЧЕР/JUN 86" — day, Cyrillic abbrev, '/',
  // Latin 3-letter code, 2- or 4-digit year. The two month tokens must AGREE.
  const bi = input.trim().match(
    /^(\d{1,2})\s+([Ѐ-ӿ]{2,4})\s*\/\s*([A-Za-z]{3})\s+(\d{2}|\d{4})$/
  );
  if (bi) {
    const day = bi[1].padStart(2, '0');
    const cyr = CYR_PASSPORT_MONTH[bi[2].toLowerCase()];
    const lat = LATIN_MONTH[bi[3].toLowerCase()];
    if (!cyr || !lat || cyr !== lat) return null; // unknown or disagreeing → review
    const year = bi[4].length === 2 ? expandTwoDigitYear(bi[4]) : bi[4];
    return `${cyr}/${day}/${year}`;
  }

  // Format: "01 січня 1990 року" / "01 января 1990 года" / "01 січ. 1990"
  const parts = input.toLowerCase().replace(/\s+(року|года|р\.?|г\.?)\s*$/i, '').trim().split(/\s+/);
  if (parts.length >= 3) {
    const day = parts[0].padStart(2, '0');
    const month = resolveMonthToken(parts[1]);
    const year = parts[2];
    if (month && /^\d{4}$/.test(year)) return `${month}/${day}/${year}`;
  }
  return null;
}

export type OutputMode = 'legal_formal' | 'uscis_normalized' | 'plain';
