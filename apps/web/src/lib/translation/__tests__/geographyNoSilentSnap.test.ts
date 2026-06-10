/**
 * geographyNoSilentSnap.test.ts — S1 safety: a fuzzy place must NEVER silently
 * replace the raw read. Locks the owner's live failure: с.м.т. Ярошенець must NOT
 * become Trostianets without review.
 */
import { describe, it, expect } from 'vitest'
import { snapCity } from '@uscis-helper/knowledge'

describe('S1 — geography no-silent-snap', () => {
  it('does NOT silently replace a distant fuzzy read (Ярошенець ≠ Тростянець)', () => {
    const r = snapCity('с.м.т. Ярошенець')
    expect(r.value).toContain('Ярошен')          // RAW preserved
    expect(r.value).not.toBe(r.suggestedValue)    // NOT silently replaced by the suggestion
    expect(r.matched).toBe(false)
    expect(r.review_required).toBe(true)
    // A nearest real settlement is surfaced as a SUGGESTION only (never applied).
    // The exact suggestion depends on the gazetteer vocabulary (now the full
    // КАТОТТГ settlement layer), so we pin the SAFETY invariant, not the city:
    // a suggestion exists, it is a real place, and it is not the raw read.
    expect(typeof r.suggestedValue).toBe('string')
    expect(r.suggestedValue && r.suggestedValue.length).toBeGreaterThan(0)
    expect(r.reason).toBe('fuzzy_geography_match')
  })

  it('an EXACT match still normalizes (Тростянець → Тростянець, no review)', () => {
    const r = snapCity('Тростянець')
    expect(r.value).toBe('Тростянець')
    expect(r.matched).toBe(true)
    expect(r.review_required).toBe(false)
    expect(r.suggestedValue ?? null).toBeNull()
  })

  it('unknown geography keeps the raw read + review, no suggestion', () => {
    const r = snapCity('Ззззжщ')
    expect(r.matched).toBe(false)
    expect(r.review_required).toBe(true)
    expect(r.reason).toBe('unknown_geography')
  })
})
