/**
 * classVerdict.test.ts — L2 class-level verdict. Pins: N<30 → INSUFFICIENT_N (never
 * PASS), any silent wrong-critical → FAIL regardless of accuracy (0 tolerance), LOCKED
 * per-class thresholds, and the canary freshness gate. Synthetic scores only.
 */
import { describe, it, expect } from 'vitest'
import type { BenchmarkScore } from '../../benchmark'
import {
  evaluateClassBenchmark,
  thresholdForClass,
  canaryDeployAllowed,
  MIN_DECISION_N,
} from '../classVerdict'

// minimal BenchmarkScore factory (only the fields the verdict reads)
function score(over: Partial<BenchmarkScore> = {}): BenchmarkScore {
  return {
    total: 10, coverage: 1, correct: 10,
    critical_total: 5, critical_correct: 5, critical_missing: 0,
    critical_wrong_count: 0, review_rate: 0, fields: [],
    ...over,
  }
}
const many = (n: number, s: BenchmarkScore): BenchmarkScore[] => Array.from({ length: n }, () => s)

describe('N gate — underpowered sample is undecidable', () => {
  it('N < 30 → INSUFFICIENT_N, never PASS even at 100% accuracy', () => {
    const v = evaluateClassBenchmark('internal_passport_booklet', many(29, score()))
    expect(v.verdict).toBe('INSUFFICIENT_N')
    expect(v.n).toBe(29)
  })
  it('N = 30 is enough to decide', () => {
    expect(evaluateClassBenchmark('internal_passport_booklet', many(30, score())).verdict).toBe('PASS')
    expect(MIN_DECISION_N).toBe(30)
  })
})

describe('zero-tolerance — any silent wrong critical fails the class', () => {
  it('one critical_wrong → FAIL even with otherwise-perfect accuracy', () => {
    const scores = [...many(40, score()), score({ critical_wrong_count: 1, critical_correct: 4 })]
    const v = evaluateClassBenchmark('internal_passport_booklet', scores)
    expect(v.verdict).toBe('FAIL')
    expect(v.criticalWrong).toBe(1)
    expect(v.reasons.some((r) => r.startsWith('silent_wrong_critical'))).toBe(true)
  })
})

describe('LOCKED per-class thresholds', () => {
  it('exposes the locked numbers', () => {
    expect(thresholdForClass('internal_passport_booklet')).toBe(0.99)
    expect(thresholdForClass('military_id')).toBe(0.98)
    expect(thresholdForClass('birth_certificate_soviet_bilingual')).toBe(0.97)
    expect(thresholdForClass('something_unmapped')).toBe(0.99) // strict default
  })
  it('PASS at/above threshold, FAIL below', () => {
    // soviet bilingual threshold 0.97: 97/100 correct → PASS; 96/100 → FAIL
    const pass = many(40, score({ critical_total: 100, critical_correct: 97 }))
    expect(evaluateClassBenchmark('birth_certificate_soviet_bilingual', pass).verdict).toBe('PASS')
    const fail = many(40, score({ critical_total: 100, critical_correct: 96 }))
    const fv = evaluateClassBenchmark('birth_certificate_soviet_bilingual', fail)
    expect(fv.verdict).toBe('FAIL')
    expect(fv.reasons.some((r) => r.startsWith('accuracy_'))).toBe(true)
  })
})

describe('canary freshness gate', () => {
  const NOW = 1_000_000_000_000
  const DAY = 24 * 60 * 60 * 1000
  it('blocks when never passed', () => {
    expect(canaryDeployAllowed(null, NOW)).toBe(false)
  })
  it('allows a PASS within 7 days, blocks a stale one', () => {
    expect(canaryDeployAllowed(NOW - 3 * DAY, NOW)).toBe(true)
    expect(canaryDeployAllowed(NOW - 8 * DAY, NOW)).toBe(false)
  })
})
