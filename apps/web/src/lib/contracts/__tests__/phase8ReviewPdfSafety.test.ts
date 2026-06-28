/**
 * Phase 8 — review states + raw→PDF safety.
 *
 * Proves:
 *  - contractReviewState maps every field to exactly one of the 6 states;
 *  - critical handwritten contract fields are ALWAYS review-required;
 *  - shouldBlockRawPdfFallback is OFF→false (raw fallback unchanged) and
 *    ON→true for the contract certificate (raw generic PDF closed).
 *
 * Pure-function tests; fictional data only.
 */
import { describe, it, expect } from 'vitest'
import {
  contractReviewState,
  mustAlwaysReview,
  alwaysReviewRuntimeKeys,
  shouldBlockRawPdfFallback,
} from '../contractReviewState'

const OFF = {} as Record<string, string | undefined>
const ON = { UNIFIED_DOC_CONTRACT_ENABLED: '1' } as Record<string, string | undefined>

describe('Phase 8 — contractReviewState', () => {
  it('not_applicable wins', () => {
    expect(contractReviewState({ not_applicable: true, value: 'x' })).toBe('not_applicable')
  })
  it('conflict from review_reasons', () => {
    expect(contractReviewState({ review_reasons: ['conflict'], value: 'x' })).toBe('conflict')
  })
  it('confirmed', () => {
    expect(contractReviewState({ confirmed: true, value: 'Ivanenko' })).toBe('confirmed')
  })
  it('missing — nothing read', () => {
    expect(contractReviewState({ value: '', raw_cyrillic: '' })).toBe('missing')
  })
  it('unreadable — raw present, no releasable value', () => {
    expect(contractReviewState({ value: '', raw_cyrillic: 'Іваненко' })).toBe('unreadable')
  })
  it('candidate — has value, pending confirmation', () => {
    expect(contractReviewState({ value: 'Ivanenko', raw_cyrillic: 'Іваненко' })).toBe('candidate')
  })
})

describe('Phase 8 — critical handwritten → always review', () => {
  it('child name fields (runtimeKey + legacy read key) must always review', () => {
    expect(mustAlwaysReview('family_name')).toBe(true)
    expect(mustAlwaysReview('child_family_name')).toBe(true) // legacy read-side key
    expect(mustAlwaysReview('date_of_birth')).toBe(true)
    expect(mustAlwaysReview('act_record_number')).toBe(true)
  })
  it('the always-review set includes all critical handwritten contract fields', () => {
    const keys = alwaysReviewRuntimeKeys()
    for (const k of ['family_name', 'given_name', 'patronymic', 'date_of_birth', 'act_record_number']) {
      expect(keys).toContain(k)
    }
  })
  it('unknown field → not forced', () => {
    expect(mustAlwaysReview('totally_unknown_field')).toBe(false)
  })
})

describe('Phase 8 — raw→PDF closure', () => {
  it('OFF → never blocks (raw fallback unchanged)', () => {
    expect(shouldBlockRawPdfFallback('ua_birth_certificate', OFF)).toBe(false)
  })
  it('ON → blocks raw generic PDF for the contract certificate', () => {
    expect(shouldBlockRawPdfFallback('ua_birth_certificate', ON)).toBe(true)
  })
  it('ON → does NOT block unrelated doc types', () => {
    expect(shouldBlockRawPdfFallback('ua_international_passport', ON)).toBe(false)
    expect(shouldBlockRawPdfFallback(null, ON)).toBe(false)
  })
})
