/**
 * Stage 2 metrics — unit tests on FICTIONAL vectors (no real PII, no provider calls).
 */
import { describe, it, expect } from 'vitest'
import {
  cer, fieldVerdict, scoreRollup, documentExact, wrongFieldAssignmentRate,
  abstentionScore, perRendering, perTemplate, evidenceCoverage,
} from '../metrics'
import type { GroundTruthRecord, Prediction } from '../types'

const gt = (o: Partial<GroundTruthRecord>): GroundTruthRecord => ({
  docId: 'd1', documentFamily: 'UA_BIRTH_CERT_MODERN', fieldId: 'surname',
  expectedCyrillic: "Солов'як", regionType: 'printed_line', qualityGrade: 'good',
  rendering: 'printed', expectedAbstention: false, ...o,
})
const pred = (o: Partial<Prediction>): Prediction => ({ docId: 'd1', fieldId: 'surname', value: "Солов'як", abstained: false, ...o })

describe('cer (Cyrillic-folded)', () => {
  it('exact → 0, total mismatch → 1', () => {
    expect(cer("Солов'як", "Солов'як")).toBe(0)
    expect(cer('Андрій', "Солов'як")).toBeGreaterThan(0.5)
    expect(cer(null, "Солов'як")).toBe(1)
    expect(cer(null, null)).toBe(0)
  })
})

describe('fieldVerdict', () => {
  it('EXACT / WRONG / MISS', () => {
    expect(fieldVerdict(gt({}), pred({}))).toBe('EXACT')
    expect(fieldVerdict(gt({}), pred({ value: 'Андрій' }))).toBe('WRONG')
    expect(fieldVerdict(gt({}), pred({ abstained: true, value: null }))).toBe('MISS')
  })
  it('CORRECT_ABSTAIN / FABRICATED for should-abstain fields', () => {
    const abs = gt({ expectedAbstention: true, expectedCyrillic: null })
    expect(fieldVerdict(abs, pred({ abstained: true, value: null }))).toBe('CORRECT_ABSTAIN')
    expect(fieldVerdict(abs, pred({ value: 'invented' }))).toBe('FABRICATED')
  })
})

describe('rollups + document-exact', () => {
  const gts = [
    gt({ docId: 'd1', fieldId: 'surname', expectedCyrillic: "Солов'як" }),
    gt({ docId: 'd1', fieldId: 'given', expectedCyrillic: 'Андрій' }),
    gt({ docId: 'd2', fieldId: 'surname', expectedCyrillic: 'Петренко' }),
  ]
  it('scoreRollup counts + field-exact rate', () => {
    const r = scoreRollup(gts, [
      pred({ docId: 'd1', fieldId: 'surname', value: "Солов'як" }),
      pred({ docId: 'd1', fieldId: 'given', value: 'Андрій' }),
      pred({ docId: 'd2', fieldId: 'surname', value: 'WRONG' }),
    ])
    expect(r.exact).toBe(2); expect(r.wrong).toBe(1)
    expect(r.fieldExactRate).toBeCloseTo(2 / 3, 2)
  })
  it('documentExact = fraction of fully-correct docs', () => {
    const de = documentExact(gts, [
      pred({ docId: 'd1', fieldId: 'surname', value: "Солов'як" }),
      pred({ docId: 'd1', fieldId: 'given', value: 'Андрій' }),
      pred({ docId: 'd2', fieldId: 'surname', value: 'WRONG' }),
    ])
    expect(de).toBe(0.5) // d1 fully exact, d2 not
  })
})

describe('wrong-field assignment', () => {
  it('flags a value placed in the wrong slot', () => {
    const gts = [
      gt({ fieldId: 'surname', expectedCyrillic: "Солов'як" }),
      gt({ fieldId: 'given', expectedCyrillic: 'Андрій' }),
    ]
    // surname slot got the GIVEN-name value → misassignment
    const rate = wrongFieldAssignmentRate(gts, [
      pred({ fieldId: 'surname', value: 'Андрій' }),
      pred({ fieldId: 'given', value: 'Андрій' }),
    ])
    expect(rate).toBeGreaterThan(0)
  })
})

describe('abstention precision/recall', () => {
  it('scores should-abstain fields', () => {
    const gts = [
      gt({ fieldId: 'a', expectedAbstention: true, expectedCyrillic: null }),
      gt({ fieldId: 'b', expectedAbstention: true, expectedCyrillic: null }),
      gt({ fieldId: 'c', expectedCyrillic: "Солов'як" }),
    ]
    const s = abstentionScore(gts, [
      pred({ fieldId: 'a', abstained: true, value: null }),     // correct abstain
      pred({ fieldId: 'b', value: 'fabricated' }),               // should abstain, didn't
      pred({ fieldId: 'c', value: "Солов'як" }),                 // produced (correct)
    ])
    expect(s.shouldAbstain).toBe(2)
    expect(s.correctAbstain).toBe(1)
    expect(s.recall).toBe(0.5)
    expect(s.precision).toBe(1) // only 1 abstention made, and it was correct
  })
})

describe('printed vs handwriting kept SEPARATE', () => {
  it('perRendering returns two independent rollups', () => {
    const gts = [
      gt({ docId: 'p', fieldId: 'x', rendering: 'printed', expectedCyrillic: 'Київ' }),
      gt({ docId: 'h', fieldId: 'y', rendering: 'handwritten', expectedCyrillic: "Солов'як" }),
    ]
    const r = perRendering(gts, [
      pred({ docId: 'p', fieldId: 'x', value: 'Київ' }),
      pred({ docId: 'h', fieldId: 'y', value: 'WRONG' }),
    ])
    expect(r.printed.exact).toBe(1)
    expect(r.handwritten.exact).toBe(0)
    expect(r.handwritten.wrong).toBe(1)
  })
})

describe('per-template rollup + evidence coverage', () => {
  it('groups by family/template', () => {
    const gts = [
      gt({ docId: 'd1', documentFamily: 'UA_BIRTH_CERT_SOVIET', fieldId: 'x', expectedCyrillic: 'a' }),
      gt({ docId: 'd2', documentFamily: 'UA_BIRTH_CERT_MODERN', fieldId: 'x', expectedCyrillic: 'b' }),
    ]
    const t = perTemplate(gts, [pred({ docId: 'd1', fieldId: 'x', value: 'a' }), pred({ docId: 'd2', fieldId: 'x', value: 'b' })])
    expect(Object.keys(t).sort()).toEqual(['UA_BIRTH_CERT_MODERN', 'UA_BIRTH_CERT_SOVIET'])
  })
  it('bbox coverage + exact-crop rate', () => {
    const cov = evidenceCoverage([
      pred({ fieldId: 'a', hasBbox: true, bboxStatus: 'exact' }),
      pred({ fieldId: 'b', hasBbox: true, bboxStatus: 'approximate' }),
      pred({ fieldId: 'c', hasBbox: false, bboxStatus: 'missing' }),
    ])
    expect(cov.bboxCoverage).toBeCloseTo(2 / 3, 2)
    expect(cov.exactCropRate).toBeCloseTo(1 / 3, 2)
  })
})
