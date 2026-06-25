import { describe, it, expect, vi, afterEach } from 'vitest'
import { readDocument } from '../documentFieldReader'
import type { VisionProvider } from '../types'

const RF = global.fetch
const RU = process.env.HTR_SIDECAR_URL
const RK = process.env.GEMINI_API_KEY
const RK2 = process.env.GEMINI_API_KEY_PAY

afterEach(() => {
  global.fetch = RF
  for (const [k, v] of [['HTR_SIDECAR_URL', RU], ['GEMINI_API_KEY', RK], ['GEMINI_API_KEY_PAY', RK2]] as const) {
    if (v === undefined) delete process.env[k]; else process.env[k] = v
  }
  vi.restoreAllMocks()
})

// A provider whose vision read FAILS (LLM 503) → read.ok=false → the early-return path runs.
const failingProvider: VisionProvider = {
  name: 'mock-fail',
  async readFields() {
    return { ok: false, fields: [], model: 'mock', ms: 1, error: 'HTTP 503 UNAVAILABLE', errorStatus: 503 }
  },
}

async function png() {
  const sharp = (await import('sharp')).default
  return sharp({ create: { width: 1000, height: 1000, channels: 3, background: { r: 250, g: 250, b: 250 } } }).png().toBuffer()
}

describe('readDocument → htr_only:* (LLM read FAILED, HTR reads field-first) — integration', () => {
  it('LLM 503 + HTR sidecar configured → status htr_only, handwritten names read field-first + review-gated', async () => {
    process.env.HTR_SIDECAR_URL = 'http://127.0.0.1:8077'
    delete process.env.GEMINI_API_KEY; delete process.env.GEMINI_API_KEY_PAY // force the NON-LLM template localizer
    // sidecar /read mock → a Cyrillic read; (Gemini bbox is never called — template localizes)
    global.fetch = vi.fn(async (url: string) => {
      if (String(url).includes('/read')) return new Response(JSON.stringify({ text: 'Куропятник', confidence: 0.95 }), { status: 200 })
      throw new Error('no Gemini expected: ' + url)
    }) as unknown as typeof fetch

    const img = await png()
    const res = await readDocument(img, 'image/png', 'ua_birth_certificate', { provider: failingProvider, originalBuffer: img })

    expect(res.status.startsWith('htr_only')).toBe(true) // the LLM-independent path ran
    const fam = res.fields.find((f) => f.field === 'family_name')
    expect(fam).toBeTruthy()
    expect((fam!.raw_cyrillic ?? '').length).toBeGreaterThan(0) // read field-first by HTR
    expect(fam!.review_required).toBe(true)                     // always review-gated
  })

  it('LLM 503 + HTR sidecar DOWN → FAIL-CLOSED (vision_failed, no fabricated value)', async () => {
    process.env.HTR_SIDECAR_URL = 'http://127.0.0.1:8077'
    delete process.env.GEMINI_API_KEY; delete process.env.GEMINI_API_KEY_PAY
    global.fetch = vi.fn(async () => { throw new Error('sidecar down') }) as unknown as typeof fetch
    const img = await png()
    const res = await readDocument(img, 'image/png', 'ua_birth_certificate', { provider: failingProvider, originalBuffer: img })
    // HTR produced nothing → no htr_only; falls through to honest vision_failed (NOT a fabricated value)
    expect(res.status.startsWith('htr_only')).toBe(false)
    expect(res.status.startsWith('vision_failed')).toBe(true)
    expect(res.fields).toEqual([])
  })
})
