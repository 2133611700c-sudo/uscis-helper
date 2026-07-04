/**
 * llmCropReader — LLM transport for the field-first handwriting route.
 * No network: fetch is injected. FICTIONAL data only.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import sharp from 'sharp'
import { isLlmCropReaderEnabled, readHandwrittenFieldsViaLlmCrops } from '../llmCropReader'
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
  return sharp({ create: { width: 200, height: 100, channels: 3, background: '#fff' } }).png().toBuffer()
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
