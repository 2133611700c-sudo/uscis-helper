/**
 * mrz.ts — TD3 (passport) Machine-Readable Zone parser.
 *
 * WHY: the MRZ carries the CONTROLLING Latin spelling of the holder's name +
 * passport number + DOB. HARD RULE: controlling Latin (MRZ/I-94/EAD) beats any
 * re-transliteration (KMU-55). So for an international passport we read the name
 * from the MRZ, not by transliterating the Cyrillic — this keeps the translation
 * matching the client's other USCIS documents.
 *
 * Two lines of 44 chars. Tolerant of OCR noise (spaces, stray chars) but validates
 * ICAO 7-3-1 check digits so a misread number/DOB is flagged, never trusted blindly.
 */

const WEIGHTS = [7, 3, 1]
function charVal(c: string): number {
  if (c === '<') return 0
  if (c >= '0' && c <= '9') return c.charCodeAt(0) - 48
  if (c >= 'A' && c <= 'Z') return c.charCodeAt(0) - 55 // A=10..Z=35
  return 0
}
export function checkDigit(s: string): number {
  let sum = 0
  for (let i = 0; i < s.length; i++) sum += charVal(s[i]) * WEIGHTS[i % 3]
  return sum % 10
}

export interface MrzResult {
  ok: boolean                 // both lines found & parsed
  surname: string             // Latin, controlling
  given_names: string         // Latin, controlling
  passport_no: string
  nationality: string
  date_of_birth: string | null // ISO yyyy-mm-dd
  sex: 'M' | 'F' | 'X' | ''
  expiry: string | null        // ISO
  checks: { passport_no: boolean; dob: boolean; expiry: boolean }
  review_required: boolean     // any check digit failed → verify
}

function isoFromYYMMDD(s: string, pivot = 30): string | null {
  if (!/^\d{6}$/.test(s)) return null
  const yy = Number(s.slice(0, 2)), mm = s.slice(2, 4), dd = s.slice(4, 6)
  const year = yy <= pivot ? 2000 + yy : 1900 + yy
  if (Number(mm) < 1 || Number(mm) > 12 || Number(dd) < 1 || Number(dd) > 31) return null
  return `${year}-${mm}-${dd}`
}

/** Extract the two TD3 lines from arbitrary OCR text (e.g. Google Vision fullText). */
export function findMrzLines(text: string): [string, string] | null {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/\s+/g, '').toUpperCase()).filter(Boolean)
  // a TD3 line is ~30-44 chars of [A-Z0-9<]; line 1 starts with P< (or P + filler)
  const cand = lines.filter((l) => /^[A-Z0-9<]{28,46}$/.test(l) && l.includes('<'))
  const l1 = cand.find((l) => /^P[<A-Z]/.test(l) && l.includes('<<'))
  if (l1) {
    const i = cand.indexOf(l1)
    const l2 = cand[i + 1] ?? cand.find((l) => l !== l1 && /[0-9]/.test(l))
    if (l2) return [l1.padEnd(44, '<').slice(0, 44), l2.padEnd(44, '<').slice(0, 44)]
  }
  return null
}

export function parseMrz(text: string): MrzResult {
  const empty: MrzResult = {
    ok: false, surname: '', given_names: '', passport_no: '', nationality: '',
    date_of_birth: null, sex: '', expiry: null,
    checks: { passport_no: false, dob: false, expiry: false }, review_required: true,
  }
  const lines = findMrzLines(text)
  if (!lines) return empty
  const [l1, l2] = lines

  const nameField = l1.slice(5)
  const [surRaw, givRaw = ''] = nameField.split('<<')
  const surname = surRaw.replace(/</g, ' ').trim()
  const given_names = givRaw.replace(/</g, ' ').trim()

  const passport_no = l2.slice(0, 9).replace(/</g, '')
  const passCheck = checkDigit(l2.slice(0, 9)) === charVal(l2[9])
  const nationality = l2.slice(10, 13).replace(/</g, '')
  const dobRaw = l2.slice(13, 19)
  const dobCheck = checkDigit(dobRaw) === charVal(l2[19])
  const date_of_birth = isoFromYYMMDD(dobRaw)
  const sexChar = l2[20]
  const sex = sexChar === 'M' || sexChar === 'F' ? sexChar : sexChar === '<' ? 'X' : ''
  const expRaw = l2.slice(21, 27)
  const expCheck = checkDigit(expRaw) === charVal(l2[27])
  const expiry = isoFromYYMMDD(expRaw, 70)

  const checks = { passport_no: passCheck, dob: dobCheck, expiry: expCheck }
  return {
    ok: !!surname,
    surname, given_names, passport_no, nationality, date_of_birth, sex: sex as MrzResult['sex'], expiry,
    checks,
    review_required: !(passCheck && dobCheck), // name has no check digit → controlling but still human-glanced upstream
  }
}
