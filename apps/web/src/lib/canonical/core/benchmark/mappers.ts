/**
 * benchmark/mappers.ts — map each reader's NATIVE output to the common
 * ProducedField[] keyed to the passport ground-truth fields, so all readers are
 * scored on the same axis. Shapes verified against the real code.
 *
 * Readers compared: MRZ parser, old Translation (docintel/Gemini), old TPS
 * (Vision/DocAI+modules), and the new Document Core.
 */
import type { ProducedField } from '../benchmark'
import type { Td3ParseResult } from '@/lib/translation/identity/mrzParser'
import type { TpsExtractedField } from '@/lib/tps/types'
import type { CanonicalField } from '../../types'

/** Minimal subset of docintel ExtractedDocField we read (verified shape). */
export interface DocintelField {
  field: string
  raw_cyrillic: string | null
  value: string | null
  review_required: boolean
}

const MONTHS: Record<string, string> = {
  January: '01', February: '02', March: '03', April: '04', May: '05', June: '06',
  July: '07', August: '08', September: '09', October: '10', November: '11', December: '12',
}
/** MRZ parser emits "D Month YYYY" (USCIS). Convert to ISO for comparison. */
function mrzDateToIso(d: string | null): string | null {
  if (!d) return null
  const m = d.match(/^(\d{1,2}) (\w+) (\d{4})$/)
  if (!m) return d
  const mm = MONTHS[m[2]]
  return mm ? `${m[3]}-${mm}-${m[1].padStart(2, '0')}` : d
}

function pf(key: string, value: string | null | undefined, reviewRequired: boolean): ProducedField | null {
  const v = (value ?? '').trim()
  return v === '' ? null : { key, value: v, reviewRequired }
}

// ── MRZ parser → ProducedField[] (latin identity + passport fields only) ──────
export function mapMrz(r: Td3ParseResult): ProducedField[] {
  const check = (f: string): boolean | null => r.checkResults.find((c) => c.field === f)?.valid ?? null
  const overallBad = !r.checkDigitsValid
  const docBad = check('document_number') === false || overallBad
  const dobBad = check('date_of_birth') === false || overallBad
  const expBad = check('date_of_expiry') === false || overallBad
  const out: (ProducedField | null)[] = [
    pf('family_name_latin', r.surname, overallBad), // name has no own check digit → overall
    pf('given_name_latin', r.givenNames, overallBad),
    pf('passport_number', r.documentNumber, docBad),
    pf('dob', mrzDateToIso(r.dateOfBirth), dobBad),
    pf('expiry_date', mrzDateToIso(r.dateOfExpiry), expBad),
    pf('sex', r.sex === 'Male' ? 'M' : r.sex === 'Female' ? 'F' : '', overallBad),
    pf('citizenship', r.nationality, overallBad), // raw 3-letter (e.g. UKR) — normalization is downstream
  ]
  return out.filter((x): x is ProducedField => x !== null)
  // NOTE: MRZ produces NO Cyrillic, no patronymic, no place/province → those are
  // intentionally absent (the benchmark will show them as MRZ's coverage gap).
}

// ── Translation (docintel/Gemini) → ProducedField[] (latin + cyrillic) ────────
const TR_ALIAS: Record<string, string> = {
  surname: 'family_name', family_name: 'family_name',
  given_names: 'given_name', given_name: 'given_name',
  patronymic: 'patronymic',
  date_of_birth: 'dob', dob: 'dob',
  date_of_expiry: 'expiry_date', expiry_date: 'expiry_date',
  sex: 'sex',
  passport_number: 'passport_number', document_number: 'passport_number',
  nationality: 'citizenship', citizenship: 'citizenship',
  place_of_birth: 'place_of_birth',
  province: 'province', oblast: 'province',
}
const BOTH_SCRIPTS = new Set(['family_name', 'given_name', 'patronymic', 'place_of_birth'])

export function mapTranslation(fields: DocintelField[]): ProducedField[] {
  const out: (ProducedField | null)[] = []
  for (const f of fields) {
    const base = TR_ALIAS[f.field]
    if (!base) continue
    if (BOTH_SCRIPTS.has(base)) {
      const latinKey = base === 'place_of_birth' ? 'place_of_birth_english' : `${base}_latin`
      const cyrKey = base === 'place_of_birth' ? 'place_of_birth_raw' : `${base}_cyrillic`
      out.push(pf(latinKey, f.value, f.review_required))
      out.push(pf(cyrKey, f.raw_cyrillic, f.review_required))
    } else {
      out.push(pf(base, f.value, f.review_required))
    }
  }
  return out.filter((x): x is ProducedField => x !== null)
}

// ── old TPS (Vision/DocAI+modules) → ProducedField[] (latin only) ─────────────
const TPS_ALIAS: Record<string, string> = {
  family_name: 'family_name_latin', given_name: 'given_name_latin',
  dob: 'dob', date_of_birth: 'dob',
  passport_number: 'passport_number',
  passport_expiration_date: 'expiry_date', date_of_expiry: 'expiry_date',
  sex: 'sex', country_of_nationality: 'citizenship',
  city_of_birth: 'place_of_birth_english', place_of_birth: 'place_of_birth_english',
  province_of_birth: 'province',
}
export function mapTps(fields: TpsExtractedField[]): ProducedField[] {
  return fields
    .map((f) => {
      const key = TPS_ALIAS[f.field]
      return key ? pf(key, f.normalized_value ?? f.raw_value, f.review_required) : null
    })
    .filter((x): x is ProducedField => x !== null)
}

// ── new Document Core → ProducedField[] (uses canonical keys → GT keys) ───────
const CORE_ALIAS: Record<string, string> = { ...TPS_ALIAS } // Core uses the same field keys as TPS candidates
export function mapCore(fields: CanonicalField[]): ProducedField[] {
  return fields
    .map((f) => {
      const key = CORE_ALIAS[f.key]
      return key ? pf(key, f.normalizedValue ?? f.rawValue, f.reviewRequired) : null
    })
    .filter((x): x is ProducedField => x !== null)
}
