import { describe, it, expect } from 'vitest'
import {
  wrongFieldAssignmentRate,
  abstentionPrecision,
  abstentionRecall,
  rollupByRendering,
  rollupByLanguage,
  rollupByFieldKind,
  type Row,
} from '../cyrillicAcceptanceRollups'

// FICTIONAL rows only — categorical tags + verdict, NO field values, NO PII.

const row = (r: Partial<Row> & Pick<Row, 'verdict' | 'reviewRequired'>): Row => ({
  key: r.key ?? 'field',
  fieldKind: r.fieldKind,
  rendering: r.rendering,
  language: r.language,
  verdict: r.verdict,
  reviewRequired: r.reviewRequired,
})

describe('wrongFieldAssignmentRate', () => {
  it('share of rows whose value landed in a different key', () => {
    const rows: Row[] = [
      row({ verdict: 'WRONG', reviewRequired: false, fieldKind: 'wrong_field' }),
      row({ verdict: 'EXACT', reviewRequired: false, fieldKind: 'name' }),
      row({ verdict: 'EMPTY', reviewRequired: true, fieldKind: 'date' }),
      row({ verdict: 'NA', reviewRequired: false }), // excluded from denominator
    ]
    expect(wrongFieldAssignmentRate(rows)).toBeCloseTo(1 / 3, 5) // 1 wrong_field of 3 considered
  })

  it('0 when no rows', () => {
    expect(wrongFieldAssignmentRate([])).toBe(0)
  })
})

describe('abstentionPrecision', () => {
  it('REVIEW ∩ (WRONG∨EMPTY∨FABRICATED) / REVIEW', () => {
    const rows: Row[] = [
      row({ verdict: 'WRONG', reviewRequired: true }),   // flagged + bad → hit
      row({ verdict: 'EMPTY', reviewRequired: true }),   // flagged + bad → hit
      row({ verdict: 'EXACT', reviewRequired: true }),   // flagged but good → wasted
      row({ verdict: 'WRONG', reviewRequired: false }),  // not flagged
    ]
    expect(abstentionPrecision(rows)).toBeCloseTo(2 / 3, 5) // 2 good catches of 3 flagged
  })

  it('0 when nothing flagged', () => {
    expect(abstentionPrecision([row({ verdict: 'EXACT', reviewRequired: false })])).toBe(0)
  })
})

describe('abstentionRecall', () => {
  it('REVIEW ∩ (WRONG∨EMPTY∨FABRICATED) / (WRONG∨EMPTY∨FABRICATED)', () => {
    const rows: Row[] = [
      row({ verdict: 'WRONG', reviewRequired: true }),     // bad + flagged → caught
      row({ verdict: 'EMPTY', reviewRequired: false }),    // bad + slipped through
      row({ verdict: 'FABRICATED', reviewRequired: true }),// bad + flagged → caught
      row({ verdict: 'EXACT', reviewRequired: false }),    // good, irrelevant
    ]
    expect(abstentionRecall(rows)).toBeCloseTo(2 / 3, 5) // 2 of 3 bad reads flagged
  })

  it('0 when there are no bad reads', () => {
    expect(abstentionRecall([row({ verdict: 'EXACT', reviewRequired: false })])).toBe(0)
  })
})

describe('rollupByRendering', () => {
  it('exact-match cut by printed vs handwritten', () => {
    const rows: Row[] = [
      row({ verdict: 'EXACT', reviewRequired: false, rendering: 'printed' }),
      row({ verdict: 'EXACT', reviewRequired: false, rendering: 'printed' }),
      row({ verdict: 'WRONG', reviewRequired: true, rendering: 'handwritten' }),
      row({ verdict: 'NA', reviewRequired: false, rendering: 'handwritten' }), // excluded
    ]
    expect(rollupByRendering(rows)).toEqual({
      printed: { n: 2, exact: 2 },
      handwritten: { n: 1, exact: 0 },
    })
  })
})

describe('rollupByLanguage', () => {
  it('exact-match cut by ua vs ru', () => {
    const rows: Row[] = [
      row({ verdict: 'EXACT', reviewRequired: false, language: 'ua' }),
      row({ verdict: 'WRONG', reviewRequired: false, language: 'ua' }),
      row({ verdict: 'EXACT', reviewRequired: false, language: 'ru' }),
    ]
    expect(rollupByLanguage(rows)).toEqual({
      ua: { n: 2, exact: 1 },
      ru: { n: 1, exact: 1 },
    })
  })
})

describe('rollupByFieldKind', () => {
  it('exact-match cut by field kind', () => {
    const rows: Row[] = [
      row({ verdict: 'EXACT', reviewRequired: false, fieldKind: 'name' }),
      row({ verdict: 'EMPTY', reviewRequired: true, fieldKind: 'name' }),
      row({ verdict: 'EXACT', reviewRequired: false, fieldKind: 'date' }),
    ]
    expect(rollupByFieldKind(rows)).toEqual({
      name: { n: 2, exact: 1 },
      date: { n: 1, exact: 1 },
    })
  })
})
