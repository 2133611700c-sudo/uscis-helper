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
  return sharp(Buffer.from(`<svg width="1000" height="1000"><rect width="1000" height="1000" fill="#f4f1ea"/><path d="M0 40 q 60 -20 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0" stroke="#222" stroke-width="4" fill="none"/><path d="M0 100 q 60 -20 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0" stroke="#222" stroke-width="4" fill="none"/><path d="M0 160 q 60 -20 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0" stroke="#222" stroke-width="4" fill="none"/><path d="M0 220 q 60 -20 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0" stroke="#222" stroke-width="4" fill="none"/><path d="M0 280 q 60 -20 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0" stroke="#222" stroke-width="4" fill="none"/><path d="M0 340 q 60 -20 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0" stroke="#222" stroke-width="4" fill="none"/><path d="M0 400 q 60 -20 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0" stroke="#222" stroke-width="4" fill="none"/><path d="M0 460 q 60 -20 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0" stroke="#222" stroke-width="4" fill="none"/><path d="M0 520 q 60 -20 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0" stroke="#222" stroke-width="4" fill="none"/><path d="M0 580 q 60 -20 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0" stroke="#222" stroke-width="4" fill="none"/><path d="M0 640 q 60 -20 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0" stroke="#222" stroke-width="4" fill="none"/><path d="M0 700 q 60 -20 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0" stroke="#222" stroke-width="4" fill="none"/><path d="M0 760 q 60 -20 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0" stroke="#222" stroke-width="4" fill="none"/><path d="M0 820 q 60 -20 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0" stroke="#222" stroke-width="4" fill="none"/><path d="M0 880 q 60 -20 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0" stroke="#222" stroke-width="4" fill="none"/><path d="M0 940 q 60 -20 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0" stroke="#222" stroke-width="4" fill="none"/></svg>`)).png().toBuffer()  // inked strokes: the blank gate (§7) must PASS test crops
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

  it('localizeHandwrittenFields returns [] without a Gemini key (and no template/override)', async () => {
    delete process.env.GEMINI_API_KEY_PAY; delete process.env.GEMINI_API_KEY
    expect(await localizeHandwrittenFields(await pngImage(), 'image/png')).toEqual([])
  })

  it('NON-LLM TEMPLATE localizes without Gemini (deterministic, scaled to image dims)', async () => {
    delete process.env.GEMINI_API_KEY_PAY; delete process.env.GEMINI_API_KEY; delete process.env.HTR_FIELD_BOXES
    const fetchSpy = vi.fn(); global.fetch = fetchSpy as unknown as typeof fetch
    const boxes = await localizeHandwrittenFields(await pngImage(), 'image/png', 'ua_birth_certificate') // 1000x1000
    expect(boxes.map((b) => b.field).sort()).toEqual(['family_name', 'father_given_name', 'father_patronymic', 'given_name', 'mother_given_patronymic', 'patronymic'])
    expect(boxes.find((b) => b.field === 'family_name')!.box).toEqual([233, 228, 545, 292]) // 0.2326*1000 etc.
    expect(boxes.find((b) => b.field === 'patronymic')!.box).toEqual([264, 292, 448, 362]) // tuned from the real cert proof
    expect(fetchSpy).not.toHaveBeenCalled() // NO Gemini call — deterministic template
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
    mockBoth({ fields: [{ label: 'surname', box: [100, 200, 200, 600] }] }, ['Соловьяк'])
    const out = await readHandwrittenRoute(await pngImage(), 'image/png')
    expect(out).toHaveLength(1)
    const f = out[0]
    expect(f.field).toBe('family_name')
    expect(f.raw_htr_text).toBe('Соловьяк')      // read_quality
    expect(f.htr_confidence).toBe(0.95)             // read_quality
    expect(f.normalized_value).toBe('Соловьяк')   // normalization (codex downstream)
    expect(f.review_required).toBe(true)            // review — raxtemur can't abstain → always gated
    expect(f.review_reason).toBe('handwritten_htr_read')
  })

  it('ROOT-CAUSE FIX (2026-07-06): contentOrientCw actually rotates the buffer before localizing/' +
    'cropping — EXIF-bake-only was NOT enough (live-measured on birth_cert_handwritten_01.jpg: ' +
    'garbled/wrong HTR reads on the EXIF-only buffer vs exact-match reads on the same boxes against ' +
    'the fully content-orient-corrected buffer). A non-square image proves the rotation is applied: ' +
    'the NON-LLM template box lands in a different absolute pixel region once rotated.', async () => {
    delete process.env.GEMINI_API_KEY_PAY; delete process.env.GEMINI_API_KEY; delete process.env.HTR_FIELD_BOXES
    const sharp = (await import('sharp')).default
    // Wide (non-square, INKED so the mandatory blank-crop gate passes) image so width/height swap
    // under a 90°/270° rotation is observable.
    const wide = await sharp(await pngImage()).extend({ bottom: 500, background: '#f4f1ea' }).png().toBuffer() // 1000x1500

    const noRotation = await localizeHandwrittenFields(wide, 'image/png', 'ua_birth_certificate')
    const rotated = await sharp(wide).rotate(90).toBuffer()
    const preRotatedBoxes = await localizeHandwrittenFields(rotated, 'image/png', 'ua_birth_certificate')

    // Boxes computed against the ALREADY-ROTATED (500x1000) buffer must differ from boxes computed
    // against the original (1000x500) buffer — proving dimension-dependent scaling actually engages.
    expect(noRotation.find((b) => b.field === 'family_name')!.box)
      .not.toEqual(preRotatedBoxes.find((b) => b.field === 'family_name')!.box)

    // readHandwrittenRoute's own contentOrientCw plumbing: passing a nonzero angle must not throw
    // and must still run the full localize→crop→read pipeline (sidecar path) on the rotated buffer.
    process.env.HTR_SIDECAR_URL = 'http://127.0.0.1:8077'
    global.fetch = vi.fn(async (url: string) => {
      if (String(url).includes('/read')) return new Response(JSON.stringify({ text: 'X', confidence: 0.95 }), { status: 200 })
      throw new Error('unexpected fetch: ' + url)
    }) as unknown as typeof fetch
    const outNoRotate = await readHandwrittenRoute(wide, 'image/png', 'ua_birth_certificate', 0)
    const outWithRotate = await readHandwrittenRoute(wide, 'image/png', 'ua_birth_certificate', 90)
    expect(outNoRotate.length).toBeGreaterThan(0)
    expect(outWithRotate.length).toBeGreaterThan(0)
  })
})
