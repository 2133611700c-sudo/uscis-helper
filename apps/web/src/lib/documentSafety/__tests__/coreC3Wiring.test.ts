/**
 * coreC3Wiring.test.ts — R8 (+R7/R4) C3 on the Core path.
 *
 * The route runs applyOcrFieldSafety on the Core return ONLY when OCR_FIELD_SAFETY_ENABLED=1.
 * Here we prove the C3 layer's behavior at that boundary:
 *  - isOcrFieldSafetyEnabled gates correctly (default OFF).
 *  - anchorResolver (R7) lets an anchored critical field accept_final.
 *  - consensus_reliable (R4) overrides the SOFT no-anchor condition.
 *  - without anchor/consensus a critical field is parked candidate_only (today's C3).
 */
import { describe, it, expect } from 'vitest'
import { applyOcrFieldSafety, isOcrFieldSafetyEnabled, type SafeField } from '../applyOcrFieldSafety'

// A NON-hard-case class: the only SOFT reason in play for a clean high-conf critical is
// no_strong_source_anchor, so the R7 anchor alone is sufficient to accept_final. (A hard-case
// class additionally fires hard_case_manual_required, which only consensus_reliable clears.)
const ctx = { flow: 'translation_public' as const, document_class: 'ua_international_passport' }

const crit = (over: Partial<SafeField> = {}): SafeField => ({
  field: 'date_of_birth', value: '05/15/1990', confidence: 0.95, review_required: false, ...over,
})

describe('R8 — OCR_FIELD_SAFETY_ENABLED gate', () => {
  it('default OFF', () => {
    expect(isOcrFieldSafetyEnabled({})).toBe(false)
    expect(isOcrFieldSafetyEnabled({ OCR_FIELD_SAFETY_ENABLED: '0' })).toBe(false)
    expect(isOcrFieldSafetyEnabled({ OCR_FIELD_SAFETY_ENABLED: '1' })).toBe(true)
  })
})

describe('R8/R7/R4 — C3 on a critical field', () => {
  it('no anchor, no consensus → candidate_only (value parked, review forced) — today\'s C3', () => {
    const { fields } = applyOcrFieldSafety([crit()], ctx)
    expect(fields[0].value).toBeNull()
    expect(fields[0].candidate_value).toBe('05/15/1990')
    expect(fields[0].review_required).toBe(true)
    expect(fields[0].finalValue).toBeNull()
  })

  it('R7 anchorResolver TRUE → accept_final (value released)', () => {
    const { fields } = applyOcrFieldSafety([crit()], ctx, { anchorResolver: () => true })
    expect(fields[0].value).toBe('05/15/1990')
    expect(fields[0].finalValue).toBe('05/15/1990')
    expect(fields[0].review_required).toBe(false)
  })

  it('R4 consensus_reliable → overrides the SOFT no-anchor condition → accept_final', () => {
    const { fields } = applyOcrFieldSafety([crit({ consensus_reliable: true })], ctx)
    expect(fields[0].value).toBe('05/15/1990')
    expect(fields[0].finalValue).toBe('05/15/1990')
    expect(fields[0].review_required).toBe(false)
  })

  it('anchorResolver FALSE with no consensus → still candidate_only (resolver never lowers safety on its own)', () => {
    const { fields } = applyOcrFieldSafety([crit()], ctx, { anchorResolver: () => false })
    expect(fields[0].value).toBeNull()
    expect(fields[0].review_required).toBe(true)
  })
})
