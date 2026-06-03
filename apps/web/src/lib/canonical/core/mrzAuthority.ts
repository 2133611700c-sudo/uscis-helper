/**
 * canonical/core/mrzAuthority.ts — MRZ → FieldCandidate[] bridge.
 *
 * Wraps the packages/knowledge MRZ parser into the Core reader interface.
 * When a valid TD3 MRZ is found, produces FieldCandidate[] with source='mrz'
 * and mrzCheckValid=true so the Core arbitration gives MRZ authority over
 * the passport identity fields.
 *
 * Authority hierarchy (matches arbitration.ts PASSPORT_MRZ_FIELDS):
 *   MRZ valid (check digits pass) → wins over ai_vision / document_ocr
 *   MRZ found but invalid         → review_required=true, source='mrz', mrzCheckValid=false
 *   MRZ not found                 → returns empty array (no candidates injected)
 *
 * MRZ-controlled fields (when valid):
 *   passport_number, date_of_birth, sex, date_of_expiry,
 *   family_name, given_name, nationality
 *
 * MRZ NEVER populates (hard rule — do not touch):
 *   i94_admission_number, i94_date_of_entry, i94_class_of_admission,
 *   a_number, ead_category, us_address, patronymic,
 *   place_of_birth, issuing_authority, eligibility
 */
import { parseMrz } from '@uscis-helper/knowledge'
import type { FieldCandidate } from './types'

// ---------------------------------------------------------------------------
// Fields that MRZ is authoritative for (must match arbitration.ts PASSPORT_MRZ_FIELDS)
// ---------------------------------------------------------------------------

export const MRZ_CONTROLLED_FIELDS = [
  'passport_number',
  'date_of_birth',
  'sex',
  'date_of_expiry',
  'family_name',
  'given_name',
  'nationality',
] as const

export type MrzControlledField = (typeof MRZ_CONTROLLED_FIELDS)[number]

// ---------------------------------------------------------------------------
// Fields MRZ is FORBIDDEN to populate — never add to this module
// ---------------------------------------------------------------------------

export const MRZ_FORBIDDEN_FIELDS = [
  'i94_admission_number',
  'i94_date_of_entry',
  'i94_class_of_admission',
  'a_number',
  'ead_category',
  'us_address',
  'patronymic',
  'place_of_birth',
  'issuing_authority',
  'eligibility',
] as const

// ---------------------------------------------------------------------------
// MRZ → FieldCandidate[] conversion
// ---------------------------------------------------------------------------

/**
 * Parse MRZ from raw OCR text and emit FieldCandidate[] for the Core.
 *
 * - Valid MRZ (check digits pass)  → candidates with mrzCheckValid=true, confidence=0.99
 * - Invalid MRZ (bad check digits) → candidates with mrzCheckValid=false, confidence=0.3,
 *                                     reviewRequired=true
 * - MRZ not found                  → empty array (Core sees no MRZ candidates)
 *
 * The caller must pass `rawText` which is the full OCR output for the page
 * (typically Vision API fullTextAnnotation or Gemini text).
 */
export function mrzCandidatesFromText(rawText: string): FieldCandidate[] {
  const mrz = parseMrz(rawText)

  // MRZ not found — no candidates injected. Core falls through to visual candidates.
  if (!mrz.ok && !mrz.surname && !mrz.passport_no) {
    return []
  }

  // Any check digit failed → present the values as candidates but force review.
  // The Core arbitration will also flag mrz_check_failed (see arbitration.ts).
  const allChecksPass = mrz.checks.passport_no && mrz.checks.dob && mrz.checks.expiry
  const mrzCheckValid = allChecksPass
  const confidence = allChecksPass ? 0.99 : 0.3
  const reviewRequired = !allChecksPass
  const reviewReasons: string[] = reviewRequired ? ['mrz_check_failed'] : []

  const candidates: FieldCandidate[] = []

  function push(key: MrzControlledField, value: string | null | undefined): void {
    if (!value || value.trim() === '') return
    candidates.push({
      key,
      value: value.trim(),
      source: 'mrz',
      confidence,
      mrzCheckValid,
      provider: 'mrz_authority',
      reviewRequired,
      reviewReasons,
    })
  }

  push('passport_number', mrz.passport_no || null)
  push('date_of_birth', mrz.date_of_birth)
  push('date_of_expiry', mrz.expiry)
  push('family_name', mrz.surname || null)
  push('given_name', mrz.given_names || null)
  push('nationality', mrz.nationality || null)

  // Sex: MRZ uses 'X' for unspecified ('<'); only emit M or F as real values.
  if (mrz.sex === 'M' || mrz.sex === 'F') {
    push('sex', mrz.sex)
  }

  return candidates
}

/**
 * The mrzRead reader — injected as CoreReaders.mrzRead.
 *
 * Accepts a raw OCR text string (the `file` param) rather than image bytes,
 * because MRZ parsing works on the text output of the OCR stage, not the image.
 * In production the caller must have already run OCR and pass the fullText here.
 *
 * Usage in readDocumentCore:
 *   readers.mrzRead = mrzReadFromOcrText
 *   req.expectMrz = true  (for international passport / ua_international_passport)
 */
export async function mrzReadFromOcrText(file: unknown): Promise<FieldCandidate[]> {
  const rawText = typeof file === 'string' ? file : ''
  return mrzCandidatesFromText(rawText)
}
