/**
 * l2RunnerSmoke.test.ts — proof-of-FLOW (not a full benchmark): the 3 synthetic
 * worked-example fixtures load, the REAL runner runs them end-to-end, and the verdict +
 * the adversarial safety-catch behave as expected — BEFORE the owner adds real data.
 * Synthetic content only (no PII).
 */
import { describe, it, expect } from 'vitest'
import { parseFixture, type GroundTruthFixture } from '../groundTruthFixture'
import { runAllClasses, type PredictFn } from '../runFixtureBenchmark'
import type { ProducedField } from '../../benchmark'
import passportNormal from '../examples/passport_ua_normal.example.json'
import birthSilentSub from '../examples/birth_cert_silent_substitution.example.json'
import birthCyrillic from '../examples/birth_cert_cyrillic_in_output.example.json'

function load(): GroundTruthFixture[] {
  return [passportNormal, birthSilentSub, birthCyrillic].map((j) => {
    const r = parseFixture(j)
    if (!r.ok) throw new Error(`fixture invalid: ${r.errors.join(', ')}`)
    return r.fixture
  })
}

// a SAFE reader: returns the truth (and null for must-not-finalize fields) → no false-finalization
const safePredict: PredictFn = (f) => f.fields.map((x): ProducedField => ({ key: x.field, value: x.expected }))
// a BROKEN reader: FINALIZES a must-not-finalize field (the adversarial failure mode)
const brokenPredict: PredictFn = (f) =>
  f.fields.map((x): ProducedField => ({ key: x.field, value: x.expected === null ? 'WRONGLY_FINALIZED' : x.expected }))

describe('L2 runner smoke — flow works end-to-end on synthetic worked examples', () => {
  it('the 3 worked-example fixtures are valid', () => {
    expect(load()).toHaveLength(3)
  })

  it('(a) verdict is INSUFFICIENT_N — N=1-2 per class is far below the 30 threshold', async () => {
    const reports = await runAllClasses(load(), safePredict)
    // passport (1) + birth_certificate_handwritten (2) = 2 classes, both underpowered
    expect(reports.length).toBe(2)
    for (const r of reports) expect(r.verdict).toBe('INSUFFICIENT_N')
  })

  it('(b) per-field accuracy is computed even when the verdict is undecidable', async () => {
    const reports = await runAllClasses(load(), safePredict)
    const birth = reports.find((r) => r.documentClass === 'birth_certificate_handwritten')
    expect(birth?.accuracy).not.toBeNull() // a number, just not authoritative at this N
    expect(birth?.perDoc.length).toBe(2)
  })

  it('(c) safe reader → zero false-finalizations on the adversarial fixtures', async () => {
    const reports = await runAllClasses(load(), safePredict)
    for (const r of reports) expect(r.criticalWrong).toBe(0)
  })

  it('(c) BROKEN reader (finalizes a must-not-finalize field) → the verdict CATCHES it as critical_wrong', async () => {
    const reports = await runAllClasses(load(), brokenPredict)
    const birth = reports.find((r) => r.documentClass === 'birth_certificate_handwritten')
    // silent_substitution (mother_full_name=null) + cyrillic_in_output (issuing_authority=null)
    // each wrongly finalized → ≥2 critical_wrong across the 2 birth fixtures.
    expect(birth?.criticalWrong).toBeGreaterThanOrEqual(2)
  })
})
