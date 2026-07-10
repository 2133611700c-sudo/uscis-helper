/**
 * shadowRunner.test.ts — Phase 7 shadow integration mechanism. Pure, mock providers.
 */
import { describe, it, expect, vi } from 'vitest'
import { runIntakeShadow, isIntakeShadowEnabled, type ShadowCompareInput } from '../shadowRunner'
import type { IntakeProviders } from '../documentIntakeBrain'

const providers = (): IntakeProviders => ({
  preflight: async () => ({ isDocument: true, mediaType: 'image', pageCount: 1, isFullPage: true, quality: 'ok', isDuplicate: false, provider: null, timingMs: 0 }),
  orient: async () => ({ rotationAppliedCw: 0, telemetryStatus: 'fallback_measured', provider: 'openai', measured: true, trusted: false, timingMs: 1 }),
  language: async () => ({ primary: 'mixed', scripts: ['cyrillic'], languageMode: 'bilingual', printedTextPresent: true, handwritingPresent: true, confidence: 1, provider: 'openai', measured: true }),
  country: async () => ({ country: 'SU', issuingSystem: 'soviet_legacy', confidence: 1, evidence: 'cue', provider: 'openai', measured: true }),
  classify: async () => ({ docTypeId: 'ua_birth_certificate_soviet', family: 'civil_record', candidates: [], confidence: 1, provider: 'openai', measured: true }),
})
const input: ShadowCompareInput = { service: 'translation', declaredDocTypeId: 'ua_birth_certificate_soviet' }
const buf = Buffer.from('x')

describe('shadow flag gate', () => {
  it('OFF by default (byte-identical no-op)', () => {
    expect(isIntakeShadowEnabled({})).toBe(false)
    expect(isIntakeShadowEnabled({ ONE_BRAIN_INTAKE_SHADOW: '1' })).toBe(true)
  })
  it('flag OFF ⇒ ran:false, no provider called, no log', async () => {
    const spy = vi.fn()
    const called = vi.fn(async () => ({ isDocument: true, mediaType: 'image' as const, pageCount: 1, isFullPage: true, quality: 'ok' as const, isDuplicate: false, provider: null, timingMs: 0 }))
    const obs = await runIntakeShadow(buf, { ...providers(), preflight: called }, input, { env: {}, log: spy })
    expect(obs.ran).toBe(false)
    expect(called).not.toHaveBeenCalled()
    expect(spy).not.toHaveBeenCalled()
  })
})

describe('shadow ON — observes, never affects, PII-free', () => {
  it('runs the brain, compares to the declared hint, logs PII-safe', async () => {
    const logs: Array<{ marker: string; payload: any }> = []
    const obs = await runIntakeShadow(buf, providers(), input, { env: { ONE_BRAIN_INTAKE_SHADOW: '1' }, log: (marker, payload) => logs.push({ marker, payload }) })
    expect(obs.ran).toBe(true)
    expect(obs.brainDocTypeId).toBe('ua_birth_certificate_soviet')
    expect(obs.typeMatchesDeclared).toBe(true)
    expect(obs.intakeStatus).toBe('needs_review')
    expect(logs[0].marker).toBe('[one_brain_intake_shadow]')
    // PII-safe: the logged intake carries no value-bearing raw fields
    expect(JSON.stringify(logs[0].payload)).not.toMatch(/rawValue|raw_cyrillic/)
  })
  it('flags a mismatch when declared hint disagrees with the brain', async () => {
    const obs = await runIntakeShadow(buf, providers(), { service: 'tps', declaredDocTypeId: 'passport' }, { env: { ONE_BRAIN_INTAKE_SHADOW: '1' } })
    expect(obs.typeMatchesDeclared).toBe(false)
  })
  it('fail-open: a throwing provider never breaks the caller', async () => {
    const bad = { ...providers(), classify: async () => { throw new Error('boom') } }
    // classify throwing is handled inside analyzeIntake (step failed) — shadow still returns ran:true
    const obs = await runIntakeShadow(buf, bad, input, { env: { ONE_BRAIN_INTAKE_SHADOW: '1' } })
    expect(obs.ran).toBe(true)
    expect(['unknown', 'needs_review']).toContain(obs.intakeStatus)
  })
})
