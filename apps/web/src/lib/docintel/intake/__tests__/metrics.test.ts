/**
 * metrics.test.ts — Phase 9 flip criteria / no-trust-without-metrics. Pure.
 */
import { describe, it, expect } from 'vitest'
import { canClaimTrust, deriveStatusLabel, assertTrustedRequiresMetrics, birthCertSovietPilotScorecard, MIN_N_FOR_TRUST, type Scorecard } from '../metrics'

const good = (o: Partial<Scorecard> = {}): Scorecard => ({
  subject: 'passport', n: 30, accuracy: 0.97, handwrittenFields: false, handwrittenGtBattery: false,
  providerBlockedExternal: false, reviewRequiredPrecision: 0.9, label: 'PARTIAL', ...o,
})

describe('canClaimTrust — fail-closed flip gate', () => {
  it('good printed subject (N≥25, acc≥0.95, not blocked) can flip', () => {
    expect(canClaimTrust(good()).canFlip).toBe(true)
  })
  it('insufficient N blocks', () => {
    expect(canClaimTrust(good({ n: 3 })).blockers.join(' ')).toMatch(/insufficient_n_3/)
  })
  it('unmeasured accuracy blocks', () => {
    expect(canClaimTrust(good({ accuracy: null })).blockers).toContain('accuracy_not_measured')
  })
  it('handwritten without GT battery blocks', () => {
    expect(canClaimTrust(good({ handwrittenFields: true, handwrittenGtBattery: false })).blockers).toContain('handwritten_without_gt_battery')
  })
  it('blocked-external provider can never count as pass', () => {
    expect(canClaimTrust(good({ providerBlockedExternal: true })).blockers).toContain('provider_blocked_external')
  })
})

describe('assertTrustedRequiresMetrics', () => {
  it('trusted claim with no metrics is a violation', () => {
    expect(assertTrustedRequiresMetrics(true, null).length).toBeGreaterThan(0)
  })
  it('trusted claim below threshold is a violation', () => {
    expect(assertTrustedRequiresMetrics(true, good({ n: 2 })).length).toBeGreaterThan(0)
  })
  it('trusted claim meeting metrics passes', () => {
    expect(assertTrustedRequiresMetrics(true, good())).toEqual([])
  })
  it('not-trusted needs no metrics', () => {
    expect(assertTrustedRequiresMetrics(false, null)).toEqual([])
  })
})

describe('deriveStatusLabel — honest labels', () => {
  it('blocked external → BLOCKED_EXTERNAL', () => {
    expect(deriveStatusLabel(good({ providerBlockedExternal: true }))).toBe('BLOCKED_EXTERNAL')
  })
  it('unmeasured → UNVERIFIED', () => {
    expect(deriveStatusLabel(good({ accuracy: null }))).toBe('UNVERIFIED')
  })
  it('N<3 → UNVERIFIED', () => {
    expect(deriveStatusLabel(good({ n: 1 }))).toBe('UNVERIFIED')
  })
  it('good full metrics → LIVE', () => {
    expect(deriveStatusLabel(good())).toBe('LIVE')
  })
  it('the soviet birth cert pilot is BLOCKED_EXTERNAL, never trusted', () => {
    const sc = birthCertSovietPilotScorecard()
    expect(deriveStatusLabel(sc)).toBe('BLOCKED_EXTERNAL')
    expect(canClaimTrust(sc).canFlip).toBe(false)
    expect(MIN_N_FOR_TRUST).toBe(25)
  })
})
