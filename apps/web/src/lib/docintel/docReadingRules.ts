/**
 * docReadingRules — per-document-class READING INSTRUCTIONS that TEACH the Gemini
 * reader how to read each document the way a careful human (or a frontier VLM) reads it.
 *
 * WHY this exists: the generic prompt (buildPrompt) tells the model WHAT fields to read,
 * but not HOW each document writes them. Real-doc analysis (2026-06-22, owner documents,
 * read directly by Claude) found concrete, repeatable failure modes the generic prompt
 * does not address — e.g. a Soviet birth certificate writes the date of birth as a
 * SPELLED-OUT CURSIVE WORD ("двадцать пятого июня"), and the model misreads the cursive
 * month as the adjacent one (июня→июля). A per-class instruction block fixes that class
 * of error. These rules are STRICTLY ADDITIONAL guidance — they never tell the model to
 * guess or to invent; they tell it what to expect and what NOT to confuse.
 *
 * Gated by DOC_READING_RULES_ENABLED (default OFF) so prod prompt is unchanged until the
 * lift is measured on the real-doc harness.
 *
 * Provenance: every rule is grounded in a real document the owner provided, cited in the
 * master plan (docs/architecture/RECOGNITION_MASTER_PLAN_2026-06-22.md, PART 5).
 */

export interface DocReadingRules {
  /** One-line language/script expectation for the class. */
  language: string
  /** How dates are physically written on this class (the #1 failure surface). */
  dateGuidance?: string
  /** Class-level reading rules (each becomes a prompt bullet). */
  rules: string[]
}

/**
 * Cyrillic month words → number, with the ADJACENT-month confusion pairs the model gets
 * wrong. Read the WHOLE word; do not pattern-match the first letters.
 */
const MONTH_WORD_RULE =
  'MONTHS are often written as a WORD (Ukrainian/Russian), not a number. Read the ENTIRE ' +
  'month word, every letter — do NOT confuse adjacent months: червня/июня = 06 June (NOT ' +
  'липня/июля = 07 July); травня/мая = 05 May (NOT березня/марта = 03 March). A wrong month ' +
  'is the most common error on these documents — be deliberate.'

// RUSSIAN-SCRIPT rule for Soviet/UkrSSR-era documents written in RUSSIAN. The model tends
// to "helpfully" Ukrainianize a Russian source (Сергей→Сергій). That is a TRANSCRIPTION
// ERROR for a certified translation, which must reflect the document AS WRITTEN.
const RUSSIAN_SCRIPT_RULE =
  'RUSSIAN SOURCE — Soviet/UkrSSR-era documents are often written in RUSSIAN, not Ukrainian. ' +
  'If the script on the page is Russian, transcribe it EXACTLY as Russian — do NOT convert it to ' +
  'Ukrainian. Keep the Russian letters ы/э/ё/ъ (do not "fix" them to и/е/є/і). Keep Russian name ' +
  'forms verbatim: Сергей (NOT Сергій), Сергеевич (NOT Сергійович), Наталья (NOT Наталія), ' +
  'Куропятник with no apostrophe (NOT Куроп’ятник), Леонидович, Степановна. Keep Russian place/' +
  'oblast forms: Винницкая область (NOT Вінницька), Тростянецкого района (NOT району). Russian ' +
  'month names января/февраля/марта/апреля/мая/июня/июля/августа/сентября/октября/ноября/декабря ' +
  'map to 01–12. Do NOT romanize — return the Cyrillic exactly; the correct system (Russian ' +
  'BGN/PCGN vs Ukrainian KMU-55) is chosen downstream by the source script.'

export const DOC_READING_RULES: Record<string, DocReadingRules> = {
  ua_birth_certificate: {
    language:
      'May be RUSSIAN (Soviet/UkrSSR era) OR Ukrainian. Transcribe EXACTLY the script that ' +
      'is on the page — if the certificate is written in Russian (Куропятник, Сергей, ' +
      'Сергеевич), keep the Russian; do NOT Ukrainianize it. If Ukrainian (Куроп’ятник, ' +
      'Сергій), keep Ukrainian. Never convert one to the other.',
    dateGuidance:
      'The date of birth is usually SPELLED OUT in cursive WORDS ("двадцать пятого июня ' +
      'тысяча девятьсот восемьдесят шестого года" = 25 June 1986), NOT digits. ' +
      'METHOD (how a careful reader decodes it): FIRST anchor on the YEAR — it is four number-' +
      'words "(одна) тысяча девятьсот <tens> <units> года" and is the easiest part; read it to ' +
      'fix the year. THEN read the DAY as an ordinal word (першого/першій=01 … двадцять ' +
      'п’ятого/двадцать пятого=25 … тридцять першого=31) and the MONTH as a word. Assemble ' +
      'YYYY-MM-DD. ' + MONTH_WORD_RULE,
    rules: [
      'This is a vintage handwritten certificate on a printed form — the LABELS are printed, ' +
        'the VALUES are handwritten cursive. Read the cursive values letter by letter.',
      RUSSIAN_SCRIPT_RULE,
      'Read ALL parties: child, FATHER full name, MOTHER full name (e.g. "Куропятник Сергей ' +
        'Леонидович", "Куропятник Наталья Степановна").',
      'Read the certificate series + number, usually Roman-numeral + letters + digits (e.g. ' +
        '"III-АМ № 428069").',
      'Place of birth is "пгт/смт/село <Name>, <…> району/района, <…> області/области, УРСР/УССР".',
    ],
  },

  ua_internal_passport_booklet: {
    language: 'Ukrainian (handwritten identity page of the old booklet).',
    dateGuidance:
      'Date may be handwritten digits or a stamp. ' + MONTH_WORD_RULE,
    rules: [
      'Handwritten identity page — read names letter by letter; the patronymic is often the ' +
        'hardest field (do NOT return a bare suffix like "ович").',
    ],
  },

  ua_international_passport: {
    language:
      'Bilingual PRINTED biometric passport: Cyrillic + the official LATIN romanization + MRZ.',
    dateGuidance:
      'Dates are printed (e.g. "25 ЧЕР/JUN 86"). The MRZ second line encodes YYMMDD with a ' +
      'check digit (e.g. 8606257 = 1986-06-25, check digit 7) — it is the authoritative date.',
    rules: [
      'The LATIN spelling printed on the document and in the MRZ is CONTROLLING — return it ' +
        'EXACTLY as printed (e.g. "SERGII"); do NOT re-transliterate it yourself (do NOT turn ' +
        'SERGII into SERHII).',
      'The MRZ is the math anchor: read both MRZ lines verbatim; they validate surname, given ' +
        'name, passport number, date of birth and sex.',
    ],
  },

  ua_military_id: {
    language: 'Ukrainian (Сергій/Сергійович forms), handwritten on a printed booklet.',
    dateGuidance:
      'Date of birth is handwritten — the month is usually a cursive WORD (червня = June). ' +
      MONTH_WORD_RULE,
    rules: [
      'The page is OFTEN PHOTOGRAPHED ROTATED 90°/180° — mentally rotate upright first.',
      'Series + number is "<2 Cyrillic letters> ######" (e.g. "СО 845621").',
      'Place of birth is "сел./смт <Name>, <oblast> обл."; marital status may be "неодружений".',
    ],
  },

  ua_marriage_certificate: {
    language: 'Modern = PRINTED Ukrainian (high accuracy); vintage = handwritten.',
    dateGuidance: MONTH_WORD_RULE,
    rules: [
      RUSSIAN_SCRIPT_RULE,
      'Read BOTH spouses (surname/given/patronymic + each birth date + birth place), the ' +
        'marriage date, the act-record number, the registering RAGS/DRACS office, and the ' +
        'serial (e.g. "I-БК № 153243"). Note the surname each spouse takes after marriage.',
    ],
  },

  ua_divorce_certificate: {
    language: 'Ukrainian; modern printed or vintage handwritten. May be marked "ПОВТОРНО".',
    dateGuidance: MONTH_WORD_RULE,
    rules: [
      RUSSIAN_SCRIPT_RULE,
      'Read both former spouses, the dissolution date, the act-record number, the registering ' +
        'office, and the serial (e.g. "I-БК № 18…"). Some copies are PII-redacted (greyed ' +
        'boxes) — leave redacted fields EMPTY, never guess under a redaction.',
    ],
  },

  ua_death_certificate: {
    language:
      'Ukrainian (Свідоцтво про смерть) or Russian (Свидетельство о смерти); vintage = ' +
      'handwritten on a printed form. Transcribe the script as written; do not convert RU↔UA.',
    dateGuidance:
      'TWO distinct dates: date of birth and DATE OF DEATH — read each from its own location, ' +
      'never copy one into the other. ' + MONTH_WORD_RULE,
    rules: [
      RUSSIAN_SCRIPT_RULE,
      'Read the deceased: surname / given / patronymic (e.g. "Куроп’ятник Сергій Сергійович").',
      'place_of_death is "м./смт/село <Name>, <oblast> область".',
      'Read the act-record number, the registering RAGS/DRACS office, and the serial ' +
        '(Roman + letters + digits, e.g. "I-АМ № 123456").',
    ],
  },

  ua_name_change_certificate: {
    language: 'Ukrainian/Russian; vintage = handwritten (Свідоцтво про зміну імені).',
    dateGuidance: MONTH_WORD_RULE,
    rules: [
      'There are TWO name sets — the PREVIOUS name and the NEW name. Read both fully and keep ' +
        'them in their own fields; never merge them (e.g. previous "Іванов Іван Іванович" → ' +
        'new "Петренко Іван Іванович").',
      'Read the act-record number, registering office, and serial.',
    ],
  },

  ua_id_card: {
    language:
      'Modern PLASTIC ID card (ID-1), machine-printed Ukrainian; carries a TD1 MRZ on the back.',
    dateGuidance:
      'Dates are printed DD.MM.YYYY. The TD1 MRZ (3 lines × 30 chars) encodes the record number, ' +
      'DOB (YYMMDD + check digit) and expiry — it is the math anchor.',
    rules: [
      'Read the printed Cyrillic names; if an official Latin transliteration is printed, return ' +
        'it EXACTLY (controlling). The record number is a 9-digit number (e.g. "001234567").',
      'High-accuracy printed class — but still cross-check DOB/number against the TD1 MRZ.',
    ],
  },

  us_ead: {
    language: 'US Employment Authorization Document (Form I-766), machine-printed ENGLISH.',
    dateGuidance:
      'Dates are printed MM/DD/YYYY (e.g. "Card Expires 03/15/2026"). Two dates: valid-from and ' +
      'card-expires — keep them separate.',
    rules: [
      'A-Number (USCIS #): "A" + 9 digits, often shown as "A### ### ###" (e.g. A123456789) — ' +
        'return digits only, preserve all 9.',
      'Card # (USCIS card number): 3 letters + 10 digits (e.g. "SRC2290012345").',
      'CATEGORY is a code, NOT free text — e.g. "C08", "C09", "A12", "C19" (C19/A12 = TPS); ' +
        'read it EXACTLY (letter+digits), do not interpret it.',
      'Names are printed in the document’s controlling Latin — return as printed.',
    ],
  },

  us_i94: {
    language: 'US I-94 Arrival/Departure Record, machine-printed ENGLISH (web printout or stamp).',
    dateGuidance:
      'Dates often "YYYY Month DD" or MM/DD/YYYY. "Admit Until Date" may be a date OR the text ' +
      '"D/S" (Duration of Status) — if it says D/S, return "D/S", do not invent a date.',
    rules: [
      'Admission (I-94) Number: 11 characters (digits, sometimes with a trailing letter) — ' +
        'read ALL 11, e.g. "12345678901".',
      'Class of Admission is a visa code (e.g. "B2", "F1", "H1B", "TPS") — read exactly.',
      'Port of entry is a US city/airport (e.g. "CHICAGO, IL").',
    ],
  },

  us_i797: {
    language: 'US Form I-797 Notice of Action (USCIS), machine-printed ENGLISH.',
    dateGuidance: 'Dates are printed MM/DD/YYYY (Notice Date, Received Date, Valid From/To).',
    rules: [
      'Receipt Number: 3 letters + 10 digits — the prefix is a service-center code ' +
        '(EAC/WAC/SRC/MSC/LIN/IOE), e.g. "IOE1234567890". Read all 13 characters exactly.',
      'A-Number: "A" + 9 digits (e.g. A123456789). USCIS Online Account Number is a separate ' +
        '12-digit number — do not confuse the two.',
      'Notice type / form number (e.g. "I-765", "I-821") and the validity window may be present.',
    ],
  },
}

/**
 * Build the per-document reading-rules block to append to the Gemini prompt.
 * Empty string when the class has no rules or the flag is off (caller gates).
 */
export function readingRulesPromptBlock(docTypeId: string): string {
  const r = DOC_READING_RULES[docTypeId]
  if (!r) return ''
  const lines: string[] = []
  lines.push(`\nDOCUMENT-SPECIFIC READING RULES for this ${docTypeId}:`)
  lines.push(`- LANGUAGE/SCRIPT: ${r.language}`)
  if (r.dateGuidance) lines.push(`- DATES: ${r.dateGuidance}`)
  for (const rule of r.rules) lines.push(`- ${rule}`)
  return lines.join('\n')
}

// DEFAULT ON (2026-06-22): the per-document reading rules are proven to fix real reads
// (Soviet birth-cert DOB "26 июля"→"25 июня", 2/2 live) and are strictly-additive guidance
// per document class — so they are active by default for ALL products (translation, TPS,
// EAD, Re-Parole all read through the shared readDocument → buildPrompt). Set
// DOC_READING_RULES_ENABLED=0 to disable (rollback without a code change).
export function isDocReadingRulesEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.DOC_READING_RULES_ENABLED !== '0'
}
