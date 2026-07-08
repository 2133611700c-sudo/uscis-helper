/**
 * documentIntakeBrain.test.ts — Phase 3 orchestrator: order, funnel, gating, fail-closed.
 * Pure: mocked providers, no network.
 */
import { describe, it, expect } from 'vitest'
import { analyzeIntake, canonicalTypesForCountry, resolveReaderRouteFromRegistry, type IntakeProviders } from '../documentIntakeBrain'
import { intakeReadyForRecognition, isTrustworthy } from '../contracts'
import { isTraceComplete } from '../trace'

const buf = Buffer.from('img')

// A soviet-birth-certificate mock (the real proven case), fully measured.
const sovietBirthProviders = (over: Partial<IntakeProviders> = {}): IntakeProviders => ({
  preflight: async () => ({ isDocument: true, mediaType: 'image', pageCount: 1, isFullPage: true, quality: 'ok', isDuplicate: false, provider: 'openai', timingMs: 1 }),
  orient: async () => ({ rotationAppliedCw: 0, telemetryStatus: 'fallback_measured', provider: 'openai', measured: true, trusted: false, timingMs: 5 }),
  language: async () => ({ primary: 'mixed', scripts: ['cyrillic'], languageMode: 'bilingual', printedTextPresent: true, handwritingPresent: true, confidence: 1, provider: 'openai', measured: true, timingMs: 6 }),
  country: async () => ({ country: 'SU', issuingSystem: 'soviet_legacy', confidence: 1, evidence: 'printed-emblem-hash', provider: 'openai', measured: true, timingMs: 6 }),
  classify: async (_b, allowed) => ({ docTypeId: 'ua_birth_certificate_soviet', family: 'civil_record', candidates: [{ doc_type_id: 'ua_birth_certificate_soviet', confidence: 1 }], confidence: 1, provider: 'openai', measured: true, timingMs: 7 }),
  ...over,
})

describe('funnel helpers', () => {
  it('country scopes types (SU/UA → ua_ + civil; US → us_ types)', () => {
    const su = canonicalTypesForCountry('SU')
    expect(su).toContain('ua_birth_certificate_soviet')
    expect(su).not.toContain('i94')
    const us = canonicalTypesForCountry('US')
    expect(us).toContain('i94'); expect(us).toContain('us_drivers_license')
    expect(us).not.toContain('ua_birth_certificate_soviet')
  })
  it('UNKNOWN country widens to all real types', () => {
    const all = canonicalTypesForCountry('UNKNOWN')
    expect(all).toContain('i94'); expect(all).toContain('ua_birth_certificate_soviet')
    expect(all).not.toContain('unknown') // pseudo-types excluded
  })
  it('reader route + policy come from the registry (soviet birth → civil reader, HTR, review)', () => {
    const r = resolveReaderRouteFromRegistry('ua_birth_certificate_soviet', true)
    expect(r.reader).toBe('civil_record_reader')
    expect(r.needsHTR).toBe(true) // force_review + htr externalBlocker
    expect(r.needsHumanReview).toBe(true)
  })
})

describe('ordered intake — the proven soviet birth certificate case', () => {
  it('orient→language→country→family→type in order; needs_review (handwriting); reader routed', async () => {
    const { result, trace } = await analyzeIntake(buf, sovietBirthProviders(), { traceId: 't' })
    expect(result.orientation.rotationAppliedCw).toBe(0)
    expect(result.language.primary).toBe('mixed')
    expect(result.country.country).toBe('SU')
    expect(result.family.family).toBe('civil_record')
    expect(result.docType.docTypeId).toBe('ua_birth_certificate_soviet')
    expect(result.route.reader).toBe('civil_record_reader')
    expect(result.route.needsHTR).toBe(true)
    expect(result.status).toBe('needs_review') // handwriting present
    expect(result.review.reasonCodes).toContain('handwriting_present')
    // recognition may run (needs_review still routes) but is held for review
    expect(intakeReadyForRecognition(result)).toBe(true)
    // trace has spans in order, PII-free, complete
    const names = trace.spans.map((s) => s.name)
    expect(names.indexOf('orientation')).toBeLessThan(names.indexOf('language'))
    expect(names.indexOf('language')).toBeLessThan(names.indexOf('country'))
    expect(names.indexOf('country')).toBeLessThan(names.indexOf('type'))
    expect(isTraceComplete(trace)).toBe(true)
  })
})

describe('fail-closed behaviors', () => {
  it('not-a-document → rejected, no recognition, downstream skipped', async () => {
    const providers = sovietBirthProviders({ preflight: async () => ({ isDocument: false, mediaType: 'image', pageCount: 1, isFullPage: true, quality: 'ok', isDuplicate: false, provider: 'openai', timingMs: 1 }) })
    const { result } = await analyzeIntake(buf, providers, {})
    expect(result.status).toBe('rejected')
    expect(intakeReadyForRecognition(result)).toBe(false)
    expect(result.docType.status).toBe('skipped')
  })
  it('unknown type → status unknown, reader unknown_reader, no recognition', async () => {
    const providers = sovietBirthProviders({
      country: async () => ({ country: 'UNKNOWN', issuingSystem: 'unknown', confidence: 0.2, evidence: null, provider: 'openai', measured: true, timingMs: 1 }),
      classify: async () => ({ docTypeId: 'unknown', family: 'unknown', candidates: [], confidence: 0.1, provider: 'openai', measured: true, timingMs: 1 }),
    })
    const { result } = await analyzeIntake(buf, providers, {})
    expect(result.status).toBe('unknown')
    expect(intakeReadyForRecognition(result)).toBe(false)
  })
  it('classify choosing a type NOT in the country-scoped allowed set → forced to unknown', async () => {
    // country SU scopes to ua_ types; a rogue classify returns i94 → must be rejected to unknown
    const providers = sovietBirthProviders({ classify: async () => ({ docTypeId: 'i94', family: 'us_immigration_record', candidates: [{ doc_type_id: 'i94', confidence: 0.9 }], confidence: 0.9, provider: 'openai', measured: true, timingMs: 1 }) })
    const { result } = await analyzeIntake(buf, providers, {})
    expect(result.docType.docTypeId).toBe('unknown') // registry constraint enforced
  })
  it('a provider that throws → that step failed, brain stays fail-closed', async () => {
    const providers = sovietBirthProviders({ classify: async () => { throw new Error('provider down') } })
    const { result, trace } = await analyzeIntake(buf, providers, {})
    expect(result.docType.status).toBe('failed')
    expect(result.status === 'unknown' || result.status === 'needs_review').toBe(true)
    expect(trace.spans.find((s) => s.name === 'type')?.status).toBe('failed')
  })
  it('orientation measured-by-fallback is NOT trusted (ADR-018) but does not block classification', async () => {
    const { result } = await analyzeIntake(buf, sovietBirthProviders(), {})
    expect(result.orientation.status).toBe('measured')
    expect(isTrustworthy(result.orientation)).toBe(false) // trusted:false (fallback provider)
    expect(result.docType.docTypeId).toBe('ua_birth_certificate_soviet') // still classified
  })
})

describe('user hint is weak evidence only', () => {
  it('a hint conflicting with the measured type is a review reason, never overrides', async () => {
    const { result } = await analyzeIntake(buf, sovietBirthProviders(), { userHint: { docTypeId: 'passport' } })
    expect(result.docType.docTypeId).toBe('ua_birth_certificate_soviet') // measured wins
    expect(result.review.reasonCodes).toContain('user_hint_conflicts_measured')
  })
})
