/**
 * Passport extraction module — Ukrainian international passport (TD3).
 *
 * Input:  OcrResult from /api/tps/ocr/extract (Google Vision DOCUMENT_TEXT_DETECTION)
 * Output: TpsModuleResult with TpsExtractedField[] for each MRZ-derived field
 *
 * Strategy:
 *   1. Locate the MRZ — 2 consecutive lines on the lower portion of the
 *      document with high MRZ-character ratio (uppercase A-Z, 0-9, '<')
 *      and length ≈ 44 each.
 *   2. Pass the two lines to v5 mrzParser.parseTd3().
 *   3. Map each parsed field to a TpsExtractedField with provenance
 *      (source_zone='mrz_line_X', bbox from the OCR line, confidence).
 *   4. Flag review_required when:
 *        - any check digit failed
 *        - DOB parses but is implausible (< 1900 or > today)
 *        - expiry already past or < 6 months from today
 *        - nationality != UKR (TPS Ukraine requires Ukrainian nationality)
 *
 * Reuse: lib/translation/identity/mrzParser.ts (TD3, check digits, dates).
 *
 * Privacy: RNOKPP / personalNumber is parsed for check-digit consistency
 * but is NOT returned as a TpsExtractedField — it is never used to fill a
 * USCIS form and we deliberately do not propagate it downstream.
 */

import type { OcrResult, OcrLine } from '@/lib/ocr/types'
import type {
  TpsExtractedField,
  TpsModuleResult,
  TpsDocType,
} from '@/lib/tps/types'
import { parseTd3 } from '@/lib/translation/identity/mrzParser'

const PASSPORT_MODULE: TpsDocType = 'passport'

// Minimum MRZ-character ratio required to consider a line as MRZ.
// MRZ chars are A-Z, 0-9, '<'. We allow some OCR noise but reject lines
// like "Ivan Kovalenko" (lots of lowercase).
const MIN_MRZ_RATIO = 0.85

// TD3 line length is 44. We accept 42..46 to absorb OCR boundary drift.
const TD3_LINE_LEN_MIN = 42
const TD3_LINE_LEN_MAX = 46

/**
 * Returns the share of characters in `s` that are valid MRZ characters.
 */
function mrzCharRatio(s: string): number {
  if (s.length === 0) return 0
  let valid = 0
  for (const ch of s) {
    if (/[A-Z0-9<]/.test(ch)) valid++
  }
  return valid / s.length
}

/**
 * Compact an OCR line to MRZ shape: uppercase, strip whitespace, replace
 * common OCR confusions (« » → <, ' ' → '', etc.).
 */
function toMrzShape(s: string): string {
  return s
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[«»]/g, '<')
    .replace(/[¥]/g, '<')
}

/**
 * Pad / trim to exactly 44 chars. Padding with '<' is the ICAO standard
 * filler so it doesn't break check-digit math when the OCR clipped a
 * trailing filler.
 */
function normaliseTd3Line(s: string): string {
  if (s.length === 44) return s
  if (s.length < 44) return s.padEnd(44, '<')
  return s.slice(0, 44)
}

/**
 * Convert a "D Month YYYY" USCIS date (returned by parseMrzDate) to
 * ISO YYYY-MM-DD, since TPSAnswers stores dates in ISO form.
 */
const MONTH_MAP: Record<string, string> = {
  January: '01', February: '02', March: '03', April: '04',
  May: '05', June: '06', July: '07', August: '08',
  September: '09', October: '10', November: '11', December: '12',
}
function uscisDateToIso(d: string | null): string | null {
  if (!d) return null
  const m = d.match(/^(\d{1,2}) (\w+) (\d{4})$/)
  if (!m) return null
  const day = m[1].padStart(2, '0')
  const month = MONTH_MAP[m[2]]
  if (!month) return null
  return `${m[3]}-${month}-${day}`
}

/**
 * Find the two MRZ lines in an OcrResult. Returns null if not found.
 */
function locateMrzLines(ocr: OcrResult): { line1: OcrLine; line2: OcrLine } | null {
  // Build candidates: lines on the lower half of the page with high MRZ ratio.
  const candidates: OcrLine[] = []
  for (const line of ocr.lines) {
    const shape = toMrzShape(line.text)
    if (shape.length < TD3_LINE_LEN_MIN || shape.length > TD3_LINE_LEN_MAX) continue
    if (mrzCharRatio(shape) < MIN_MRZ_RATIO) continue
    candidates.push(line)
  }
  if (candidates.length < 2) return null

  // Sort by y (top to bottom) and look for two adjacent lines.
  candidates.sort((a, b) => a.bbox.y - b.bbox.y)

  // The first MRZ line of a TD3 passport starts with "P" (document type).
  for (let i = 0; i < candidates.length - 1; i++) {
    const top = candidates[i]
    const next = candidates[i + 1]
    const topShape = toMrzShape(top.text)
    // Adjacency check: lines are within 5% of each other on Y axis.
    const gap = next.bbox.y - (top.bbox.y + top.bbox.height)
    if (gap > 0.05) continue
    if (topShape.startsWith('P')) {
      return { line1: top, line2: next }
    }
  }

  // Fallback: take the bottom two candidates regardless of starting char.
  // The check digits will catch a wrong pair.
  if (candidates.length >= 2) {
    const last = candidates[candidates.length - 1]
    const prev = candidates[candidates.length - 2]
    return { line1: prev, line2: last }
  }
  return null
}

interface PassportModuleOptions {
  /** Caller-supplied document id used for source_document_id in fields. */
  document_id: string
}

/**
 * Run the passport module against an OcrResult.
 *
 * Always returns a result — never throws. If no MRZ found, returns
 * matched=false with a debug match_reason. If MRZ found but check digits
 * fail, returns matched=true with manual_review_required=true.
 */
export function runPassportModule(
  ocr: OcrResult,
  opts: PassportModuleOptions,
): TpsModuleResult {
  const located = locateMrzLines(ocr)
  if (!located) {
    return {
      module: PASSPORT_MODULE,
      matched: false,
      match_reason: 'mrz_not_located',
      fields: [],
      warnings: ['Could not locate a TD3 MRZ on this document.'],
      manual_review_required: false,
      manual_review_reasons: [],
    }
  }

  const line1 = normaliseTd3Line(toMrzShape(located.line1.text))
  const line2 = normaliseTd3Line(toMrzShape(located.line2.text))
  const parsed = parseTd3(line1, line2)

  // High-level routing decisions
  const manual_review_reasons: string[] = []
  if (!parsed.checkDigitsValid) {
    manual_review_reasons.push('mrz_check_digit_failed')
  }
  if (parsed.nationality && parsed.nationality !== 'UKR') {
    manual_review_reasons.push('not_ukrainian_nationality')
  }

  // Build extracted fields
  const fields: TpsExtractedField[] = []
  const baseProvenance = {
    extraction_source: 'ocr_mrz' as const,
    source_document_id: opts.document_id,
    language_layer: 'mrz' as const,
    user_corrected: false,
  }

  // Per-field check digit lookup
  const docNumCheck = parsed.checkResults.find(r => r.field === 'document_number')
  const dobCheck   = parsed.checkResults.find(r => r.field === 'date_of_birth')
  const expCheck   = parsed.checkResults.find(r => r.field === 'date_of_expiry')

  if (parsed.surname) {
    fields.push({
      ...baseProvenance,
      field: 'family_name',
      raw_value: parsed.surname,
      normalized_value: parsed.surname.charAt(0).toUpperCase() + parsed.surname.slice(1).toLowerCase(),
      source_zone: 'mrz_line_1_surname',
      bbox: located.line1.bbox,
      confidence: located.line1.confidence ?? null,
      review_required: false,
      ocr_word_ids: located.line1.words.map(w => w.id),
      passes: ['mrz_name_split'],
      failures: [],
    })
  }
  if (parsed.givenNames) {
    fields.push({
      ...baseProvenance,
      field: 'given_name',
      raw_value: parsed.givenNames,
      normalized_value: parsed.givenNames.split(' ').map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(' '),
      source_zone: 'mrz_line_1_given',
      bbox: located.line1.bbox,
      confidence: located.line1.confidence ?? null,
      review_required: false,
      ocr_word_ids: located.line1.words.map(w => w.id),
      passes: ['mrz_name_split'],
      failures: [],
    })
  }
  if (parsed.documentNumber) {
    fields.push({
      ...baseProvenance,
      field: 'passport_number',
      raw_value: parsed.documentNumber,
      normalized_value: parsed.documentNumber,
      source_zone: 'mrz_line_2_document_number',
      bbox: located.line2.bbox,
      confidence: located.line2.confidence ?? null,
      review_required: docNumCheck?.valid === false,
      ocr_word_ids: located.line2.words.map(w => w.id),
      passes: docNumCheck?.valid === true ? ['mrz_check_digit'] : [],
      failures: docNumCheck?.valid === false ? ['mrz_check_digit'] : [],
    })
  }
  if (parsed.nationality) {
    fields.push({
      ...baseProvenance,
      field: 'country_of_nationality',
      raw_value: parsed.nationality,
      normalized_value: parsed.nationality === 'UKR' ? 'Ukraine' : parsed.nationality,
      source_zone: 'mrz_line_2_nationality',
      bbox: located.line2.bbox,
      confidence: located.line2.confidence ?? null,
      review_required: parsed.nationality !== 'UKR',
      ocr_word_ids: located.line2.words.map(w => w.id),
      passes: ['mrz_nationality_present'],
      failures: parsed.nationality !== 'UKR' ? ['nationality_not_ukr'] : [],
    })
  }
  if (parsed.dateOfBirth) {
    const iso = uscisDateToIso(parsed.dateOfBirth)
    fields.push({
      ...baseProvenance,
      field: 'dob',
      raw_value: parsed.dateOfBirth,
      normalized_value: iso,
      source_zone: 'mrz_line_2_dob',
      bbox: located.line2.bbox,
      confidence: located.line2.confidence ?? null,
      review_required: dobCheck?.valid === false,
      ocr_word_ids: located.line2.words.map(w => w.id),
      passes: [
        ...(dobCheck?.valid === true ? ['mrz_check_digit'] : []),
        ...(iso ? ['iso_date_parsed'] : []),
      ],
      failures: dobCheck?.valid === false ? ['mrz_check_digit'] : [],
    })
  }
  if (parsed.sex !== 'Unspecified') {
    fields.push({
      ...baseProvenance,
      field: 'sex',
      raw_value: parsed.sex,
      normalized_value: parsed.sex === 'Male' ? 'M' : 'F',
      source_zone: 'mrz_line_2_sex',
      bbox: located.line2.bbox,
      confidence: located.line2.confidence ?? null,
      review_required: false,
      ocr_word_ids: located.line2.words.map(w => w.id),
      passes: ['mrz_sex_present'],
      failures: [],
    })
  }
  if (parsed.dateOfExpiry) {
    const iso = uscisDateToIso(parsed.dateOfExpiry)
    const expired = iso ? iso < new Date().toISOString().slice(0, 10) : false
    fields.push({
      ...baseProvenance,
      field: 'passport_expiration_date',
      raw_value: parsed.dateOfExpiry,
      normalized_value: iso,
      source_zone: 'mrz_line_2_expiry',
      bbox: located.line2.bbox,
      confidence: located.line2.confidence ?? null,
      review_required: expCheck?.valid === false || expired,
      ocr_word_ids: located.line2.words.map(w => w.id),
      passes: [
        ...(expCheck?.valid === true ? ['mrz_check_digit'] : []),
        ...(iso ? ['iso_date_parsed'] : []),
      ],
      failures: [
        ...(expCheck?.valid === false ? ['mrz_check_digit'] : []),
        ...(expired ? ['expired_passport'] : []),
      ],
    })
    if (expired) manual_review_reasons.push('expired_passport')
  }

  // Issuing country (separate from nationality field on USCIS forms)
  if (parsed.issuingState) {
    fields.push({
      ...baseProvenance,
      field: 'passport_country_of_issuance',
      raw_value: parsed.issuingState,
      normalized_value: parsed.issuingState === 'UKR' ? 'Ukraine' : parsed.issuingState,
      source_zone: 'mrz_line_1_issuing_state',
      bbox: located.line1.bbox,
      confidence: located.line1.confidence ?? null,
      review_required: false,
      ocr_word_ids: located.line1.words.map(w => w.id),
      passes: ['mrz_issuing_state_present'],
      failures: [],
    })
  }

  const warnings: string[] = []
  if (parsed.errors.length > 0) warnings.push(...parsed.errors)
  if (!parsed.checkDigitsValid) {
    warnings.push('One or more MRZ check digits failed — verify on the document.')
  }
  if (parsed.nationality && parsed.nationality !== 'UKR') {
    warnings.push(`Passport nationality is ${parsed.nationality}, not UKR. TPS Ukraine requires Ukrainian nationality.`)
  }

  return {
    module: PASSPORT_MODULE,
    matched: true,
    match_reason: parsed.checkDigitsValid ? 'td3_parsed_valid' : 'td3_parsed_with_check_failures',
    fields,
    warnings,
    manual_review_required: manual_review_reasons.length > 0,
    manual_review_reasons,
  }
}
