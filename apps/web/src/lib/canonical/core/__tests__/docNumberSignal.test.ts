/**
 * ONE-BRAIN v2 Phase 6b — docNumberFormats wired as an evaluator SIGNAL.
 * The dictionary previously had ZERO consumers (the EAD product didn't use the EAD-category
 * dictionary). This pins: pure signal, review-monotonic-up, silent on unmapped keys.
 * FICTIONAL numbers only.
 */
import { describe, it, expect } from 'vitest'
import { evaluateDocNumberSignal } from '../knowledgeEvaluator'

describe('evaluateDocNumberSignal — dead dictionary now a live signal', () => {
  it('valid UA international passport number → valid, no review', () => {
    const s = evaluateDocNumberSignal('passport_number', 'AB123456')
    expect(s.status).toBe('valid')
    expect(s.reviewRequired).toBe(false)
  })

  it('invalid passport format → invalid + review-monotonic-up', () => {
    const s = evaluateDocNumberSignal('passport_number', '???')
    expect(s.status).toBe('invalid')
    expect(s.reviewRequired).toBe(true)
    expect(s.reason).toBeTruthy()
  })

  it('EAD category: valid code gets its human meaning (C11)', () => {
    const s = evaluateDocNumberSignal('ead_category', 'C11')
    expect(s.status).toBe('valid')
    expect(s.categoryMeaning).toBeTruthy()
  })

  it('unknown EAD category → invalid format or no meaning, review up', () => {
    const s = evaluateDocNumberSignal('ead_category', 'Z99X')
    expect(s.reviewRequired).toBe(s.status === 'invalid')
    expect(s.categoryMeaning).toBeNull()
  })

  it('I-94 admission number: 11 digits valid; short invalid', () => {
    expect(evaluateDocNumberSignal('i94_admission_number', '12345678901').status).toBe('valid')
    expect(evaluateDocNumberSignal('i94_admission_number', '123').status).toBe('invalid')
  })

  it('A-number valid/invalid', () => {
    expect(evaluateDocNumberSignal('a_number', 'A123456789').status).toBe('valid')
    expect(evaluateDocNumberSignal('a_number', 'B1').status).toBe('invalid')
  })

  it('unmapped keys are SILENT (no_rule, never review) — signal cannot touch non-number fields', () => {
    for (const k of ['family_name', 'place_of_birth', 'dob', 'unknown']) {
      const s = evaluateDocNumberSignal(k, 'anything')
      expect(s.status).toBe('no_rule')
      expect(s.reviewRequired).toBe(false)
    }
  })

  it('empty/null value on a mapped key → invalid (empty_or_non_string), review up', () => {
    const s = evaluateDocNumberSignal('passport_number', null)
    expect(s.status).toBe('invalid')
    expect(s.reviewRequired).toBe(true)
  })
})
