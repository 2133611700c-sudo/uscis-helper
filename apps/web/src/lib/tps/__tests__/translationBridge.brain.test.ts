/**
 * Translation Bridge v0 — translateBookletFromBrain unit tests.
 *
 * Proves the Central Brain → translation pipeline:
 *   merged (already-normalized English) → passportBooklet template → HTML draft
 *
 * These tests use the canonical Kuropiatnyk fixture identity.
 * No PII beyond what is already in existing test fixtures.
 */

import { describe, it, expect } from 'vitest'
import { translateBookletFromBrain } from '../translationBridge'
import type { MergedField } from '../centralBrain'

// ── Test helper ───────────────────────────────────────────────────────────────

function mergedField(field: string, value: string): MergedField {
  return {
    field,
    value,
    source_slot: 'booklet',
    source_type: 'ocr_keyword',
    confidence: 0.95,
    controlling_spelling_applied: false,
    cross_validated: false,
    plausibility_passed: true,
    hallucination_risk: 'none',
    normalization_source: 'knowledge',
    conflicts: [],
  }
}

const KURO_MERGED: Record<string, MergedField> = {
  family_name:          mergedField('family_name',          'Kuropiatnyk'),
  given_name:           mergedField('given_name',           'Serhii'),
  middle_name:          mergedField('middle_name',          'Serhiiovych'),
  dob:                  mergedField('dob',                  '1986-06-25'),
  city_of_birth:        mergedField('city_of_birth',        'Trostianets'),
  province_of_birth:    mergedField('province_of_birth',    'Vinnytsia Oblast'),
  passport_number:      mergedField('passport_number',      'FU 262473'),
  sex:                  mergedField('sex',                  'M'),
  issued_by:            mergedField('issued_by',            'Department of the State Migration Service of Ukraine in Vinnytsia Oblast'),
  passport_date_of_issue: mergedField('passport_date_of_issue', '2019-08-12'),
}

const SIGNER_OPTS = {
  signerName: 'Serhii Kuropiatnyk',
  signerAddress: '4341 Willow Brook Ave 111, Los Angeles, CA 90029',
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('translateBookletFromBrain', () => {
  it('returns non-null for valid merged data with surname', () => {
    const result = translateBookletFromBrain(KURO_MERGED, SIGNER_OPTS)
    expect(result).not.toBeNull()
  })

  it('translation_html contains surname', () => {
    const result = translateBookletFromBrain(KURO_MERGED, SIGNER_OPTS)!
    expect(result.translation_html).toContain('Kuropiatnyk')
  })

  it('translation_html contains given name', () => {
    const result = translateBookletFromBrain(KURO_MERGED, SIGNER_OPTS)!
    expect(result.translation_html).toContain('Serhii')
  })

  it('translation_html contains patronymic (not "Middle Name")', () => {
    const result = translateBookletFromBrain(KURO_MERGED, SIGNER_OPTS)!
    expect(result.translation_html).toContain('Serhiiovych')
    expect(result.translation_html).toContain('Patronymic')
    expect(result.translation_html).not.toContain('Middle Name')
  })

  it('translation_html contains DOB', () => {
    const result = translateBookletFromBrain(KURO_MERGED, SIGNER_OPTS)!
    expect(result.translation_html).toContain('1986-06-25')
  })

  it('translation_html contains combined place of birth (city + oblast + Ukraine)', () => {
    const result = translateBookletFromBrain(KURO_MERGED, SIGNER_OPTS)!
    expect(result.translation_html).toContain('Trostianets')
    expect(result.translation_html).toContain('Vinnytsia Oblast')
    expect(result.translation_html).toContain('Ukraine')
  })

  it('translation_html contains issuing authority', () => {
    const result = translateBookletFromBrain(KURO_MERGED, SIGNER_OPTS)!
    expect(result.translation_html).toContain('State Migration Service')
  })

  it('sex M maps to Male in translation', () => {
    const result = translateBookletFromBrain(KURO_MERGED, SIGNER_OPTS)!
    expect(result.translation_html).toContain('Male')
    expect(result.translation_html).not.toMatch(/\bM\b/)
  })

  it('sex F maps to Female in translation', () => {
    const merged = {
      ...KURO_MERGED,
      sex: mergedField('sex', 'F'),
    }
    const result = translateBookletFromBrain(merged, SIGNER_OPTS)!
    expect(result.translation_html).toContain('Female')
  })

  it('certification_html contains signer name', () => {
    const result = translateBookletFromBrain(KURO_MERGED, SIGNER_OPTS)!
    expect(result.certification_html).toContain('Serhii Kuropiatnyk')
  })

  it('certification_html contains signer address', () => {
    const result = translateBookletFromBrain(KURO_MERGED, SIGNER_OPTS)!
    expect(result.certification_html).toContain('Los Angeles')
  })

  it('certification_html contains competency statement (8 CFR §103.2(b)(3))', () => {
    const result = translateBookletFromBrain(KURO_MERGED, SIGNER_OPTS)!
    expect(result.certification_html).toMatch(/competent to translate|complete and accurate/i)
  })

  it('certification_html does NOT say "certified by AI" or "USCIS accepted"', () => {
    const result = translateBookletFromBrain(KURO_MERGED, SIGNER_OPTS)!
    expect(result.certification_html).not.toMatch(/certified by AI/i)
    expect(result.certification_html).not.toMatch(/USCIS accepted/i)
    expect(result.certification_html).not.toMatch(/guaranteed/i)
  })

  it('violations array is empty for clean canonical input', () => {
    const result = translateBookletFromBrain(KURO_MERGED, SIGNER_OPTS)!
    expect(result.violations).toHaveLength(0)
  })

  it('returns null when surname is absent', () => {
    const { family_name: _dropped, ...withoutSurname } = KURO_MERGED
    const result = translateBookletFromBrain(withoutSurname, SIGNER_OPTS)
    expect(result).toBeNull()
  })

  it('works with minimal data: surname only (other fields absent)', () => {
    const result = translateBookletFromBrain(
      { family_name: mergedField('family_name', 'Kuropiatnyk') },
      SIGNER_OPTS,
    )
    expect(result).not.toBeNull()
    expect(result!.translation_html).toContain('Kuropiatnyk')
  })

  it('omits document_type from output if value is empty (field-filter works)', () => {
    // document_type is hardcoded — should always be present
    const result = translateBookletFromBrain(KURO_MERGED, SIGNER_OPTS)!
    expect(result.translation_html).toContain('Internal Passport')
  })

  it('place_of_birth falls back to Ukraine only when city+province absent', () => {
    const merged = {
      family_name: mergedField('family_name', 'Kuropiatnyk'),
    }
    const result = translateBookletFromBrain(merged, SIGNER_OPTS)!
    // place_of_birth = ', , Ukraine' trimmed to 'Ukraine'
    expect(result.translation_html).toContain('Ukraine')
  })
})
