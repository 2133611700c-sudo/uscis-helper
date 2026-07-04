/**
 * ONE-BRAIN v2 Phase 6c — registryLookup wired as an issuing-AUTHORITY signal.
 * The registry family (translatePassportAuthority/resolveAbbreviation) was RESERVED with
 * zero consumers; now it feeds the evaluator as a SUGGESTION-only signal. Assertions use
 * entries that REALLY exist in registry.generated.ts (verified) — no invented matches.
 */
import { describe, it, expect } from 'vitest'
import { evaluateAuthoritySignal } from '../knowledgeEvaluator'

describe('evaluateAuthoritySignal — registry as suggestion-only signal', () => {
  it('known passport authority (registry row) → official EN suggestion + provenance', () => {
    const s = evaluateAuthoritySignal('issuing_authority', 'Державна міграційна служба')
    expect(s.status).toBe('match')
    expect(s.suggestedEn).toBe('State Migration Service of Ukraine')
    expect(s.provenance).toBe('registry_authority')
    expect(s.confidence).toBeGreaterThan(0.9)
  })

  it('unknown authority → no_match, SILENT (absence from registry ≠ error → no review)', () => {
    const s = evaluateAuthoritySignal('issuing_authority', 'Vyhadana Ustanova 999')
    expect(s.status).toBe('no_match')
    expect(s.reviewRequired).toBe(false)
    expect(s.suggestedEn).toBeNull()
  })

  it('non-authority field keys → no_rule (signal cannot touch other fields)', () => {
    for (const k of ['family_name', 'dob', 'passport_number']) {
      expect(evaluateAuthoritySignal(k, 'Державна міграційна служба').status).toBe('no_rule')
    }
  })

  it('empty value → no_match silent', () => {
    const s = evaluateAuthoritySignal('issuing_authority', '')
    expect(s.status).toBe('no_match')
    expect(s.reviewRequired).toBe(false)
  })

  it('is suggestion-only: result carries suggestedEn, never a rewritten field value shape', () => {
    const s = evaluateAuthoritySignal('issuing_authority', 'Державна міграційна служба')
    expect(Object.keys(s).sort()).toEqual(
      ['confidence', 'normalizedUk', 'provenance', 'reviewRequired', 'status', 'suggestedEn'],
    )
  })
})
