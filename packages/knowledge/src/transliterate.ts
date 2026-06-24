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

// Characters to skip (soft sign, hard sign, FULL apostrophe family). Real Ukrainian
// documents use many apostrophe glyphs — all must be dropped, else they LEAK into the
// Latin name ("Мар’яна" → "Mar’iana" instead of "Mariana"). U+2019 (typographic, the most
// common in real text) and U+2018 were missing before 2026-06-22. KMU-55: apostrophe not reproduced.
const SKIP = new Set([
  "Ь", "ь", "Ъ", "ъ",
  "\u0027", // straight apostrophe
  "\u2019", // right single quote (typographic — most common)
  "\u2018", // left single quote
  "\u02BC", // modifier letter apostrophe
  "\u02BB", // modifier letter turned comma
  "\u0060", // grave accent
  "\u00B4", // acute accent
  "\u02B9", // modifier letter prime
]);

// Ukrainian Cyrillic character check
const UA_CYRILLIC = /[\u0400-\u04FF\u0490\u0491]/;

// Russian-only letters with NO Ukrainian KMU-55 mapping \u2192 romanize so KMU-55 output
// can NEVER leak raw Cyrillic. See the defense-in-depth note in transliterateKMU55.
// BGN/PCGN Russian convention (\u042D\u2192E, \u042B\u2192Y, \u0401\u2192Ye). Re-added after an integration regression.
const KMU_RU_FALLBACK: Record<string, string> = {
  "\u0401": "Ye", "\u0451": "ye", "\u042D": "E", "\u044D": "e", "\u042B": "Y", "\u044B": "y",
};

/**
 * EXTENDED-CYRILLIC CATCH-ALL \u2014 best-effort romanization for every U+0400\u2013U+04FF letter the
 * modern KMU-55/Russian tables don't cover (Serbian \u0402/\u0409/\u040A, Belarusian \u040E, archaic/OCS \u0462/\u0472/\u0474,
 * extended-minority \u0492/\u049A/\u04BA/\u04D8/\u04E8\u2026). Used by sanitizeCyrillicLeak so romanized output can NEVER
 * contain raw Cyrillic. Values follow common scholarly/UN transliteration (ASCII-folded for
 * USCIS Latin fields). None of these affect modern UA/RU document romanization.
 */
const EXTENDED_CYRILLIC: Record<string, string> = {
  '\u0404': 'Ye', '\u0454': 'ie', '\u0406': 'I', '\u0456': 'i', '\u0407': 'Yi', '\u0457': 'i', '\u0490': 'G', '\u0491': 'g',
  '\u0402': 'Dj', '\u0452': 'dj', '\u0403': 'G', '\u0453': 'g', '\u0405': 'Dz', '\u0455': 'dz',
  '\u0408': 'J', '\u0458': 'j', '\u0409': 'Lj', '\u0459': 'lj', '\u040A': 'Nj', '\u045A': 'nj',
  '\u040B': 'C', '\u045B': 'c', '\u040C': 'K', '\u045C': 'k', '\u040F': 'Dz', '\u045F': 'dz',
  '\u0400': 'E', '\u0450': 'e', '\u040D': 'I', '\u045D': 'i',
  '\u040E': 'U', '\u045E': 'u',
  '\u0460': 'O', '\u0461': 'o', '\u0462': 'Ie', '\u0463': 'ie', '\u0464': 'Ie', '\u0465': 'ie',
  '\u0466': 'E', '\u0467': 'e', '\u0468': 'Ie', '\u0469': 'ie', '\u046A': 'U', '\u046B': 'u',
  '\u046C': 'Iu', '\u046D': 'iu', '\u046E': 'Ks', '\u046F': 'ks', '\u0470': 'Ps', '\u0471': 'ps',
  '\u0472': 'F', '\u0473': 'f', '\u0474': 'Y', '\u0475': 'y', '\u0476': 'Y', '\u0477': 'y',
  '\u0478': 'U', '\u0479': 'u', '\u047A': 'O', '\u047B': 'o', '\u047C': 'O', '\u047D': 'o',
  '\u047E': 'Ot', '\u047F': 'ot', '\u0480': 'C', '\u0481': 'c',
  '\u048A': 'I', '\u048B': 'i', '\u048C': 'E', '\u048D': 'e', '\u048E': 'R', '\u048F': 'r',
  '\u0492': 'Gh', '\u0493': 'gh', '\u0494': 'G', '\u0495': 'g', '\u0496': 'Zh', '\u0497': 'zh',
  '\u0498': 'Z', '\u0499': 'z', '\u049A': 'Q', '\u049B': 'q', '\u049C': 'K', '\u049D': 'k',
  '\u049E': 'Q', '\u049F': 'q', '\u04A0': 'K', '\u04A1': 'k', '\u04A2': 'Ng', '\u04A3': 'ng',
  '\u04A4': 'Ng', '\u04A5': 'ng', '\u04A6': 'P', '\u04A7': 'p', '\u04A8': 'O', '\u04A9': 'o',
  '\u04AA': 'S', '\u04AB': 's', '\u04AC': 'T', '\u04AD': 't', '\u04AE': 'U', '\u04AF': 'u',
  '\u04B0': 'U', '\u04B1': 'u', '\u04B2': 'H', '\u04B3': 'h', '\u04B4': 'Ts', '\u04B5': 'ts',
  '\u04B6': 'Ch', '\u04B7': 'ch', '\u04B8': 'Ch', '\u04B9': 'ch', '\u04BA': 'H', '\u04BB': 'h',
  '\u04BC': 'Ch', '\u04BD': 'ch', '\u04BE': 'Ch', '\u04BF': 'ch',
  '\u04C0': 'I',
  '\u04C1': 'Zh', '\u04C2': 'zh', '\u04C3': 'Q', '\u04C4': 'q', '\u04C5': 'L', '\u04C6': 'l',
  '\u04C7': 'Ng', '\u04C8': 'ng', '\u04C9': 'N', '\u04CA': 'n', '\u04CB': 'Ch', '\u04CC': 'ch',
  '\u04CD': 'M', '\u04CE': 'm', '\u04CF': 'i',
  '\u04D0': 'A', '\u04D1': 'a', '\u04D2': 'A', '\u04D3': 'a', '\u04D4': 'Ae', '\u04D5': 'ae',
  '\u04D6': 'E', '\u04D7': 'e', '\u04D8': 'A', '\u04D9': 'a', '\u04DA': 'A', '\u04DB': 'a',
  '\u04DC': 'Zh', '\u04DD': 'zh', '\u04DE': 'Z', '\u04DF': 'z', '\u04E0': 'Dz', '\u04E1': 'dz',
  '\u04E2': 'I', '\u04E3': 'i', '\u04E4': 'I', '\u04E5': 'i', '\u04E6': 'O', '\u04E7': 'o',
  '\u04E8': 'O', '\u04E9': 'o', '\u04EA': 'O', '\u04EB': 'o', '\u04EC': 'E', '\u04ED': 'e',
  '\u04EE': 'U', '\u04EF': 'u', '\u04F0': 'U', '\u04F1': 'u', '\u04F2': 'U', '\u04F3': 'u',
  '\u04F4': 'Ch', '\u04F5': 'ch', '\u04F6': 'G', '\u04F7': 'g', '\u04F8': 'Y', '\u04F9': 'y',
  '\u04FA': 'Gh', '\u04FB': 'gh', '\u04FC': 'H', '\u04FD': 'h', '\u04FE': 'H', '\u04FF': 'h',
};

const ANY_CYRILLIC = /[\u0400-\u04FF]/;

/**
 * FINAL no-Cyrillic-leak guard. Apply to romanized output to GUARANTEE zero raw Cyrillic
 * (U+0400\u2013U+04FF). Mapped extended/archaic letters \u2192 best-effort Latin; anything unmappable
 * (combining marks U+0483\u2013U+0489, numero U+0482, exotic) \u2192 stripped. No-op (returns input
 * unchanged) when the string has no Cyrillic, so it never alters normal KMU-55/Russian output.
 */
export function sanitizeCyrillicLeak(s: string): string {
  if (!s || !ANY_CYRILLIC.test(s)) return s;
  let out = '';
  for (const ch of s) {
    if (!ANY_CYRILLIC.test(ch)) { out += ch; continue; }
    out += EXTENDED_CYRILLIC[ch] ?? ''; // map, else strip \u2014 NEVER leak
  }
  return out;
}

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
 * DOC-LEVEL script detector (additive, pure). A single name line like «Сергей»
 * carries NO distinctive letter (no ы/э/ё/ъ, no і/ї/є/ґ) so detectNameScript ⇒
 * 'unknown' and the per-name romanization can only fall to the KMU-55 default —
 * yet the DOCUMENT as a whole is often unambiguously Russian from OTHER fields
 * (a Russian patronymic, a Russian month word, a Russian place form). This
 * aggregates those signals across ALL of a document's Cyrillic field values and
 * decides 'ru' / 'uk' / 'unknown' for the WHOLE document, so a caller can route
 * an otherwise-ambiguous NAME on a clearly-Russian doc through the Russian table
 * (Сергей→Sergey, Сергеевич→Sergeyevich) instead of KMU-55 (Serhei/Serheevych).
 *
 * CONSERVATIVE by design (review > wrong-Russify): we return 'ru' / 'uk' ONLY on
 * a clear aggregate signal; any conflict (both languages signalled) or no signal
 * ⇒ 'unknown', and the caller keeps its safe default. This NEVER overrides a
 * per-name distinctive letter — a name with і/ї/є/ґ still routes UA at the call
 * site even on a 'ru' document (we never force-Russify a clearly-Ukrainian name).
 */

// NOTE on word boundaries: JS \b is ASCII-only and does NOT fire between two
// Cyrillic letters, so we use an explicit "end-of-token" lookahead — end of
// string OR a non-Cyrillic char (space, punctuation). EOT must be a SUFFIX match
// for endings (patronymic) and a WHOLE-token match for words (months/places).
const EOT = '(?![\\u0400-\\u04FF\\u0490\\u0491])' // not followed by a Cyrillic letter
const BOT = '(?<![\\u0400-\\u04FF\\u0490\\u0491])' // not preceded by a Cyrillic letter

/** Distinctive RUSSIAN-only patronymic endings (Ukrainian uses -ійович/-ївна/-івна). */
const RU_PATRONYMIC = new RegExp(`(?:еевич|еевна|ьевич|ьевна|[оа]евич|[оа]евна)${EOT}`, 'iu')
/** Distinctive UKRAINIAN-only patronymic endings. */
const UA_PATRONYMIC = new RegExp(`(?:[іи]йович|ійович|ївна|івна)${EOT}`, 'iu')
/** Russian-only month words (genitive, as written on dates). */
const RU_MONTHS_RE = new RegExp(`${BOT}(?:января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)${EOT}`, 'iu')
/** Ukrainian-only month words. */
const UA_MONTHS_RE = new RegExp(`${BOT}(?:січня|лютого|березня|квітня|травня|червня|липня|серпня|вересня|жовтня|листопада|грудня)${EOT}`, 'iu')
/** Russian-only place/administrative word forms (района not району, года not року). */
const RU_PLACE_RE = new RegExp(`${BOT}(?:района|области|года|город|посёлок|поселок|деревня)${EOT}`, 'iu')
/** Ukrainian-only place/administrative word forms. */
const UA_PLACE_RE = new RegExp(`${BOT}(?:району|області|року|місто|селище)${EOT}`, 'iu')

/**
 * Aggregate doc-level script over a document's Cyrillic field values.
 * Returns 'ru' only on a clear Russian aggregate signal with NO Ukrainian signal;
 * 'uk' on the symmetric Ukrainian case; 'unknown' on conflict or no signal.
 */
export function detectDocumentScript(fields: Array<string | null | undefined>): 'ru' | 'uk' | 'unknown' {
  let ru = 0
  let ua = 0
  for (const raw of fields) {
    const s = (raw ?? '').trim()
    if (!s) continue
    // Highest-confidence signal: a distinctive single-letter that exists in only
    // one alphabet. One such letter ANYWHERE pins that field's language.
    if (RU_ONLY.test(s)) ru++
    if (UA_ONLY.test(s)) ua++
    // Morphology signals (patronymic / month / place word forms).
    if (RU_PATRONYMIC.test(s)) ru++
    if (UA_PATRONYMIC.test(s)) ua++
    if (RU_MONTHS_RE.test(s)) ru++
    if (UA_MONTHS_RE.test(s)) ua++
    if (RU_PLACE_RE.test(s)) ru++
    if (UA_PLACE_RE.test(s)) ua++
  }
  // Conservative: require a clear, one-sided signal. A document that signals BOTH
  // (legitimately bilingual Soviet cert) stays 'unknown' → caller keeps its safe
  // default and reviews rather than guessing a wrong romanization.
  if (ru > 0 && ua === 0) return 'ru'
  if (ua > 0 && ru === 0) return 'uk'
  return 'unknown'
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
