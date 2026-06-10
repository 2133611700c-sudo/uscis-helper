import { describe, it, expect } from 'vitest'
import { parseFixture, mustNotFinalizeFields } from '../groundTruthFixture'
import example from '../examples/birth_certificate.example.json'
import adversarial from '../examples/adversarial.example.json'

describe('committed example fixtures stay valid', () => {
  it('birth_certificate example parses', () => { expect(parseFixture(example).ok).toBe(true) })
  it('adversarial example parses and carries must-not-finalize fields', () => {
    const r = parseFixture(adversarial)
    expect(r.ok).toBe(true)
    if (r.ok) {
      // the adversarial example must exercise safety: several expected:null fields
      expect(mustNotFinalizeFields(r.fixture).size).toBeGreaterThanOrEqual(3)
    }
  })
})
