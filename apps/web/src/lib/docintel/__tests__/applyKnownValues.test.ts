/**
 * applyKnownValues.test.ts — FREE-FIRST cost ordering. An empty field is filled from a known sibling
 * value at $0 (held for review), so the paid hi-res tile recovery is NOT spent on it. A read field is
 * never overwritten. This is the cost-efficiency rule: free deterministic fill before any LLM call.
 */
import { describe, it, expect } from 'vitest'
import { applyKnownValues } from '../documentFieldReader'
import type { ExtractedDocField } from '../types'

const field = (p: Partial<ExtractedDocField> & { field: string }): ExtractedDocField => ({
  kind: 'name', raw_cyrillic: null, value: null, confidence: 0, review_required: false,
  source: 'vision', provider: 'stub', ...p,
})
const isEmpty = (f: ExtractedDocField) => (f.value ?? '').trim() === '' && (f.raw_cyrillic ?? '').trim() === ''

describe('applyKnownValues (free-first fill)', () => {
  it('fills an EMPTY field from the sibling value, held for review', () => {
    const { fields, filled } = applyKnownValues(
      [field({ field: 'dob', value: '', raw_cyrillic: '' })],
      { dob: '1990-01-15' },
    )
    expect(filled).toBe(1)
    const dob = fields[0]
    expect(dob.raw_cyrillic).toBe('1990-01-15')
    expect(dob.review_required).toBe(true)
    expect(dob.review_reasons).toContain('known_from_sibling')
  })

  it('NEVER overwrites a field the model already read', () => {
    const { fields, filled } = applyKnownValues(
      [field({ field: 'given_name', value: 'ANDRII', raw_cyrillic: 'Андрій', review_required: false })],
      { given_name: 'WRONG' },
    )
    expect(filled).toBe(0)
    expect(fields[0].value).toBe('ANDRII')
    expect(fields[0].review_required).toBe(false)
  })

  it('a field NOT in knownValues stays empty (paid recovery may still pursue it)', () => {
    const { fields, filled } = applyKnownValues(
      [field({ field: 'father_full_name', value: '', raw_cyrillic: '' })],
      { dob: '1990-01-15' },
    )
    expect(filled).toBe(0)
    expect(isEmpty(fields[0])).toBe(true)
  })

  it('empty/blank known value ⇒ no fill (never blanks or fakes)', () => {
    const { filled } = applyKnownValues([field({ field: 'dob', value: '', raw_cyrillic: '' })], { dob: '  ' })
    expect(filled).toBe(0)
  })
})
