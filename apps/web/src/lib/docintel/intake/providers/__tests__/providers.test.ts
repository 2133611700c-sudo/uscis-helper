/**
 * providers.test.ts — Phase 4 provider adapters (rule/anchor classifier + availability).
 * Pure, no network. PII-safe (anchors are printed FORM strings, not document values).
 */
import { describe, it, expect } from 'vitest'
import { classifyByAnchors } from '../ruleAnchorClassifier'
import { providerAvailability, isProviderUsable, firstUsableProvider } from '../availability'

describe('ruleAnchorClassifier — deterministic printed-anchor proposal', () => {
  it('matches a soviet birth certificate by its printed headers', () => {
    const text = 'СВИДЕТЕЛЬСТВО О РОЖДЕНИИ СВІДОЦТВО ПРО НАРОДЖЕННЯ ... УССР ... РОДИТЕЛИ ...'
    const r = classifyByAnchors(text)
    expect(r.docTypeId).toBe('ua_birth_certificate_soviet')
    expect(r.confidence).toBeGreaterThan(0)
    expect(r.matchedAnchors.length).toBeGreaterThan(0)
  })
  it('matches an I-94 by its printed anchors', () => {
    const r = classifyByAnchors('Department of Homeland Security I-94 Admission Record Class of Admission Admit Until Date')
    expect(r.docTypeId).toBe('i94')
  })
  it('honors country scoping (allowed set)', () => {
    // soviet-birth text but only US types allowed ⇒ no match ⇒ unknown
    const r = classifyByAnchors('СВИДЕТЕЛЬСТВО О РОЖДЕНИИ УССР', ['i94', 'ead_card', 'us_drivers_license'])
    expect(r.docTypeId).toBe('unknown')
    expect(r.confidence).toBe(0)
  })
  it('no anchor hit ⇒ fail-closed unknown', () => {
    const r = classifyByAnchors('random text with no document anchors at all')
    expect(r.docTypeId).toBe('unknown')
    expect(r.candidates).toEqual([])
  })
  it('is deterministic (same input → same output)', () => {
    const t = 'I-797 Notice of Action Receipt Number USCIS'
    expect(classifyByAnchors(t)).toEqual(classifyByAnchors(t))
    expect(classifyByAnchors(t).docTypeId).toBe('i797_notice')
  })
})

describe('provider availability — no silent passes', () => {
  it('google_vision availability is credential-driven (billing paid, re-measured 2026-07-08)', () => {
    // No creds → unavailable (not a standing external blocker anymore).
    const gvNone = providerAvailability({}).find((p) => p.provider === 'google_vision')
    expect(gvNone?.availability).toBe('unavailable')
    expect(isProviderUsable('google_vision', {})).toBe(false)
    // Creds present (any accepted env name) → available.
    expect(isProviderUsable('google_vision', { GOOGLE_VISION_SERVICE_ACCOUNT_JSON: 'present' })).toBe(true)
    expect(isProviderUsable('google_vision', { GOOGLE_APPLICATION_CREDENTIALS: '/path/sa.json' })).toBe(true)
  })
  it('tesseract is runtime_unsafe on Vercel, available locally', () => {
    expect(providerAvailability({ VERCEL: '1' }).find((p) => p.provider === 'tesseract')?.availability).toBe('runtime_unsafe')
    expect(providerAvailability({}).find((p) => p.provider === 'tesseract')?.availability).toBe('available')
  })
  it('htr is our own self-hosted model → unavailable (not blocked_external) until wired', () => {
    const st = providerAvailability({}).find((p) => p.provider === 'htr')
    expect(st?.availability).toBe('unavailable') // our own capability, not a third-party dep
    expect(isProviderUsable('htr', {})).toBe(false)
    expect(isProviderUsable('htr', { HTR_ENDPOINT_URL: 'https://our-own-htr.internal' })).toBe(true)
  })
  it('openai usable only with a key', () => {
    expect(isProviderUsable('openai', {})).toBe(false)
    expect(isProviderUsable('openai', { OPENAI_API_KEY: 'sk-x' })).toBe(true)
  })
  it('rule provider is always available (deterministic)', () => {
    expect(isProviderUsable('rule', {})).toBe(true)
  })
  it('firstUsableProvider skips blocked/unavailable and returns the first usable', () => {
    // registry soviet-birth priority is [htr, gemini, openai]; htr blocked, gemini none, openai key present
    expect(firstUsableProvider(['htr', 'gemini', 'openai'], { OPENAI_API_KEY: 'sk-x' })).toBe('openai')
    // nothing usable ⇒ null
    expect(firstUsableProvider(['htr', 'google_vision'], {})).toBeNull()
  })
})
