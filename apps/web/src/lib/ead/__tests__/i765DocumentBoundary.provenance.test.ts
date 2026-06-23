import { describe, it, expect } from 'vitest'
import { eadDocumentFactsToCanonical } from '../i765DocumentBoundary'
import type { EadFieldData } from '../i765FieldMap'
import { getCanonicalValue } from '@/lib/canonical/core/fieldAccessor'

const SAMPLE: EadFieldData = {
  appType: 'new',
  category: 'c11',
  firstName: 'Olena',
  lastName: 'Testenko',
  middleName: 'Petrivna',
  dob: '1985-06-25',
  countryOfBirth: 'Ukraine',
  alienNumber: 'A123456789',
  gender: 'female',
  usAddress: '1213 Gordon St, Los Angeles, CA 90038',
}

describe('EAD i765DocumentBoundary — U-STAGE 4 provenance fix', () => {
  const result = eadDocumentFactsToCanonical(SAMPLE)

  it('marks hand-typed wizard input as manual_user_entry (NOT faked document_ocr)', () => {
    for (const f of result.fields) {
      expect(f.source).toBe('manual_user_entry')
    }
  })

  it('does NOT stamp synthetic OCR confidence (final 0, not 1)', () => {
    for (const f of result.fields) {
      expect(f.confidence.final).toBe(0)
    }
  })

  it('released values are byte-identical to the typed input (PDF output unchanged)', () => {
    const byKey = Object.fromEntries(result.fields.map((f) => [f.key, getCanonicalValue(f)]))
    expect(byKey.family_name).toBe('Testenko')
    expect(byKey.given_name).toBe('Olena')
    expect(byKey.middle_name).toBe('Petrivna')
    expect(byKey.date_of_birth).toBe('1985-06-25')
    expect(byKey.sex).toBe('F')
    expect(byKey.country_of_birth).toBe('Ukraine')
    expect(byKey.a_number).toBe('A123456789')
  })
})
