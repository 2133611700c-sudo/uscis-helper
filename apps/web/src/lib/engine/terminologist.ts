/**
 * engine/terminologist.ts — D3a: DETERMINISTIC translation of closed terms.
 * Dates and known authorities are never sent to an LLM — they are converted by
 * fixed rules / the knowledge glossary, so they cannot be "creatively
 * mistranslated" (v5 §10 numbers-are-evidence, §6 historical locks).
 */

import { AUTHORITY_PATTERNS, AUTHORITIES } from '@uscis-helper/knowledge'

const UA_MONTHS: Record<string, number> = {
  січня: 1, лютого: 2, березня: 3, квітня: 4, травня: 5, червня: 6,
  липня: 7, серпня: 8, вересня: 9, жовтня: 10, листопада: 11, грудня: 12,
}
const RU_MONTHS: Record<string, number> = {
  января: 1, февраля: 2, марта: 3, апреля: 4, мая: 5, июня: 6,
  июля: 7, августа: 8, сентября: 9, октября: 10, ноября: 11, декабря: 12,
}
const EN_MONTHS = ['', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']

/**
 * Format a Ukrainian/Russian date to USCIS-safe English "25 February 2011"
 * (day-month-year, no ambiguity). Accepts: "25 лютого 2011 року",
 * "01.01.1990", "1990-01-01", "26 июня 1965". Returns null if not parseable
 * (caller keeps it for human review — never guesses).
 */
/** Real-calendar check: month 1-12, day valid for that month (+leap), plausible
 *  year. No future guard here — a passport expiry is legitimately in the future;
 *  DOB/issue future checks belong to the field-level caller. */
function isValidDmy(d: number, mo: number, y: number): boolean {
  if (mo < 1 || mo > 12) return false
  if (y < 1900 || y > 2100) return false
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
  const dim = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mo - 1]
  return d >= 1 && d <= dim
}

export function formatDateEn(raw: string): string | null {
  const s = (raw ?? '').trim()
  if (!s) return null

  // ISO YYYY-MM-DD
  let m = s.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (m && isValidDmy(+m[3], +m[2], +m[1])) return `${+m[3]} ${EN_MONTHS[+m[2]]} ${m[1]}`

  // numeric DD.MM.YYYY (or / -)
  m = s.match(/(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})/)
  if (m && isValidDmy(+m[1], +m[2], +m[3])) return `${+m[1]} ${EN_MONTHS[+m[2]]} ${m[3]}`

  // textual "25 <month> 2011"
  m = s.match(/(\d{1,2})\s+([а-яіїєґ']+)\s+(\d{4})/iu)
  if (m) {
    const mon = m[2].toLocaleLowerCase('uk')
    const mo = UA_MONTHS[mon] ?? RU_MONTHS[mon]
    if (mo && isValidDmy(+m[1], mo, +m[3])) return `${+m[1]} ${EN_MONTHS[mo]} ${m[3]}`
  }
  return null
}

/**
 * Translate an authority / agency string via the knowledge glossary
 * (historical locks: Міліція→Militsiya, never Police). Returns null if no
 * known authority pattern matches → caller sends the prose to the LLM
 * translator with the rest of the free text.
 */
export function translateAuthority(raw: string): string | null {
  const s = (raw ?? '').trim()
  if (!s) return null
  for (const [re, key] of AUTHORITY_PATTERNS) {
    if (re.test(s)) {
      const a = AUTHORITIES[key]
      if (a) return a.official_en
    }
  }
  return null
}
