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

export const DOC_READING_RULES: Record<string, DocReadingRules> = {
  ua_birth_certificate: {
    language:
      'May be RUSSIAN (Soviet/UkrSSR era) OR Ukrainian. Transcribe EXACTLY the script that ' +
      'is on the page — if the certificate is written in Russian (Куропятник, Сергей, ' +
      'Сергеевич), keep the Russian; do NOT Ukrainianize it. If Ukrainian (Куроп’ятник, ' +
      'Сергій), keep Ukrainian. Never convert one to the other.',
    dateGuidance:
      'The date of birth is usually SPELLED OUT in cursive WORDS ("двадцать пятого июня ' +
      'тысяча девятьсот восемьдесят шестого года" = 25 June 1986), NOT digits. Read the day ' +
      'word and the month WORD in full. ' + MONTH_WORD_RULE,
    rules: [
      'This is a vintage handwritten certificate on a printed form — the LABELS are printed, ' +
        'the VALUES are handwritten cursive. Read the cursive values letter by letter.',
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
      'Read BOTH spouses (surname/given/patronymic + each birth date + birth place), the ' +
        'marriage date, the act-record number, the registering RAGS/DRACS office, and the ' +
        'serial (e.g. "I-БК № 153243"). Note the surname each spouse takes after marriage.',
    ],
  },

  ua_divorce_certificate: {
    language: 'Ukrainian; modern printed or vintage handwritten. May be marked "ПОВТОРНО".',
    dateGuidance: MONTH_WORD_RULE,
    rules: [
      'Read both former spouses, the dissolution date, the act-record number, the registering ' +
        'office, and the serial. Some copies are PII-redacted (greyed boxes) — leave redacted ' +
        'fields empty, never guess under a redaction.',
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

export function isDocReadingRulesEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.DOC_READING_RULES_ENABLED === '1'
}
