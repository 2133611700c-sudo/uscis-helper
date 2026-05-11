/**
 * Passport-booklet extraction module — Ukrainian internal passport (паспорт-книжка).
 *
 * Input:  OcrResult from /api/tps/ocr/extract
 * Output: TpsModuleResult with TpsExtractedField[] for the few fields the
 *         I-821 needs that we can read from the internal-passport booklet:
 *
 *           family_name        ← Прізвище / Фамилия
 *           given_name         ← Ім'я / Имя
 *           middle_name        ← По батькові / Отчество
 *           dob                ← Дата народження
 *           passport_number    ← Series+Number, e.g. "ЕА 991991"
 *           country_of_nationality ← always 'Ukraine'
 *           passport_country_of_issuance ← always 'Ukraine'
 *
 * Why this module exists:
 *   The TPS USCIS Form I-821 Instructions allow ANY national ID with photo,
 *   including the internal Ukrainian passport-booklet. Many real Ukrainian
 *   users never had a foreign-travel passport (загранпаспорт with TD3 MRZ);
 *   they only have the internal booklet. Without this module the OCR path
 *   would fail for them and force manual entry.
 *
 * Strategy:
 *   Label-based extraction. The booklet has Cyrillic labels printed next to
 *   handwritten field values. We:
 *     1. Find the page-1 dotted series-number header (e.g. "ЕА 991991") via
 *        regex over OcrLine text.
 *     2. For each critical field, find a line containing the label string
 *        (Cyrillic, fuzzy), then take the nearest non-empty adjacent line.
 *     3. Mark EVERY extracted field as review_required=true — handwritten
 *        Cyrillic OCR is unreliable; user MUST verify.
 *     4. passport_expiration_date is NEVER returned — internal booklets have
 *        no expiration. Caller (GeneratePacketBlock) must surface this to
 *        the user as a manual field.
 *
 * Privacy: place of birth, marital status, etc. are NOT extracted — they
 * are not USCIS form fields and we deliberately do not propagate them.
 */

import type { OcrResult, OcrLine } from '@/lib/ocr/types'
import type {
  TpsExtractedField,
  TpsModuleResult,
  TpsDocType,
} from '@/lib/tps/types'

const BOOKLET_MODULE: TpsDocType = 'passport'

// Series+number lives on every page top: two Cyrillic letters + 6 digits,
// printed as perforation. e.g. "ЕА 991991", "КН 123456". OCR reads it as
// the dotted version most of the time. We accept Vision's variants:
//   - "ЕА 991991"
//   - "ЕА991991" (no space)
//   - "ЕА 991 991" or "ЕА 99 19 91" (spaced digit groups)
//   - "EA 991991" (Latin look-alikes mistaken for Cyrillic)
// We allow Latin A/B/C/E/H/I/K/M/O/P/T/X for letters because Cyrillic
// letters that look identical to those Latin chars confuse Vision.
const SERIES_NUMBER_RE =
  /\b([А-ЯІЇЄҐABCEHIKMOPTX]{2})\s*((?:[0-9]\s*){6})\b/u

// Date of birth — many formats. We try several:
//   "25 червня 1986 року"  (UA written-out month)
//   "25 июня 1986 года"     (RU written-out month)
//   "25.06.1986" / "25/06/1986"
//   "25-06-1986"
const UA_MONTHS: Record<string, number> = {
  січня: 1, лютого: 2, березня: 3, квітня: 4, травня: 5, червня: 6,
  липня: 7, серпня: 8, вересня: 9, жовтня: 10, листопада: 11, грудня: 12,
}
const RU_MONTHS: Record<string, number> = {
  января: 1, февраля: 2, марта: 3, апреля: 4, мая: 5, июня: 6,
  июля: 7, августа: 8, сентября: 9, октября: 10, ноября: 11, декабря: 12,
}

interface LineCandidate {
  line: OcrLine
  text: string
  idx: number
}

/**
 * Index every line of an OcrResult into a flat array — easier to scan
 * for adjacent label/value pairs.
 */
function indexLines(ocr: OcrResult): LineCandidate[] {
  return ocr.lines.map((line, idx) => ({
    line,
    text: (line.text ?? '').trim(),
    idx,
  }))
}

/**
 * Case-insensitive substring match in a line, tolerant to Latin/Cyrillic
 * confusables (e.g. Latin 'I' vs Cyrillic 'І').
 *
 * Vision reads "Ім'я" as "IM'A" (the M is also Latin) in many booklet
 * scans, so we must reverse-map ALL Latin look-alikes — not just I/E/A —
 * before comparing to a Cyrillic label.
 */
function lineMatchesLabel(text: string, label: string): boolean {
  if (!text || !label) return false
  // Latin → Cyrillic look-alike substitutions covering every char that
  // ever appears in a Ukrainian booklet label.
  const SUBS: ReadonlyArray<[RegExp, string]> = [
    [/A/g, 'А'], [/B/g, 'В'], [/C/g, 'С'], [/E/g, 'Е'], [/H/g, 'Н'],
    [/I/g, 'І'], [/K/g, 'К'], [/M/g, 'М'], [/O/g, 'О'], [/P/g, 'Р'],
    [/T/g, 'Т'], [/X/g, 'Х'], [/Y/g, 'У'],
  ]
  const norm = (s: string) => {
    let t = s.toUpperCase().replace(/['ʼ`’]/g, '')
    for (const [re, repl] of SUBS) t = t.replace(re, repl)
    // Drop everything that isn't a Cyrillic letter — strips slashes,
    // English label residue ("Surname"), whitespace, etc.
    return t.replace(/[^А-ЯІЇЄҐ]/gu, '')
  }
  const t = norm(text)
  const l = norm(label)
  return l.length > 0 && t.includes(l)
}

/**
 * Strip bilingual-layer noise from an extracted booklet value.
 *
 * The Ukrainian booklet is bilingual: labels are printed as
 *   "Прізвище / Surname"
 *   "Ім'я / Given Names"
 *   "Дата народження / Date of birth"
 * Vision often reads the slash + English label as part of the line, so
 * what we want as "Шевченко" arrives as "/ Surname Шевченко" or
 * "Шевченко / Surname". We strip:
 *   - leading separators ":-—_/"
 *   - a leading or trailing English-word run (Latin letters)
 *   - duplicate inner whitespace
 */
function stripBilingualNoise(s: string): string {
  let t = s.trim()
  // Strip leading separator(s)
  t = t.replace(/^[:\-—_\/\s.]+/, '')
  // Strip a leading English-label run: "Surname Шевченко" → "Шевченко"
  t = t.replace(/^[A-Za-z][A-Za-z .'\-]{0,40}(?=\s+[А-ЯІЇЄҐа-яіїєґ])/u, '')
  // Strip a trailing English-label run: "Шевченко / Surname" → "Шевченко"
  t = t.replace(/\s*[\/\-—]\s*[A-Za-z][A-Za-z .'\-]{0,40}$/u, '')
  // Strip any trailing Latin-only word salad after the Cyrillic value
  t = t.replace(/([А-ЯІЇЄҐа-яіїєґ][А-ЯІЇЄҐа-яіїєґ\-' ]+?)\s+[A-Za-z][A-Za-z .'\-]{0,40}$/u, '$1')
  return t.replace(/\s+/g, ' ').trim()
}

/**
 * Latin → Cyrillic look-alike reverse map for Ukrainian/Russian context.
 *
 * Real-world failure mode: Google Vision often reads handwritten Cyrillic
 * letters that visually match Latin glyphs as Latin. So "ТАРАС" (Cyrillic)
 * arrives as "TAPAC" (Latin). For an all-look-alike string we would
 * previously discard it as "junk" — losing the real name. With this map
 * we recognize the substitution and rebuild the Cyrillic so KMU-55
 * transliteration produces the correct USCIS-spelling ("Taras", not
 * "Tarac" or worse).
 *
 * Only characters that have BOTH a Cyrillic glyph and a visually
 * identical Latin glyph are in this map. Latin B/D/F/G/J/L/N/Q/R/S/U/V/W/Z
 * are deliberately NOT included — they're not common look-alike
 * substitutions and including them would cause false positives on
 * actual English values.
 */
const LATIN_TO_CYRILLIC_LOOKALIKE: Record<string, string> = {
  'A': 'А', 'B': 'В', 'C': 'С', 'E': 'Е', 'H': 'Н',
  'I': 'І', 'K': 'К', 'M': 'М', 'O': 'О', 'P': 'Р',
  'T': 'Т', 'X': 'Х', 'Y': 'У',
  'a': 'а', 'c': 'с', 'e': 'е', 'i': 'і', 'o': 'о',
  'p': 'р', 'x': 'х', 'y': 'у',
}

/**
 * True when every character is either:
 *   - whitespace / dash / apostrophe (separators)
 *   - a Latin character that has a Cyrillic look-alike
 * i.e. the string CAN be the Cyrillic value that Vision misread.
 */
function isAllLookalikeLatin(s: string): boolean {
  if (!s) return false
  let sawLetter = false
  for (const ch of s) {
    if (/\s|[-'’ʼ`]/u.test(ch)) continue
    if (!(ch in LATIN_TO_CYRILLIC_LOOKALIKE)) return false
    sawLetter = true
  }
  return sawLetter
}

/**
 * Reverse-map Latin look-alike chars back to their Cyrillic equivalents.
 * Non-look-alike Latin chars are preserved (so "Smith" → "Smith"),
 * but in practice this is only called when isAllLookalikeLatin returned
 * true.
 */
function unlookalike(s: string): string {
  let out = ''
  for (const ch of s) {
    out += LATIN_TO_CYRILLIC_LOOKALIKE[ch] ?? ch
  }
  return out
}

/**
 * Did the cleaned value end up looking like junk? (e.g. only a separator
 * or only Latin label words). Used to know whether to fall back to the
 * NEXT line instead of returning a useless "value".
 *
 * Special case: if the value is all Latin LOOK-ALIKES (chars that have
 * Cyrillic counterparts) AND ≥2 letters, it's likely real Cyrillic that
 * Vision misread — treat as NOT junk. The caller is expected to reverse-
 * map before transliterating.
 */
function isValueJunk(s: string): boolean {
  if (!s || s.length < 2) return true
  const hasCyrillic = /[А-ЯІЇЄҐа-яіїєґ]/u.test(s)
  const hasDigit = /\d/.test(s)
  if (hasCyrillic || hasDigit) return false
  // All-Latin: still acceptable if it's all-look-alike (Cyrillic misread).
  if (isAllLookalikeLatin(s)) return false
  return true
}

/**
 * Find the value associated with a label. Strategy: look at the same line
 * (label may be followed by value), then look at the NEXT non-empty line.
 * Returns null if no plausible value found.
 */
function findValueNear(
  lines: LineCandidate[],
  labelIdx: number,
  label: string,
): { value: string; sourceLine: OcrLine } | null {
  const labelLine = lines[labelIdx]
  if (!labelLine) return null

  // 1) Same-line continuation: text after the label match.
  const text = labelLine.text
  const labelStartCi = text.toLowerCase().indexOf(label.toLowerCase())
  if (labelStartCi >= 0) {
    const tail = text.slice(labelStartCi + label.length).trim()
    if (tail.length >= 2 && !/^[:\-—_\.]+$/.test(tail)) {
      const cleaned = stripBilingualNoise(tail)
      if (!isValueJunk(cleaned)) {
        return { value: cleaned, sourceLine: labelLine.line }
      }
    }
  }

  // 2) Look at the NEXT line (booklet layout: label printed on left, value
  //    handwritten on the line below or to the right).
  for (let off = 1; off <= 3; off++) {
    const next = lines[labelIdx + off]
    if (!next || next.text.length < 2) continue
    if (looksLikeLabel(next.text)) continue
    const cleaned = stripBilingualNoise(next.text)
    if (!isValueJunk(cleaned)) {
      return { value: cleaned, sourceLine: next.line }
    }
  }

  // 3) Fallback: previous line (rare layout where value sits above label).
  for (let off = 1; off <= 2; off++) {
    const prev = lines[labelIdx - off]
    if (!prev || prev.text.length < 2) continue
    if (looksLikeLabel(prev.text)) continue
    const cleaned = stripBilingualNoise(prev.text)
    if (!isValueJunk(cleaned)) {
      return { value: cleaned, sourceLine: prev.line }
    }
  }
  return null
}

/**
 * Cheap heuristic: this line is probably a printed label, not a value.
 * Used to skip past consecutive label lines when searching for a value.
 */
function looksLikeLabel(text: string): boolean {
  const compact = text.replace(/\s+/g, '').toLowerCase()
  const labelHints = [
    'прізвище', 'призвище', 'фамилия',
    'ім\'я', 'імя', 'имя',
    'побатькові', 'отчество',
    'датанародження', 'датарождения',
    'місценародження', 'местарождения', 'местарожд',
    'паспортгромадянинаукраїни',
    'паспортгражданинаукраины',
    'підписвласникапаспорта',
  ]
  return labelHints.some((h) => compact.includes(h))
}

/**
 * Title-case a Cyrillic name. "ИВАН" → "Иван", "ИВАН ПЕТРОВИЧ" → "Иван Петрович".
 *
 * Also handles the all-Latin-look-alike case: when Vision misread the
 * Cyrillic name as Latin homoglyphs (e.g. "TAPAC" instead of "ТАРАС"),
 * we reverse-map back to Cyrillic before title-casing. This is the
 * crucial fix that lets booklet given_name extraction work in practice.
 */
function titleCaseCyrillic(s: string): string {
  const restored = isAllLookalikeLatin(s) ? unlookalike(s) : s
  return restored
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ')
    .trim()
}

/**
 * Parse a Ukrainian/Russian date into ISO YYYY-MM-DD, or null on failure.
 */
function parseUaDate(s: string): string | null {
  const text = s.trim().toLowerCase()
  // Written-out: "25 червня 1986" or "25 июня 1986"
  const m1 = text.match(/(\d{1,2})\s+([а-яії]+)\s+(\d{4})/u)
  if (m1) {
    const day = parseInt(m1[1], 10)
    const monthWord = m1[2]
    const year = parseInt(m1[3], 10)
    const month = UA_MONTHS[monthWord] ?? RU_MONTHS[monthWord] ?? null
    if (month && day >= 1 && day <= 31 && year >= 1900 && year <= 2100) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    }
  }
  // Numeric: "25.06.1986" / "25/06/1986" / "25-06-1986"
  const m2 = text.match(/(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2,4})/)
  if (m2) {
    const day = parseInt(m2[1], 10)
    const month = parseInt(m2[2], 10)
    let year = parseInt(m2[3], 10)
    if (year < 100) year = year > 30 ? 1900 + year : 2000 + year
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 1900 && year <= 2100) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    }
  }
  return null
}

/**
 * Try to detect a Ukrainian internal passport-booklet from an OcrResult.
 * Returns matched=false (with a debug match_reason) if signals are absent.
 */
export function runPassportBookletModule(
  ocr: OcrResult,
  opts: { document_id: string },
): TpsModuleResult {
  const lines = indexLines(ocr)
  const rawText = (ocr.raw_text || '').toLowerCase()

  // ── Match signals: the booklet's distinguishing text features.
  //    We require at least one strong + at least one weak signal.
  const strongSignals = [
    'паспорт громадянина україни',
    'паспорт гражданина украины',
  ]
  const weakSignals = [
    'прізвище', 'призвище', 'фамилия',
    'ім\'я', 'імя', 'имя',
    'дата народження', 'дата рождения',
    'підпис власника', 'подпись владельца',
  ]
  const hasStrong = strongSignals.some((s) => rawText.includes(s))
  const hasWeak = weakSignals.some((s) => rawText.includes(s))

  if (!hasStrong && !hasWeak) {
    return {
      module: BOOKLET_MODULE,
      matched: false,
      match_reason: 'booklet_signals_missing',
      fields: [],
      warnings: [],
      manual_review_required: false,
      manual_review_reasons: [],
    }
  }
  const matchReason = hasStrong
    ? 'booklet_strong_signal_matched'
    : 'booklet_weak_signal_matched'

  // ── Series + number — search the whole text once.
  let passportNumber: string | null = null
  let passportNumberLine: OcrLine | null = null
  for (const lc of lines) {
    const m = lc.text.match(SERIES_NUMBER_RE)
    if (m) {
      passportNumber = `${m[1]} ${m[2]}`.toUpperCase()
      passportNumberLine = lc.line
      break
    }
  }

  // ── Find each labelled field. We try multiple label variants.
  const findField = (labels: string[]): { value: string; sourceLine: OcrLine } | null => {
    for (const label of labels) {
      for (const lc of lines) {
        if (lineMatchesLabel(lc.text, label)) {
          const v = findValueNear(lines, lc.idx, label)
          if (v) return v
        }
      }
    }
    return null
  }

  const surname = findField(['Прізвище', 'Призвище', 'Фамилия'])
  // The given-name label is "Ім'я" in Ukrainian; the apostrophe Vision
  // returns varies (', ʼ, ’, `) — try all forms plus the curly variants
  // plus the plain Russian "Имя".
  const givenName = findField([
    "Ім'я", 'Імʼя', 'Ім’я', 'Ім`я', 'Ім я', 'Імя', 'Имя',
  ])
  const middleName = findField(['По батькові', 'Побатькові', 'Отчество'])
  const dobRaw = findField(['Дата народження', 'Дата рождения', 'Датарождения'])

  // ── Emit fields. Every booklet field is review_required=true because
  // handwritten Cyrillic OCR is unreliable.
  const fields: TpsExtractedField[] = []
  const warnings: string[] = []

  const emit = (
    field: string,
    raw: string,
    normalized: string | null,
    sourceLine: OcrLine | null,
    sourceZone: string,
    passes: string[] = [],
    failures: string[] = [],
  ) => {
    fields.push({
      field,
      raw_value: raw,
      normalized_value: normalized,
      extraction_source: 'ocr_keyword',
      source_document_id: opts.document_id,
      source_zone: sourceZone,
      bbox: sourceLine?.bbox ?? null,
      language_layer: 'cyrillic',
      confidence: sourceLine?.confidence ?? null,
      review_required: true,
      ocr_word_ids: [],
      passes,
      failures,
      user_corrected: false,
    })
  }

  if (surname) {
    emit(
      'family_name',
      surname.value,
      titleCaseCyrillic(surname.value),
      surname.sourceLine,
      'booklet_label_surname',
    )
  } else {
    warnings.push('booklet_surname_missing')
  }

  if (givenName) {
    emit(
      'given_name',
      givenName.value,
      titleCaseCyrillic(givenName.value),
      givenName.sourceLine,
      'booklet_label_given_name',
    )
  } else {
    warnings.push('booklet_given_name_missing')
  }

  if (middleName) {
    emit(
      'middle_name',
      middleName.value,
      titleCaseCyrillic(middleName.value),
      middleName.sourceLine,
      'booklet_label_patronymic',
    )
  }

  if (dobRaw) {
    const iso = parseUaDate(dobRaw.value)
    emit(
      'dob',
      dobRaw.value,
      iso,
      dobRaw.sourceLine,
      'booklet_label_dob',
      iso ? ['date_parsed'] : [],
      iso ? [] : ['date_parse_failed'],
    )
    if (!iso) warnings.push('booklet_dob_unparseable')
  } else {
    warnings.push('booklet_dob_missing')
  }

  if (passportNumber) {
    emit(
      'passport_number',
      passportNumber,
      passportNumber,
      passportNumberLine,
      'booklet_perforation_series_number',
      ['series_number_format'],
    )
  } else {
    warnings.push('booklet_passport_number_missing')
  }

  // Nationality + issuing country are always Ukraine for this document.
  emit(
    'country_of_nationality',
    'Ukraine',
    'Ukraine',
    null,
    'booklet_inferred_nationality',
    ['inferred_from_document_type'],
  )
  emit(
    'passport_country_of_issuance',
    'Ukraine',
    'Ukraine',
    null,
    'booklet_inferred_issuing_country',
    ['inferred_from_document_type'],
  )

  // Internal Ukrainian passport-booklets do not expire. We DO NOT emit
  // passport_expiration_date — GeneratePacketBlock will treat it as empty
  // and the user must fill it manually (or use a placeholder per
  // USCIS guidance for non-expiring national documents).
  warnings.push('booklet_no_expiration_date')

  const matched = fields.length > 0
  return {
    module: BOOKLET_MODULE,
    matched,
    match_reason: matched ? matchReason : 'booklet_no_fields_extracted',
    fields,
    warnings,
    manual_review_required: true, // ALWAYS — handwritten Cyrillic = always verify
    manual_review_reasons: ['handwritten_cyrillic_low_confidence'],
  }
}
