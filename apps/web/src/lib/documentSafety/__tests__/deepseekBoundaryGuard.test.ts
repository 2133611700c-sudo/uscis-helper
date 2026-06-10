/**
 * deepseekBoundaryGuard.test.ts — CHECKABLE LAW 7 enforcement.
 * The "bad" fixture (a DeepSeek-sourced field with a finalValue) MUST be caught;
 * this is the lint that was previously only a comment. Synthetic values only.
 */
import { describe, it, expect } from 'vitest'
import {
  isDeepSeekSource,
  findDeepSeekFinalViolations,
  assertNoDeepSeekFinal,
} from '../deepseekBoundaryGuard'

describe('isDeepSeekSource', () => {
  it('recognizes every DeepSeek provenance tag', () => {
    for (const s of ['ai_brain', 'dual_ocr_crossref', 'deepseek', 'deepseek-reasoner', 'ai_field_mapper']) {
      expect(isDeepSeekSource(s)).toBe(true)
    }
  })
  it('does not flag legitimate finalizable sources', () => {
    for (const s of ['mrz', 'passport_visual', 'ai_vision', 'manual_user_entry', 'gov_ua', undefined, null]) {
      expect(isDeepSeekSource(s)).toBe(false)
    }
  })
})

describe('findDeepSeekFinalViolations — the boundary holds', () => {
  it('GOOD: a DeepSeek-sourced field with finalValue=null is fine', () => {
    const v = findDeepSeekFinalViolations([{ field: 'notes', source: 'ai_brain', finalValue: null }])
    expect(v).toHaveLength(0)
  })
  it('GOOD: a non-DeepSeek source may finalize', () => {
    const v = findDeepSeekFinalViolations([{ field: 'dob', source: 'mrz', finalValue: '1990-05-14' }])
    expect(v).toHaveLength(0)
  })
})

describe('the BAD fixture is caught (the lint that used to be only a comment)', () => {
  // A field whose value came from DeepSeek but someone wrote it to finalValue — exactly
  // what LAW 7 forbids. The guard must catch it.
  const BAD = [{ field: 'given_name', source: 'ai_brain', finalValue: 'Ivan' }]

  it('findDeepSeekFinalViolations reports the violation', () => {
    const v = findDeepSeekFinalViolations(BAD)
    expect(v).toHaveLength(1)
    expect(v[0]).toEqual({ field: 'given_name', source: 'ai_brain' })
  })

  it('assertNoDeepSeekFinal THROWS on the bad fixture', () => {
    expect(() => assertNoDeepSeekFinal(BAD)).toThrow(/LAW 7 violation/)
  })

  it('assertNoDeepSeekFinal does NOT throw when the boundary holds', () => {
    expect(() => assertNoDeepSeekFinal([
      { field: 'notes', source: 'ai_brain', finalValue: null },
      { field: 'dob', source: 'mrz', finalValue: '1990-05-14' },
    ])).not.toThrow()
  })
})
