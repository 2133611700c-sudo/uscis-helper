/**
 * READER_PROVIDER temporary override: route ALL reads through GPT vision while the
 * Gemini quota is exhausted. Default (unset) = Gemini (byte-identical). No network.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { selectDefaultVisionProvider } from '../documentFieldReader'

afterEach(() => { delete process.env.READER_PROVIDER; delete process.env.READER_PROVIDER_FORCE_HANDWRITTEN })

describe('selectDefaultVisionProvider — temporary GPT route', () => {
  it('defaults to the Gemini provider (byte-identical when unset)', () => {
    delete process.env.READER_PROVIDER
    expect(selectDefaultVisionProvider().name).toBe('gemini')
  })
  it('READER_PROVIDER=openai → GPT vision provider', () => {
    process.env.READER_PROVIDER = 'openai'
    expect(selectDefaultVisionProvider('ua_international_passport').name).toBe('openai')
  })
  it('any other value → Gemini (safe default)', () => {
    process.env.READER_PROVIDER = 'something'
    expect(selectDefaultVisionProvider().name).toBe('gemini')
  })
  it('never routes handwritten/certificate families to OpenAI (default)', () => {
    process.env.READER_PROVIDER = 'openai'
    expect(selectDefaultVisionProvider('ua_birth_certificate').name).toBe('gemini')
    expect(selectDefaultVisionProvider('ua_marriage_certificate').name).toBe('gemini')
  })
  it('TEST-ONLY: READER_PROVIDER_FORCE_HANDWRITTEN=1 also routes handwritten to OpenAI (measure fabrication)', () => {
    process.env.READER_PROVIDER = 'openai'
    process.env.READER_PROVIDER_FORCE_HANDWRITTEN = '1'
    expect(selectDefaultVisionProvider('ua_birth_certificate').name).toBe('openai')
  })
  it('force-handwritten flag is inert unless READER_PROVIDER=openai too', () => {
    delete process.env.READER_PROVIDER
    process.env.READER_PROVIDER_FORCE_HANDWRITTEN = '1'
    expect(selectDefaultVisionProvider('ua_birth_certificate').name).toBe('gemini')
  })
})
