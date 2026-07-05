/**
 * llmCropReader — LLM transport for the field-first handwriting route.
 * No network: fetch is injected. FICTIONAL data only.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import sharp from 'sharp'
import { buildCropPrompt, isLlmCropReaderEnabled, readHandwrittenFieldsViaLlmCrops } from '../llmCropReader'
import { GAZETTEER } from '@uscis-helper/knowledge'
import type { HtrFieldBox } from '../htrSidecarProvider'

afterEach(() => {
  delete process.env.HANDWRITING_CROP_LLM
  delete process.env.GEMINI_API_KEY_TEST_ONLY
})

const geminiJson = (text: string) => ({
  ok: true,
  json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ text }) }] } }] }),
}) as unknown as Response

async function testImage(): Promise<Buffer> {
  // 200x100 white png — crops are real sharp extracts
  return sharp(Buffer.from(`<svg width="200" height="100"><rect width="200" height="100" fill="#f4f1ea"/><path d="M0 33 q 25 -25 50 0 t 50 0 t 50 0 t 50 0" stroke="#222" stroke-width="3" fill="none"/><path d="M0 66 q 25 25 50 0 t 50 0 t 50 0 t 50 0" stroke="#222" stroke-width="3" fill="none"/></svg>`)).png().toBuffer()  // inked strokes: the blank gate (§7) must PASS test crops
}
const BOXES: HtrFieldBox[] = [
  { field: 'family_name', box: [10, 10, 120, 40] },
  { field: 'given_name', box: [10, 50, 120, 80] },
]

describe('isLlmCropReaderEnabled — strict, gemini-only', () => {
  it("only 'gemini' enables; '1'/'true'/'openai'/absent stay OFF", () => {
    expect(isLlmCropReaderEnabled({})).toBe(false)
    expect(isLlmCropReaderEnabled({ HANDWRITING_CROP_LLM: '1' })).toBe(false)
    expect(isLlmCropReaderEnabled({ HANDWRITING_CROP_LLM: 'true' })).toBe(false)
    expect(isLlmCropReaderEnabled({ HANDWRITING_CROP_LLM: 'openai' })).toBe(false) // GPT owner-excluded on handwriting
    expect(isLlmCropReaderEnabled({ HANDWRITING_CROP_LLM: 'gemini' })).toBe(true)
  })
})

describe('buildCropPrompt — blueprint #4, NON-PRIMING knowledge hints', () => {
  it('field-kind hints attach by key; unknown keys get the base prompt', () => {
    expect(buildCropPrompt('child_patronymic')).toContain('PERSONAL NAME')
    expect(buildCropPrompt('dob')).toContain('DATE field')
    expect(buildCropPrompt('place_of_birth_city')).toContain('PLACE-NAME')
    expect(buildCropPrompt('passport_number')).toContain('DOCUMENT NUMBER')
    expect(buildCropPrompt('unknown_key')).not.toContain('field.')
    expect(buildCropPrompt('unknown_key')).toContain('Transcribe the handwriting EXACTLY')
  })

  it('name hint is ANTI-priming: forbids substituting a more common name', () => {
    expect(buildCropPrompt('family_name')).toContain('NEVER substitute a more common name')
  })

  it('the prompt NEVER carries lexicon values (no gazetteer entries → no fabrication priming)', () => {
    const prompts = ['family_name', 'place_of_birth_city', 'dob', 'passport_number'].map(buildCropPrompt)
    const sample = GAZETTEER.slice(0, 500)
    expect(sample.length).toBeGreaterThan(0)
    for (const p of prompts) {
      for (const settlement of sample) expect(p).not.toContain(settlement)
      expect(/[Ѐ-ӿ]/.test(p)).toBe(false) // no Cyrillic content of any kind in the prompt
    }
  })
})

describe('readHandwrittenFieldsViaLlmCrops', () => {
  it('flag OFF → no calls, [] (byte-identical)', async () => {
    const f = vi.fn()
    const out = await readHandwrittenFieldsViaLlmCrops(await testImage(), BOXES, f as never)
    expect(out).toEqual([])
    expect(f).not.toHaveBeenCalled()
  })

  it('flag ON + key → one tiny call per crop; texts land per field (fictional)', async () => {
    process.env.HANDWRITING_CROP_LLM = 'gemini'
    process.env.GEMINI_API_KEY_TEST_ONLY = 'fake-key-for-resolver'
    const f = vi.fn()
      .mockResolvedValueOnce(geminiJson('Тестенко'))
      .mockResolvedValueOnce(geminiJson('Іван'))
    const out = await readHandwrittenFieldsViaLlmCrops(await testImage(), BOXES, f as never)
    expect(f).toHaveBeenCalledTimes(2)
    expect(out).toEqual([
      { field: 'family_name', text: 'Тестенко', confidence: 0.6 },
      { field: 'given_name', text: 'Іван', confidence: 0.6 },
    ])
    // the call carried an inline PNG + the transcribe-exactly prompt
    const body = JSON.parse((f.mock.calls[0][1] as { body: string }).body)
    expect(body.contents[0].parts[1].inline_data.mime_type).toBe('image/png')
    expect(body.contents[0].parts[0].text).toMatch(/Do NOT transliterate/)
  })

  it('blank/unreadable ({"text":""}) → field omitted (never fabricates)', async () => {
    process.env.HANDWRITING_CROP_LLM = 'gemini'
    process.env.GEMINI_API_KEY_TEST_ONLY = 'fake'
    const f = vi.fn().mockResolvedValue(geminiJson(''))
    const out = await readHandwrittenFieldsViaLlmCrops(await testImage(), BOXES, f as never)
    expect(out).toEqual([])
  })

  it('per-crop 429/throw → that field skipped, others kept (fail-open)', async () => {
    process.env.HANDWRITING_CROP_LLM = 'gemini'
    process.env.GEMINI_API_KEY_TEST_ONLY = 'fake'
    const f = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 429 } as never)
      .mockResolvedValueOnce(geminiJson('Іван'))
    const out = await readHandwrittenFieldsViaLlmCrops(await testImage(), BOXES, f as never)
    expect(out).toEqual([{ field: 'given_name', text: 'Іван', confidence: 0.6 }])
  })

  it('no GEMINI_API_KEY* in env → [] without calling', async () => {
    process.env.HANDWRITING_CROP_LLM = 'gemini'
    const saved: Record<string, string | undefined> = {}
    for (const k of Object.keys(process.env)) if (k.startsWith('GEMINI_API_KEY')) { saved[k] = process.env[k]; delete process.env[k] }
    try {
      const f = vi.fn()
      const out = await readHandwrittenFieldsViaLlmCrops(await testImage(), BOXES, f as never)
      expect(out).toEqual([])
      expect(f).not.toHaveBeenCalled()
    } finally {
      for (const [k, v] of Object.entries(saved)) process.env[k] = v
    }
  })
})
