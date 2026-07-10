/**
 * c3.test.ts — Phase 6 C3 writer contract. Pure.
 */
import { describe, it, expect } from 'vitest'
import { validateC3Input, writeCanonical, type C3Input } from '../c3'

const base = (fields: C3Input['fields']): C3Input => ({
  docTypeId: 'passport', fields, documentSessionId: 's1', service: 'translation', requiresReview: false,
})

describe('validateC3Input — refuses non-canonical input', () => {
  it('a finalValue without evidence/source is a violation (no raw provider result as final)', () => {
    const v = validateC3Input(base([{ key: 'surname', finalValue: 'X', reviewRequired: false, evidence: [], source: null }]))
    expect(v.length).toBeGreaterThan(0)
  })
  it('a properly-sourced final value passes', () => {
    const v = validateC3Input(base([{ key: 'surname', finalValue: 'X', reviewRequired: false, source: 'mrz', evidence: [{ source: 'mrz', provider: 'openai' }] }]))
    expect(v).toEqual([])
  })
  it('no finalValue (held) ⇒ no violation', () => {
    expect(validateC3Input(base([{ key: 'dob', reviewRequired: true, reviewReasons: ['handwriting_present'] }]))).toEqual([])
  })
})

describe('writeCanonical — service presents, never invents', () => {
  it('releases a valid sourced final value + carries no review', () => {
    const out = writeCanonical(base([{ key: 'passport_number', finalValue: 'AB123456', reviewRequired: false, source: 'mrz', evidence: [{ source: 'mrz', provider: 'openai' }] }]))
    expect(out.fields[0].value).toBe('AB123456')
    expect(out.fields[0].reviewRequired).toBe(false)
    expect(out.requiresReview).toBe(false)
  })
  it('held field (null final, reviewRequired) → value null + review', () => {
    const out = writeCanonical(base([{ key: 'surname', finalValue: null, reviewRequired: true, reviewReasons: ['handwriting_present'] }]))
    expect(out.fields[0].value).toBeNull()
    expect(out.fields[0].reviewRequired).toBe(true)
    expect(out.reviewRequiredFields).toContain('surname')
    expect(out.requiresReview).toBe(true)
  })
  it('an invalid (unsourced) final value is FORCED to null + review (never released)', () => {
    const out = writeCanonical(base([{ key: 'surname', finalValue: 'GHOST', reviewRequired: false, evidence: [], source: null }]))
    expect(out.fields[0].value).toBeNull() // refused
    expect(out.fields[0].reviewRequired).toBe(true)
    expect(out.fields[0].reviewReasons).toContain('c3_input_invalid')
  })
  it('whole-doc requiresReview propagates', () => {
    const out = writeCanonical({ ...base([{ key: 'x', finalValue: 'v', reviewRequired: false, source: 'ocr', evidence: [{ source: 'ocr', provider: 'gemini' }] }]), requiresReview: true })
    expect(out.requiresReview).toBe(true)
  })
})
