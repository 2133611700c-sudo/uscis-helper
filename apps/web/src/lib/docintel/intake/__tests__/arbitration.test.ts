/**
 * arbitration.test.ts — Phase 5 intake-level type arbitration + review policy. Pure.
 */
import { describe, it, expect } from 'vitest'
import { arbitrateDocType, reviewPolicyForType, type TypeCandidate } from '../arbitration'

describe('arbitrateDocType — provider proposes, brain fuses', () => {
  it('agreement (2 providers) raises confidence + marks agreement', () => {
    const cands: TypeCandidate[] = [
      { provider: 'rule', docTypeId: 'ua_birth_certificate_soviet', confidence: 0.7 },
      { provider: 'openai', docTypeId: 'ua_birth_certificate_soviet', confidence: 0.8 },
    ]
    const r = arbitrateDocType(cands)
    expect(r.docTypeId).toBe('ua_birth_certificate_soviet')
    expect(r.agreement).toBe(true)
    expect(r.confidence).toBeGreaterThan(0.75) // agreement bonus
    expect(r.reasonCodes).not.toContain('single_provider_classification')
  })
  it('single provider flags single_provider_classification', () => {
    const r = arbitrateDocType([{ provider: 'openai', docTypeId: 'passport', confidence: 0.9 }])
    expect(r.docTypeId).toBe('passport')
    expect(r.agreement).toBe(false)
    expect(r.reasonCodes).toContain('single_provider_classification')
  })
  it('disagreement lowers confidence and preserves the loser for audit', () => {
    const r = arbitrateDocType([
      { provider: 'openai', docTypeId: 'passport', confidence: 0.8 },
      { provider: 'rule', docTypeId: 'i94', confidence: 0.6 },
    ])
    expect(r.docTypeId).toBe('passport')
    expect(r.confidence).toBeLessThan(0.8) // pulled down by disagreement
    expect(r.rejected.some((c) => c.docTypeId === 'i94')).toBe(true)
  })
  it('no real candidates ⇒ fail-closed unknown', () => {
    expect(arbitrateDocType([]).docTypeId).toBe('unknown')
    expect(arbitrateDocType([{ provider: 'openai', docTypeId: 'unknown', confidence: 0 }]).docTypeId).toBe('unknown')
  })
})

describe('reviewPolicyForType — registry-driven review', () => {
  it('soviet birth cert always review + HTR-unavailable when no host', () => {
    const r = reviewPolicyForType('ua_birth_certificate_soviet', { handwritingPresent: null, docTypeConfidence: 1, providerDisagreement: false, htrAvailable: false })
    expect(r.reviewRequired).toBe(true)
    expect(r.reasonCodes).toContain('handwriting_present')
    expect(r.reasonCodes).toContain('provider_unavailable')
  })
  it('modern birth cert only forces review if handwriting present', () => {
    const noHw = reviewPolicyForType('ua_birth_certificate_modern', { handwritingPresent: false, docTypeConfidence: 0.99, providerDisagreement: false, htrAvailable: true })
    expect(noHw.reasonCodes).not.toContain('handwriting_present')
    const hw = reviewPolicyForType('ua_birth_certificate_modern', { handwritingPresent: true, docTypeConfidence: 0.99, providerDisagreement: false, htrAvailable: true })
    expect(hw.reasonCodes).toContain('handwriting_present')
  })
  it('low confidence forces review', () => {
    const r = reviewPolicyForType('passport', { handwritingPresent: false, docTypeConfidence: 0.5, providerDisagreement: false, htrAvailable: true })
    expect(r.reviewRequired).toBe(true)
    expect(r.reasonCodes).toContain('below_route_confidence')
  })
  it('provider disagreement forces review', () => {
    const r = reviewPolicyForType('passport', { handwritingPresent: false, docTypeConfidence: 0.99, providerDisagreement: true, htrAvailable: true })
    expect(r.reasonCodes).toContain('single_provider_classification')
  })
  it('unknown always review', () => {
    expect(reviewPolicyForType('unknown', { handwritingPresent: null, docTypeConfidence: 0, providerDisagreement: false, htrAvailable: false }).reviewRequired).toBe(true)
  })
  it('clean printed passport, agreed, confident, HTR n/a ⇒ no review', () => {
    const r = reviewPolicyForType('passport', { handwritingPresent: false, docTypeConfidence: 0.99, providerDisagreement: false, htrAvailable: true })
    expect(r.reviewRequired).toBe(false)
    expect(r.reasonCodes).toEqual([])
  })
})
