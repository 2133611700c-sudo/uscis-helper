/**
 * detectLanguageCountry.test.ts — ordered One Brain nodes #2 (language) + #3 (country).
 * Pure fail-closed contract; mocked vision call. No network.
 */
import { describe, it, expect } from 'vitest'
import {
  normalizeLanguage, normalizeCountry, detectLanguage, detectCountry,
  countryToTypePrefixes, buildLanguagePrompt, buildCountryPrompt,
  LANG_MIN_CONFIDENCE, COUNTRY_MIN_CONFIDENCE,
} from '../detectLanguageCountry'

describe('normalizeLanguage — fail-closed', () => {
  it('accepts a specific language above threshold', () => {
    expect(normalizeLanguage({ language: 'uk', scripts_seen: ['cyrillic'], confidence: 0.9 }).language).toBe('uk')
  })
  it('specific language below threshold ⇒ unknown', () => {
    expect(normalizeLanguage({ language: 'ru', confidence: 0.3 }).language).toBe('unknown')
  })
  it('mixed is allowed at any confidence (it IS the honest bilingual answer)', () => {
    expect(normalizeLanguage({ language: 'mixed', confidence: 0.5 }).language).toBe('mixed')
  })
  it('invalid language ⇒ unknown', () => {
    expect(normalizeLanguage({ language: 'klingon', confidence: 0.99 }).language).toBe('unknown')
  })
})

describe('normalizeCountry — fail-closed', () => {
  it('accepts a specific country above threshold', () => {
    expect(normalizeCountry({ country: 'SU', confidence: 0.95, evidence: 'УССР' }).country).toBe('SU')
  })
  it('specific country below threshold ⇒ unknown', () => {
    expect(normalizeCountry({ country: 'UA', confidence: 0.2 }).country).toBe('unknown')
  })
  it('preserves evidence + confidence for audit', () => {
    const r = normalizeCountry({ country: 'US', confidence: 0.9, evidence: 'I-94' })
    expect(r.evidence).toBe('I-94'); expect(r.confidence).toBe(0.9)
  })
})

describe('countryToTypePrefixes — the funnel that scopes TYPE by country', () => {
  it('UA and SU both reach ua_ types', () => {
    expect(countryToTypePrefixes('UA')).toEqual(['ua_'])
    expect(countryToTypePrefixes('SU')).toEqual(['ua_'])
  })
  it('US reaches us_ types', () => { expect(countryToTypePrefixes('US')).toEqual(['us_']) })
  it('unknown ⇒ no scoping (all candidates / ask human)', () => {
    expect(countryToTypePrefixes('unknown')).toEqual([])
    expect(countryToTypePrefixes('other')).toEqual([])
  })
})

describe('detect* — provider failure = fail-closed', () => {
  const img = Buffer.from('x')
  it('language: throw ⇒ unknown/measured:false', async () => {
    expect(await detectLanguage(img, async () => { throw new Error('x') })).toMatchObject({ language: 'unknown', measured: false })
  })
  it('country: null ⇒ unknown/measured:false', async () => {
    expect(await detectCountry(img, async () => null)).toMatchObject({ country: 'unknown', measured: false })
  })
  it('language: parses fenced json', async () => {
    const r = await detectLanguage(img, async () => '```json\n{"language":"mixed","scripts_seen":["cyrillic"],"confidence":0.9}\n```')
    expect(r.language).toBe('mixed')
  })
})

describe('prompts: printed for language, plus handwriting-presence signal', () => {
  it('both prompts reference printed + handwriting', () => {
    for (const p of [buildLanguagePrompt(), buildCountryPrompt()]) {
      expect(p.toLowerCase()).toContain('printed')
      expect(p.toLowerCase()).toContain('handwrit')
    }
  })
  it('language prompt asks for the handwriting_present signal', () => {
    expect(buildLanguagePrompt()).toContain('handwriting_present')
  })
})

describe('#4a — handwriting/printed presence signal (fail-closed)', () => {
  it('extracts real booleans from the model', () => {
    const r = normalizeLanguage({ language: 'mixed', confidence: 0.9, printed_text_present: true, handwriting_present: true })
    expect(r.printedTextPresent).toBe(true)
    expect(r.handwritingPresent).toBe(true)
  })
  it('handwriting_present false stays false', () => {
    expect(normalizeLanguage({ language: 'en', confidence: 0.9, handwriting_present: false }).handwritingPresent).toBe(false)
  })
  it('absent / non-boolean → null (never a guess)', () => {
    expect(normalizeLanguage({ language: 'uk', confidence: 0.9 }).handwritingPresent).toBeNull()
    expect(normalizeLanguage({ language: 'uk', confidence: 0.9, handwriting_present: 'yes' }).handwritingPresent).toBeNull()
    expect(normalizeLanguage({ language: 'uk', confidence: 0.9 }).printedTextPresent).toBeNull()
  })
})
