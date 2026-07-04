/**
 * postExtractRulePack — Phase 8 step 1. FICTIONAL data only.
 * Pins: signal evaluation NEVER mutates the input; signals are byte-parity with the live
 * in-place writer (same code by construction — the differ proves the harness itself);
 * strict flag; keys-only diff output.
 */
import { describe, it, expect } from 'vitest'
import {
  evaluatePostExtractPack,
  isNormalizeCollapseShadowEnabled,
  runNormalizeCollapseShadow,
} from '../postExtractRulePack'
import { postExtractNormalize } from '../postExtractNormalize'
import type { TpsExtractedField } from '@/lib/tps/types'

const f = (field: string, raw: string, normalized: string | null): TpsExtractedField => ({
  field,
  raw_value: raw,
  normalized_value: normalized,
  extraction_source: 'document_ai' as TpsExtractedField['extraction_source'],
  source_document_id: 'fictional_doc',
  source_zone: 'visual',
  bbox: null,
  confidence: 0.9,
  review_required: false,
  passes: [],
  failures: [],
} as unknown as TpsExtractedField)

const FIXTURE = (): TpsExtractedField[] => [
  f('family_name', 'Тестенко', 'Тестенко'),                    // → KMU-55
  f('province_of_birth', 'Вінницької області', 'VINNYTSKA OBL.'), // → nominative oblast
  f('city_of_birth', 'BiRHEROI odwaemi', 'BiRHEROI odwaemi'),   // → garbage reject
  f('dob', '01/25/1990', '01/25/1990'),                          // → US→ISO
  f('a_number', 'A123456789', 'A123456789'),                     // → passed (no rule)
]

describe('isNormalizeCollapseShadowEnabled — strict flag', () => {
  it("only '1' enables", () => {
    expect(isNormalizeCollapseShadowEnabled({})).toBe(false)
    expect(isNormalizeCollapseShadowEnabled({ NORMALIZE_COLLAPSE_SHADOW: 'true' })).toBe(false)
    expect(isNormalizeCollapseShadowEnabled({ NORMALIZE_COLLAPSE_SHADOW: '1' })).toBe(true)
  })
})

describe('evaluatePostExtractPack — signal-only', () => {
  it('NEVER mutates the caller fields (deep clone inside)', () => {
    const fields = FIXTURE()
    const before = JSON.stringify(fields)
    evaluatePostExtractPack(fields)
    expect(JSON.stringify(fields)).toBe(before)
  })

  it('signals mirror the live writer: normalize/reject/pass per field', () => {
    const signals = evaluatePostExtractPack(FIXTURE())
    const byKey = Object.fromEntries(signals.map((s) => [s.field, s]))
    expect(byKey.family_name.status).toBe('normalized')
    expect(byKey.family_name.suggestedValue).toBe('Testenko')
    expect(byKey.province_of_birth.status).toBe('normalized')
    expect(byKey.province_of_birth.suggestedValue).toBe('Vinnytsia Oblast')
    expect(byKey.city_of_birth.status).toBe('rejected')
    expect(byKey.city_of_birth.reviewRequired).toBe(true)
    expect(byKey.a_number.status).toBe('passed')
  })
})

describe('runNormalizeCollapseShadow — flip evidence differ', () => {
  it('rule-pack vs live writer on the SAME fixture → zero diff (parity by construction)', () => {
    const fields = FIXTURE()
    const signals = evaluatePostExtractPack(fields)
    const live = postExtractNormalize(fields) // mutates fields in place — the live behavior
    const diff = runNormalizeCollapseShadow(signals, fields, live.rejected_fields)
    expect(diff.match).toBe(true)
    expect(diff.value_diff_keys).toEqual([])
    expect(diff.reject_diff_keys).toEqual([])
  })

  it('a divergent signal is caught, keys-only in the output', () => {
    const fields = FIXTURE()
    const signals = evaluatePostExtractPack(fields)
    const live = postExtractNormalize(fields)
    // simulate drift: the pack would suggest something else for family_name
    const drifted = signals.map((s) => (s.field === 'family_name' ? { ...s, suggestedValue: 'Different' } : s))
    const diff = runNormalizeCollapseShadow(drifted, fields, live.rejected_fields)
    expect(diff.match).toBe(false)
    expect(diff.value_diff_keys).toEqual(['family_name'])
    expect(JSON.stringify(diff)).not.toContain('Testenko') // no values leak
  })
})
