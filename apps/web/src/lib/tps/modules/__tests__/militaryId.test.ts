/**
 * Unit tests for Military ID extraction module.
 *
 * Tests:
 *   - Core identity field extraction from typical OCR text
 *   - review_required=true always
 *   - No immigration fields (I-94, A-number, EAD)
 *   - Service page does not overwrite identity page fields
 *   - Date parsing with Ukrainian month names
 *   - Serial number parsing
 */

import { describe, it, expect } from 'vitest'
import { extractMilitaryId, parseUkrainianDate, runMilitaryIdModule } from '../militaryId'

// Typical military ID identity page OCR text (from real document test)
const TYPICAL_IDENTITY_OCR = `ВІЙСЬКОВИЙ КВИТОК
Серія Со № 845621
REDACTED_NAME
Сергій
По батькові: Сергійович
25 червня 1986 р.
Тростянець
Виданий Тростянецьким РВК`

// Service page — should not contaminate identity fields
const SERVICE_PAGE_OCR = `Відомості про проходження служби
Дата призову: 15 жовтня 2005 р.
Частина: 34-а окрема бригада`

describe('extractMilitaryId', () => {
  it('extracts family_name from military ID raw text', () => {
    const result = extractMilitaryId(TYPICAL_IDENTITY_OCR)
    expect(result.family_name_cyrillic).toBe("REDACTED_NAME")
  })

  it('extracts given_name from military ID raw text', () => {
    const result = extractMilitaryId(TYPICAL_IDENTITY_OCR)
    expect(result.given_name_cyrillic).toBe('Сергій')
  })

  it('extracts patronymic from "По батькові" label', () => {
    const result = extractMilitaryId(TYPICAL_IDENTITY_OCR)
    expect(result.patronymic_cyrillic).toBe('Сергійович')
  })

  it('parses date_of_birth from Ukrainian month name format', () => {
    const result = extractMilitaryId(TYPICAL_IDENTITY_OCR)
    expect(result.date_of_birth).toBe('1986-06-25')
  })

  it('extracts military_id_number in Серія+№ format', () => {
    const result = extractMilitaryId(TYPICAL_IDENTITY_OCR)
    expect(result.military_id_number).toBe('Со 845621')
  })

  it('extracts military_id_series separately', () => {
    const result = extractMilitaryId(TYPICAL_IDENTITY_OCR)
    expect(result.military_id_series).toBe('Со')
  })

  it('review_required is always true', () => {
    const result = extractMilitaryId(TYPICAL_IDENTITY_OCR)
    expect(result.review_required).toBe(true)
  })

  it('review_required is true even for perfect OCR', () => {
    // Verify this is a hard constant, not computed from confidence
    const result = extractMilitaryId('ВІЙСЬКОВИЙ КВИТОК\nСерія АА № 123456\nПетренко\nВасиль\nПо батькові: Васильович\n01 січня 1990 р.')
    expect(result.review_required).toBe(true)
  })

  it('detects identity source page', () => {
    const result = extractMilitaryId(TYPICAL_IDENTITY_OCR)
    expect(result.source_page).toBe('identity')
  })

  it('detects service source page', () => {
    const result = extractMilitaryId(SERVICE_PAGE_OCR)
    expect(result.source_page).toBe('service')
  })
})

describe('extractMilitaryId — immigration fields must not be populated', () => {
  it('does not populate i94_admission_number from military ID', () => {
    // Verify by checking TpsModuleResult from runMilitaryIdModule
    const result = runMilitaryIdModule(
      { raw_text: TYPICAL_IDENTITY_OCR, lines: TYPICAL_IDENTITY_OCR.split('\n').filter(Boolean).map(t => ({ text: t })) },
      { document_id: 'test' }
    )
    const fieldNames = result.fields.map(f => f.field)
    expect(fieldNames).not.toContain('i94_admission_number')
    expect(fieldNames).not.toContain('a_number')
    expect(fieldNames).not.toContain('ead_category_on_card')
    expect(fieldNames).not.toContain('ead_expiration_date')
    expect(fieldNames).not.toContain('us_address_street')
  })

  it('all module fields have review_required=true', () => {
    const result = runMilitaryIdModule(
      { raw_text: TYPICAL_IDENTITY_OCR, lines: TYPICAL_IDENTITY_OCR.split('\n').filter(Boolean).map(t => ({ text: t })) },
      { document_id: 'test' }
    )
    for (const field of result.fields) {
      expect(field.review_required).toBe(true)
    }
  })

  it('module manual_review_required is always true', () => {
    const result = runMilitaryIdModule(
      { raw_text: TYPICAL_IDENTITY_OCR, lines: TYPICAL_IDENTITY_OCR.split('\n').filter(Boolean).map(t => ({ text: t })) },
      { document_id: 'test' }
    )
    expect(result.manual_review_required).toBe(true)
  })
})

describe('extractMilitaryId — service page does not overwrite identity fields', () => {
  it('service page OCR produces no family_name', () => {
    const result = extractMilitaryId(SERVICE_PAGE_OCR)
    // Service page has no identity fields — should not produce name fields
    expect(result.family_name_cyrillic).toBeNull()
    expect(result.given_name_cyrillic).toBeNull()
  })

  it('service page does not produce a date_of_birth (призову ≠ народження)', () => {
    // "15 жовтня 2005" is призову date not birth date
    const result = extractMilitaryId(SERVICE_PAGE_OCR)
    // Birth year 2005 is outside plausible range (< 1920 || > 2010 in birth-year filter)
    // so dob should be null
    expect(result.date_of_birth).toBeNull()
  })
})

describe('parseUkrainianDate', () => {
  it('parses written-out Ukrainian month', () => {
    expect(parseUkrainianDate('25 червня 1986 р.')).toBe('1986-06-25')
    expect(parseUkrainianDate('1 січня 2000 р.')).toBe('2000-01-01')
    expect(parseUkrainianDate('15 грудня 1975')).toBe('1975-12-15')
  })

  it('parses all 12 Ukrainian month names', () => {
    const months = [
      ['січня', '01'], ['лютого', '02'], ['березня', '03'], ['квітня', '04'],
      ['травня', '05'], ['червня', '06'], ['липня', '07'], ['серпня', '08'],
      ['вересня', '09'], ['жовтня', '10'], ['листопада', '11'], ['грудня', '12'],
    ]
    for (const [month, num] of months) {
      expect(parseUkrainianDate(`1 ${month} 1986`)).toBe(`1986-${num}-01`)
    }
  })

  it('parses numeric date formats', () => {
    expect(parseUkrainianDate('25.06.1986')).toBe('1986-06-25')
    expect(parseUkrainianDate('25/06/1986')).toBe('1986-06-25')
    expect(parseUkrainianDate('25-06-1986')).toBe('1986-06-25')
  })

  it('returns null for unparseable input', () => {
    expect(parseUkrainianDate('')).toBeNull()
    expect(parseUkrainianDate('not a date')).toBeNull()
    expect(parseUkrainianDate('ВІЙСЬКОВИЙ КВИТОК')).toBeNull()
  })

  it('rejects implausible months', () => {
    expect(parseUkrainianDate('31 тринадцятого 1986')).toBeNull() // no month match
  })
})
