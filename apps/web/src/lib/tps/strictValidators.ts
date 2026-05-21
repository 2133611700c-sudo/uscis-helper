/**
 * Strict canonical-shape validators for OCR-derived TPS fields.
 *
 * Reason: the OCR pipeline (Google Vision + module parsers + AI brain)
 * occasionally emits a field whose value is RAW OCR TEXT instead of the
 * normalized shape the wizard / PDF mappers expect. Example caught in
 * the 2026-05-21 FIX_TPS_PASSPORT_MRZ_REAL_DOCUMENT_FAILURE audit:
 * the booklet module returned dob with normalized_value=null and
 * raw_value="Date of birth 13 CEP / AUG 60" — the wizard fell back to
 * raw_value and surfaced that garbage as the user's DOB.
 *
 * This module enforces a single contract: if a value does NOT match the
 * canonical shape for that field, it MUST NOT enter the wizard state.
 * The review screen will then show "Не найдено — введите вручную" so
 * the user types the correct value by hand. No silent guessing.
 *
 * Keep the validators conservative — when in doubt, REJECT. A false
 * negative (rejecting a real-but-weird value) is cheap (user fills the
 * field manually). A false positive (accepting garbage) is expensive
 * (USCIS receives wrong data, packet returned or fee retained).
 */

/** YYYY-MM-DD with month 01-12 and day 01-31. Year 1900-2099. */
const DATE_ISO_RE = /^(19|20)\d{2}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/

/** Single letter M, F or X (ICAO 9303 sex codes). */
const SEX_RE = /^[MFX]$/

/**
 * Passport number: 1-3 letters followed by 6-9 digits, optionally with
 * a single space between the letter prefix and the digits.
 *   FU262473        — Ukrainian international (TD3)
 *   EK 790396       — Ukrainian internal-booklet perforation
 *   AB1234567       — generic
 * MRZ canonical form has no space; the visible passport surface may.
 */
const PASSPORT_NUMBER_RE = /^[A-Z]{1,3}\s?[0-9]{6,9}$/

/** A-number: 9 digits. Often shown with dashes (231-853-474) — strip first. */
const A_NUMBER_RE = /^\d{9}$/

/**
 * 5-digit US ZIP, optionally with +4 extension.
 */
const ZIP_RE = /^\d{5}(?:-\d{4})?$/

/**
 * 2-letter USPS state code (uppercase).
 */
const US_STATE_RE = /^[A-Z]{2}$/

/**
 * Returns true if `value` is the canonical shape we accept for `field`,
 * or if the field has no strict shape rule (in which case it passes
 * through unchanged). Untrimmed input — caller is responsible for
 * stripping incidental whitespace before calling.
 *
 * The list is intentionally small: only fields whose ground-truth shape
 * is unambiguous. Names, addresses, "given names with middle bits",
 * country names etc. are deliberately NOT validated here because they
 * legitimately have many shapes.
 */
export function isStrictValidValue(field: string, rawValue: string): boolean {
  const value = rawValue.trim()
  if (!value) return false

  switch (field) {
    case 'dob':
    case 'last_entry_date':
    case 'i94_admit_until':
    case 'passport_expiration_date':
    case 'ead_expiration_date':
      return DATE_ISO_RE.test(value)

    case 'sex':
      return SEX_RE.test(value)

    case 'passport_number':
      return PASSPORT_NUMBER_RE.test(value.toUpperCase())

    case 'a_number':
      // Strip dashes/spaces, then 9 digits.
      return A_NUMBER_RE.test(value.replace(/[\s\-]/g, ''))

    case 'us_address_zip':
      return ZIP_RE.test(value)

    case 'us_address_state':
      return US_STATE_RE.test(value.toUpperCase())

    default:
      // No strict rule — accept the value as-is. We only enforce shapes
      // where the canonical form is well-defined and a misread is more
      // costly than asking the user to type it.
      return true
  }
}
