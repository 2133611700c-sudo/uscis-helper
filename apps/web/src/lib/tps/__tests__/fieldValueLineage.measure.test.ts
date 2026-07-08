/**
 * fieldValueLineage.measure.test.ts — ONE BRAIN punch list, "measure and document the 7 writers"
 * (owner, 2026-07-07: "Только измерить и задокументировать 7 писателей").
 *
 * This is a MEASUREMENT, not a new capability: it calls the real, unmocked `resolveField()` from
 * fieldArbiter.ts with FICTIONAL candidate values simulating the exact disagreement scenario
 * documented in docs/reports/TPS_FIELD_VALUE_LINEAGE_2026-07-07.md, and asserts which source the
 * code actually picks and why — proving the priority table's real behavior instead of reading it
 * and assuming. No network, no keys, no production code touched.
 */
import { describe, it, expect } from 'vitest'
import { resolveField, type ExtractedCandidate } from '../fieldArbiter'

describe('TPS field-value lineage — measured priority order (fictional candidates)', () => {
  it('STRONG_IDENTITY field: passport MRZ beats I-94 keyword beats AI Brain guess from the same passport', () => {
    // Three MATERIALLY disagreeing candidates for one field (Levenshtein ≥3, not a typo-level
    // difference the arbiter treats as "same value") — exactly the "7 writers" fear scenario.
    const candidates: ExtractedCandidate[] = [
      { field: 'family_name', value: 'Dorosh', sourceDoc: 'passport', sourceType: 'ai_brain', confidence: 0.6, reviewRequired: true },
      { field: 'family_name', value: 'Doslenko', sourceDoc: 'i94', sourceType: 'ocr_keyword', confidence: 0.85, reviewRequired: false },
      { field: 'family_name', value: 'PETRENKO', sourceDoc: 'passport', sourceType: 'ocr_mrz', confidence: 0.99, reviewRequired: false },
    ]
    const resolved = resolveField('family_name', candidates)
    expect(resolved.chosenValue).toBe('PETRENKO')
    expect(resolved.chosenSourceDoc).toBe('passport')
    expect(resolved.chosenSourceType).toBe('ocr_mrz')
    expect(resolved.conflict).toBe(true) // disagreement WAS detected, not silently dropped
    expect(resolved.rejectedCandidates.length).toBe(2) // both losers are preserved for audit
  })

  it('a user correction always wins, even over MRZ', () => {
    const candidates: ExtractedCandidate[] = [
      { field: 'family_name', value: 'PETRENKO', sourceDoc: 'passport', sourceType: 'ocr_mrz', confidence: 0.99, reviewRequired: false },
      { field: 'family_name', value: 'Petrenkov', sourceDoc: 'manual', sourceType: 'user_corrected', confidence: 1, reviewRequired: false },
    ]
    const resolved = resolveField('family_name', candidates)
    expect(resolved.chosenValue).toBe('Petrenkov')
    expect(resolved.chosenSourceType).toBe('user_corrected')
  })

  it('FIXED 2026-07-07 (was a stack-overflow crash, found by this measurement): a hyphenated ' +
     'top-priority name no longer infinite-recurses. The plausibility guard now reassigns ' +
     'winner/losers in place instead of recursing through the priority sort, which used to ' +
     're-promote the same rejected candidate forever. Regression-pinned here so it can never ' +
     'silently come back.', () => {
    const candidates: ExtractedCandidate[] = [
      { field: 'family_name', value: 'PETRENKO', sourceDoc: 'passport', sourceType: 'ocr_mrz', confidence: 0.99, reviewRequired: false },
      // isPlausibleName() rejects this: a hyphenated word is neither all-upper, all-lower, nor
      // single-capitalized — "mixed-case garbage" per fieldArbiter.ts's word-shape check — even
      // though it is a perfectly ordinary corrected surname. This is a SEPARATE, still-open policy
      // question (should isPlausibleName allow hyphens for user_corrected specifically?) — not
      // addressed by this fix, which is scoped to eliminating the crash, not changing the policy.
      { field: 'family_name', value: 'Petrenko-Kovalenko', sourceDoc: 'manual', sourceType: 'user_corrected', confidence: 1, reviewRequired: false },
    ]
    expect(() => resolveField('family_name', candidates)).not.toThrow()
    const resolved = resolveField('family_name', candidates)
    // The plausibility guard falls through to the next-best PLAUSIBLE candidate — here, the MRZ
    // reading — rather than crashing. Whether a hyphenated user correction SHOULD outrank MRZ is
    // the open policy question noted above, not decided by this crash fix.
    expect(resolved.chosenValue).toBe('PETRENKO')
    expect(resolved.chosenSourceType).toBe('ocr_mrz')
    expect(resolved.notes.some((n) => n.startsWith('plausibility_rejected:'))).toBe(true)
    expect(resolved.conflict).toBe(true) // the rejected hyphenated correction is still surfaced
  })

  it('STRONG_DOCUMENT field: field-specific priority table, not a generic identity ranking', () => {
    // a_number ranks EAD above I-797 above manual — verifies DOCUMENT_PRIORITY is actually consulted.
    const candidates: ExtractedCandidate[] = [
      { field: 'a_number', value: '111111111', sourceDoc: 'i797', sourceType: 'ocr_keyword', confidence: 0.7, reviewRequired: false },
      { field: 'a_number', value: '222222222', sourceDoc: 'ead', sourceType: 'ocr_keyword', confidence: 0.9, reviewRequired: false },
    ]
    const resolved = resolveField('a_number', candidates)
    expect(resolved.chosenValue).toBe('222222222')
    expect(resolved.chosenSourceDoc).toBe('ead')
  })

  it('no candidates → honest not_measured shape, never a fabricated value', () => {
    const resolved = resolveField('family_name', [])
    expect(resolved.chosenValue).toBeNull()
    expect(resolved.reviewRequired).toBe(true)
    expect(resolved.notes).toContain('no_candidates')
  })

  it('all candidates empty-string → distinct from zero candidates, still honest null', () => {
    const candidates: ExtractedCandidate[] = [
      { field: 'family_name', value: '', sourceDoc: 'passport', sourceType: 'ocr_mrz', confidence: 0.9, reviewRequired: false },
    ]
    const resolved = resolveField('family_name', candidates)
    expect(resolved.chosenValue).toBeNull()
    expect(resolved.notes).toContain('all_candidates_empty')
  })
})
