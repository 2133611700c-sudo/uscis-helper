import { describe, it, expect, vi, afterEach } from 'vitest'
import { localizeHandwrittenFields, readHandwrittenRoute } from '../handwrittenFieldRoute'

const RF = global.fetch
const RU = process.env.HTR_SIDECAR_URL
const RK = process.env.GEMINI_API_KEY_PAY
const RK2 = process.env.GEMINI_API_KEY

afterEach(() => {
  global.fetch = RF
  for (const [k, v] of [['HTR_SIDECAR_URL', RU], ['GEMINI_API_KEY_PAY', RK], ['GEMINI_API_KEY', RK2]] as const) {
    if (v === undefined) delete process.env[k]; else process.env[k] = v
  }
  vi.restoreAllMocks()
})

async function pngImage() {
  const sharp = (await import('sharp')).default
  return sharp({ create: { width: 1000, height: 1000, channels: 3, background: { r: 250, g: 250, b: 250 } } }).png().toBuffer()
}

// route Gemini-localizer vs sidecar /read by URL
function mockBoth(geminiJson: unknown, sidecarTexts: string[]) {
  let i = 0
  global.fetch = vi.fn(async (url: string) => {
    if (String(url).includes('generativelanguage')) {
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(geminiJson) }] } }] }), { status: 200 })
    }
    return new Response(JSON.stringify({ text: sidecarTexts[i++], confidence: 0.95 }), { status: 200 })
  }) as unknown as typeof fetch
}

describe('handwrittenFieldRoute — field-first HTR route (ADR-026), OFF by default', () => {
  it('readHandwrittenRoute is DISABLED when HTR_SIDECAR_URL is unset', async () => {
    delete process.env.HTR_SIDECAR_URL
    process.env.GEMINI_API_KEY_PAY = 'k'
    const fetchSpy = vi.fn(); global.fetch = fetchSpy as unknown as typeof fetch
    expect(await readHandwrittenRoute(await pngImage(), 'image/png')).toEqual([])
    expect(fetchSpy).not.toHaveBeenCalled() // no network when the sidecar is not configured
  })

  it('localizeHandwrittenFields returns [] without a Gemini key', async () => {
    delete process.env.GEMINI_API_KEY_PAY; delete process.env.GEMINI_API_KEY
    expect(await localizeHandwrittenFields(await pngImage(), 'image/png')).toEqual([])
  })

  it('localizeHandwrittenFields maps labels + converts 0-1000 boxes to pixels', async () => {
    process.env.GEMINI_API_KEY_PAY = 'k'
    mockBoth({ fields: [{ label: 'surname', box: [100, 200, 200, 600] }, { label: 'given', box: [220, 200, 300, 500] }] }, [])
    const boxes = await localizeHandwrittenFields(await pngImage(), 'image/png') // 1000x1000 → normalized==pixels
    expect(boxes).toEqual([
      { field: 'family_name', box: [200, 100, 600, 200] }, // [left,top,right,bottom] from [ymin,xmin,ymax,xmax]
      { field: 'given_name', box: [200, 220, 500, 300] },
    ])
  })

  it('end-to-end: localize → native crop → HTR read → 3 SEPARATED layers, review-gated', async () => {
    process.env.HTR_SIDECAR_URL = 'http://127.0.0.1:8077'
    process.env.GEMINI_API_KEY_PAY = 'k'
    mockBoth({ fields: [{ label: 'surname', box: [100, 200, 200, 600] }] }, ['Куропятник'])
    const out = await readHandwrittenRoute(await pngImage(), 'image/png')
    expect(out).toHaveLength(1)
    const f = out[0]
    expect(f.field).toBe('family_name')
    expect(f.raw_htr_text).toBe('Куропятник')      // read_quality
    expect(f.htr_confidence).toBe(0.95)             // read_quality
    expect(f.normalized_value).toBe('Куропятник')   // normalization (codex downstream)
    expect(f.review_required).toBe(true)            // review — raxtemur can't abstain → always gated
    expect(f.review_reason).toBe('handwritten_htr_read')
  })
})
