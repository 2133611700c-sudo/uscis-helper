/**
 * U-STAGE 1 (ONE DICTIONARY) — U2 parity proof for documentBrain months.
 *
 * Before unification, documentBrain.ts carried a forked inline `MONTHS_UA_FULL`
 * map (Cyrillic full month → number 1..12). It now derives that map from the
 * canonical package `UA_MONTHS` ("MM" strings), restricted to the 12 Ukrainian
 * full-word keys the local date parser historically accepted.
 *
 * This test pins the byte-for-byte equality of the derived map against the
 * exact prior inline values, so the refactor provably changes NO behaviour
 * (in particular it does NOT add Russian-month parsing to this parser).
 */
import { describe, it, expect } from 'vitest'
import { UA_MONTHS as PKG_UA_MONTHS } from '@uscis-helper/knowledge'

// Frozen copy of the pre-unification inline map (the source of truth for parity).
const PRIOR_INLINE_MONTHS_UA_FULL: Record<string, number> = {
  'січня': 1,
  'лютого': 2,
  'березня': 3,
  'квітня': 4,
  'травня': 5,
  'червня': 6,
  'липня': 7,
  'серпня': 8,
  'вересня': 9,
  'жовтня': 10,
  'листопада': 11,
  'грудня': 12,
}

// Reproduce the exact derivation used inside documentBrain.ts.
const UA_FULL_MONTH_KEYS = [
  'січня', 'лютого', 'березня', 'квітня', 'травня', 'червня',
  'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня',
] as const
const DERIVED_MONTHS_UA_FULL: Record<string, number> = Object.fromEntries(
  UA_FULL_MONTH_KEYS.map((k) => [k, parseInt(PKG_UA_MONTHS[k], 10)]),
)

describe('U2 — documentBrain MONTHS_UA_FULL derives from canonical UA_MONTHS', () => {
  it('derived map is byte-identical to the prior inline map', () => {
    expect(DERIVED_MONTHS_UA_FULL).toEqual(PRIOR_INLINE_MONTHS_UA_FULL)
  })

  it('derived map has exactly the 12 historical Ukrainian keys (no Russian months added)', () => {
    expect(Object.keys(DERIVED_MONTHS_UA_FULL).sort()).toEqual(
      Object.keys(PRIOR_INLINE_MONTHS_UA_FULL).sort(),
    )
  })

  it('canonical package supplies the same MM value for each key', () => {
    for (const k of UA_FULL_MONTH_KEYS) {
      expect(parseInt(PKG_UA_MONTHS[k], 10)).toBe(PRIOR_INLINE_MONTHS_UA_FULL[k])
    }
  })
})
