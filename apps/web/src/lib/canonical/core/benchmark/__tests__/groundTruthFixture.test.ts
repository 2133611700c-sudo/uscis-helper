/**
 * groundTruthFixture + runFixtureBenchmark tests — the L2 runner on-ramp.
 * Pins: fixture validation, expected:null = must-not-finalize → false-finalization
 * counted as critical_wrong (silent substitution = 0 tolerance), and the DI runner
 * producing a class verdict from synthetic predictions. Synthetic Ivanenko only.
 */
import { describe, it, expect } from 'vitest'
import {
  parseFixture,
  fixtureToGroundTruth,
  mustNotFinalizeFields,
  scoreFixture,
  type GroundTruthFixture,
} from '../groundTruthFixture'
import { runClassBenchmark, runAllClasses, summarizeReports } from '../runFixtureBenchmark'
import type { ProducedField } from '../../benchmark'

const fixture = (over: Partial<GroundTruthFixture> = {}): GroundTruthFixture => ({
  docId: 'synthetic-birth-01',
  documentClass: 'birth_certificate_handwritten',
  fields: [
    { field: 'child_family_name', expected: 'Ivanenko', critical: true },
    { field: 'child_given_name', expected: 'Ivan', critical: true },
    { field: 'dob', expected: '1990-05-14', critical: true },
    { field: 'child_patronymic', expected: null, critical: true }, // illegible → must NOT finalize
  ],
  ...over,
})

describe('parseFixture — validation', () => {
  it('accepts a well-formed fixture (including expected:null)', () => {
    const r = parseFixture(fixture())
    expect(r.ok).toBe(true)
  })
  it('rejects bad shapes with clear errors', () => {
    const r = parseFixture({ docId: '', documentClass: 'x', fields: [{ field: 'a', expected: 5 }] })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.errors).toContain('docId must be a non-empty string')
      expect(r.errors.some((e) => e.includes('expected must be a string or null'))).toBe(true)
    }
  })
})

describe('fixtureToGroundTruth + mustNotFinalize', () => {
  it('value fields go to GroundTruth; null-expected fields are excluded but tracked', () => {
    const f = fixture()
    const gt = fixtureToGroundTruth(f)
    expect(Object.keys(gt.fields).sort()).toEqual(['child_family_name', 'child_given_name', 'dob'])
    expect(mustNotFinalizeFields(f).has('child_patronymic')).toBe(true)
  })
})

describe('scoreFixture — false-finalization is zero-tolerance', () => {
  it('finalizing a must-not-finalize field counts as critical_wrong', () => {
    const f = fixture()
    const produced: ProducedField[] = [
      { key: 'child_family_name', value: 'Ivanenko' },
      { key: 'child_given_name', value: 'Ivan' },
      { key: 'dob', value: '1990-05-14' },
      { key: 'child_patronymic', value: 'Petrovych' }, // WRONG: should have stayed null/review
    ]
    expect(scoreFixture(f, produced).critical_wrong_count).toBeGreaterThanOrEqual(1)
  })
  it('leaving a must-not-finalize field null (or review) is NOT a wrong', () => {
    const f = fixture()
    const produced: ProducedField[] = [
      { key: 'child_family_name', value: 'Ivanenko' },
      { key: 'child_given_name', value: 'Ivan' },
      { key: 'dob', value: '1990-05-14' },
      { key: 'child_patronymic', value: null },
    ]
    expect(scoreFixture(f, produced).critical_wrong_count).toBe(0)
  })
})

describe('runClassBenchmark — DI predict → class verdict', () => {
  const perfectPredict = (f: GroundTruthFixture): ProducedField[] =>
    f.fields.map((x) => ({ key: x.field, value: x.expected })) // returns truth (and null for must-not)

  it('30 perfect docs → PASS with the verdict + per-doc breakdown', async () => {
    const fixtures = Array.from({ length: 30 }, (_, i) => fixture({ docId: `synthetic-${i}` }))
    const r = await runClassBenchmark('birth_certificate_handwritten', fixtures, perfectPredict)
    expect(r.verdict).toBe('PASS')
    expect(r.perDoc).toHaveLength(30)
    expect(r.criticalWrong).toBe(0)
  })

  it('< 30 docs → INSUFFICIENT_N regardless of perfection', async () => {
    const fixtures = Array.from({ length: 10 }, (_, i) => fixture({ docId: `s-${i}` }))
    const r = await runClassBenchmark('birth_certificate_handwritten', fixtures, perfectPredict)
    expect(r.verdict).toBe('INSUFFICIENT_N')
  })

  it('runAllClasses groups by class; summary is PII-free', async () => {
    const fixtures = [fixture({ docId: 'a' }), fixture({ docId: 'b', documentClass: 'internal_passport_booklet' })]
    const reports = await runAllClasses(fixtures, perfectPredict)
    expect(reports).toHaveLength(2)
    const summary = summarizeReports(reports)
    expect(summary).not.toContain('Ivanenko') // PII-free: verdicts + counts only
    expect(summary).toContain('INSUFFICIENT_N') // both classes are under N=30
  })
})
