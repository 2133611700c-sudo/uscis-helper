/**
 * Regression tests for the strict shape validator added in the
 * 2026-05-21 FIX_TPS_PASSPORT_MRZ_REAL_DOCUMENT_FAILURE audit.
 *
 * The motivating real-world failure: another person's Ukrainian booklet
 * uploaded, DOB row surfaced "Date of birth 13 CEP / AUG 60" as the
 * final value because backend emitted raw_value with normalized_value=null.
 * After this fix, garbage like that is REJECTED at the wizard intake
 * boundary and the user sees "Не найдено — введите вручную".
 */
import { describe, it, expect } from 'vitest'
import { isStrictValidValue } from '../strictValidators'

describe('isStrictValidValue — dob', () => {
  it('accepts valid ISO YYYY-MM-DD', () => {
    expect(isStrictValidValue('dob', '1986-06-25')).toBe(true)
    expect(isStrictValidValue('dob', '1960-08-13')).toBe(true)
    expect(isStrictValidValue('dob', '2000-01-01')).toBe(true)
    expect(isStrictValidValue('dob', '2099-12-31')).toBe(true)
  })

  it('REJECTS raw OCR garbage that prompted this fix', () => {
    expect(isStrictValidValue('dob', 'Date of birth 13 CEP / AUG 60')).toBe(false)
    expect(isStrictValidValue('dob', '13 CEP / AUG 60')).toBe(false)
    expect(isStrictValidValue('dob', '25 червня 1986')).toBe(false)
    expect(isStrictValidValue('dob', '25.06.1986')).toBe(false) // not ISO yet
  })

  it('rejects bogus dates that pass shape but are obviously wrong', () => {
    expect(isStrictValidValue('dob', '1986-13-25')).toBe(false) // month 13
    expect(isStrictValidValue('dob', '1986-02-32')).toBe(false) // day 32
    expect(isStrictValidValue('dob', '1800-01-01')).toBe(false) // year too low
    expect(isStrictValidValue('dob', '')).toBe(false)
  })

  it('applies same rule to all canonical-date fields', () => {
    for (const field of ['last_entry_date', 'i94_admit_until', 'passport_expiration_date', 'ead_expiration_date']) {
      expect(isStrictValidValue(field, '2026-09-07')).toBe(true)
      expect(isStrictValidValue(field, 'Some text')).toBe(false)
    }
  })
})

describe('isStrictValidValue — sex', () => {
  it('accepts M, F, X', () => {
    expect(isStrictValidValue('sex', 'M')).toBe(true)
    expect(isStrictValidValue('sex', 'F')).toBe(true)
    expect(isStrictValidValue('sex', 'X')).toBe(true)
  })

  it('rejects raw OCR text or full words', () => {
    expect(isStrictValidValue('sex', 'Male')).toBe(false)
    expect(isStrictValidValue('sex', 'мужской')).toBe(false)
    expect(isStrictValidValue('sex', 'm')).toBe(false) // lowercase
    expect(isStrictValidValue('sex', 'M F')).toBe(false)
  })
})

describe('isStrictValidValue — passport_number', () => {
  it('accepts Ukrainian international + booklet formats', () => {
    expect(isStrictValidValue('passport_number', 'FU262473')).toBe(true)
    expect(isStrictValidValue('passport_number', 'EK 790396')).toBe(true)
    expect(isStrictValidValue('passport_number', 'AB1234567')).toBe(true)
  })

  it('rejects raw OCR garbage masquerading as a passport number', () => {
    expect(isStrictValidValue('passport_number', 'Passport No: FU262473')).toBe(false)
    expect(isStrictValidValue('passport_number', '123')).toBe(false) // too short
    expect(isStrictValidValue('passport_number', 'FU 262 473 extra')).toBe(false)
    expect(isStrictValidValue('passport_number', 'just-text')).toBe(false)
  })
})

describe('isStrictValidValue — a_number', () => {
  it('accepts 9 digits with or without separators', () => {
    expect(isStrictValidValue('a_number', '231853474')).toBe(true)
    expect(isStrictValidValue('a_number', '231-853-474')).toBe(true)
    expect(isStrictValidValue('a_number', '231 853 474')).toBe(true)
  })

  it('rejects wrong length / non-digit garbage', () => {
    expect(isStrictValidValue('a_number', '12345678')).toBe(false) // 8 digits
    expect(isStrictValidValue('a_number', '1234567890')).toBe(false) // 10 digits
    expect(isStrictValidValue('a_number', 'A123456789')).toBe(false) // letter
  })
})

describe('isStrictValidValue — us_address_state, us_address_zip', () => {
  it('accepts 2-letter state and 5/9-digit zip', () => {
    expect(isStrictValidValue('us_address_state', 'CA')).toBe(true)
    expect(isStrictValidValue('us_address_state', 'NY')).toBe(true)
    expect(isStrictValidValue('us_address_zip', '90029')).toBe(true)
    expect(isStrictValidValue('us_address_zip', '90029-1234')).toBe(true)
  })

  it('rejects malformed state / zip', () => {
    expect(isStrictValidValue('us_address_state', 'California')).toBe(false)
    expect(isStrictValidValue('us_address_state', 'C')).toBe(false)
    expect(isStrictValidValue('us_address_zip', '9002')).toBe(false)
    expect(isStrictValidValue('us_address_zip', 'ABCDE')).toBe(false)
  })
})

describe('isStrictValidValue — unknown fields pass through', () => {
  it('returns true for any value on fields without a rule', () => {
    expect(isStrictValidValue('family_name', "О'Коннор")).toBe(true)
    expect(isStrictValidValue('us_address_street', '4341 Willow Brook Ave 111')).toBe(true)
    expect(isStrictValidValue('us_address_city', 'Los Angeles')).toBe(true)
    expect(isStrictValidValue('i94_admission_number', '039622651A3')).toBe(true)
  })

  it('rejects empty value regardless of field', () => {
    expect(isStrictValidValue('family_name', '')).toBe(false)
    expect(isStrictValidValue('family_name', '   ')).toBe(false)
  })
})
