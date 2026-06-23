import { describe, it, expect } from 'vitest'
import { i131DocumentFactsToCanonical } from '../i131DocumentBoundary'
import type { ReParoleAnswers } from '../answers'
import { getCanonicalValue } from '@/lib/canonical/core/fieldAccessor'

const SAMPLE: ReParoleAnswers = {
  family_name: 'Testenko',
  given_name: 'Olena',
  middle_name: 'Petrivna',
  mailing_street: '1213 Gordon St',
  mailing_city: 'Los Angeles',
  mailing_state: 'CA',
  mailing_zip: '90038',
  a_number: '123456789',
  country_of_birth: 'Ukraine',
  country_of_nationality: 'Ukraine',
  sex: 'F',
  dob: '1985-06-25',
  daytime_phone: '3105551234',
  email: 'olena@example.com',
  filing_method: 'mail',
}

describe('Re-Parole i131DocumentBoundary — U-STAGE 4 provenance fix', () => {
  const result = i131DocumentFactsToCanonical(SAMPLE)

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
    expect(byKey.a_number).toBe('123456789')
    expect(byKey.country_of_birth).toBe('Ukraine')
    expect(byKey.date_of_birth).toBe('1985-06-25')
    expect(byKey.sex).toBe('F')
  })
})
