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
  return sharp(Buffer.from(`<svg width="1000" height="1000"><rect width="1000" height="1000" fill="#f4f1ea"/><path d="M0 40 q 60 -20 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0" stroke="#222" stroke-width="4" fill="none"/><path d="M0 100 q 60 -20 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0" stroke="#222" stroke-width="4" fill="none"/><path d="M0 160 q 60 -20 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0" stroke="#222" stroke-width="4" fill="none"/><path d="M0 220 q 60 -20 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0" stroke="#222" stroke-width="4" fill="none"/><path d="M0 280 q 60 -20 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0" stroke="#222" stroke-width="4" fill="none"/><path d="M0 340 q 60 -20 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0" stroke="#222" stroke-width="4" fill="none"/><path d="M0 400 q 60 -20 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0" stroke="#222" stroke-width="4" fill="none"/><path d="M0 460 q 60 -20 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0" stroke="#222" stroke-width="4" fill="none"/><path d="M0 520 q 60 -20 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0" stroke="#222" stroke-width="4" fill="none"/><path d="M0 580 q 60 -20 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0" stroke="#222" stroke-width="4" fill="none"/><path d="M0 640 q 60 -20 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0" stroke="#222" stroke-width="4" fill="none"/><path d="M0 700 q 60 -20 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0" stroke="#222" stroke-width="4" fill="none"/><path d="M0 760 q 60 -20 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0" stroke="#222" stroke-width="4" fill="none"/><path d="M0 820 q 60 -20 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0" stroke="#222" stroke-width="4" fill="none"/><path d="M0 880 q 60 -20 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0" stroke="#222" stroke-width="4" fill="none"/><path d="M0 940 q 60 -20 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0" stroke="#222" stroke-width="4" fill="none"/></svg>`)).png().toBuffer()  // inked: blank gate (§7) must PASS test crops
}

describe('readDocument → htr_only:* (LLM read FAILED, HTR reads field-first) — integration', () => {
  it('LLM 503 + HTR sidecar configured → status htr_only, handwritten names read field-first + review-gated', async () => {
    process.env.HTR_SIDECAR_URL = 'http://127.0.0.1:8077'
    delete process.env.GEMINI_API_KEY; delete process.env.GEMINI_API_KEY_PAY // force the NON-LLM template localizer
    // sidecar /read mock → a Cyrillic read; (Gemini bbox is never called — template localizes)
    global.fetch = vi.fn(async (url: string) => {
      if (String(url).includes('/read')) return new Response(JSON.stringify({ text: 'Соловьяк', confidence: 0.95 }), { status: 200 })
      throw new Error('no Gemini expected: ' + url)
    }) as unknown as typeof fetch

    const img = await png()
    const res = await readDocument(img, 'image/png', 'ua_birth_certificate', { provider: failingProvider, originalBuffer: img })

    expect(res.status.startsWith('htr_only')).toBe(true) // the LLM-independent path ran
    // ua_birth_certificate's registry uses 'child_family_name' (not the bare box-template key
    // 'family_name') — HTR_FIELD_KEY_ALIASES (2026-07-06 fix) remaps the HTR read onto the real
    // registry key; asserting the bare key here would silently re-introduce the orphan-key bug
    // this fix closed (found live: the HTR route produced correct reads that never reached output).
    const fam = res.fields.find((f) => f.field === 'child_family_name')
    expect(fam).toBeTruthy()
    expect((fam!.raw_cyrillic ?? '').length).toBeGreaterThan(0) // read field-first by HTR
    expect(fam!.review_required).toBe(true)                     // always review-gated
    expect(res.fields.find((f) => f.field === 'family_name')).toBeUndefined() // no orphan bare-key row
  })

  it('ua_birth_certificate_soviet (item 5, 2026-07-06) — same field-key aliasing as the shared ' +
     'ua_birth_certificate registry, since HTR_FIELD_KEY_ALIASES/HTR_COMBINE_FIELDS are exact-key ' +
     'lookups and needed their own entry for this docTypeId', async () => {
    process.env.HTR_SIDECAR_URL = 'http://127.0.0.1:8077'
    delete process.env.GEMINI_API_KEY; delete process.env.GEMINI_API_KEY_PAY
    global.fetch = vi.fn(async (url: string) => {
      if (String(url).includes('/read')) return new Response(JSON.stringify({ text: 'Соловьяк', confidence: 0.95 }), { status: 200 })
      throw new Error('no Gemini expected: ' + url)
    }) as unknown as typeof fetch

    const img = await png()
    const res = await readDocument(img, 'image/png', 'ua_birth_certificate_soviet', { provider: failingProvider, originalBuffer: img })

    expect(res.status.startsWith('htr_only')).toBe(true)
    const fam = res.fields.find((f) => f.field === 'child_family_name')
    expect(fam).toBeTruthy()
    expect((fam!.raw_cyrillic ?? '').length).toBeGreaterThan(0)
    expect(fam!.review_required).toBe(true)
    expect(res.fields.find((f) => f.field === 'family_name')).toBeUndefined()
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

  it('2026-07-06: father_full_name is COMBINED from father_given_name+father_patronymic boxes ' +
    '(single registry field, unlike the child\'s 3-way split) — surname borrowed from the ' +
    'ALREADY-corrected child_family_name, per HTR_COMBINE_FIELDS', async () => {
    process.env.HTR_SIDECAR_URL = 'http://127.0.0.1:8077'
    delete process.env.GEMINI_API_KEY; delete process.env.GEMINI_API_KEY_PAY
    // FIELD_BOX_TEMPLATES.ua_birth_certificate order: family_name, given_name, patronymic,
    // father_given_name, father_patronymic, mother_given_patronymic — matches the sidecar call
    // order below.
    const texts = ['Соловьяк', 'Іван', 'Іванович', 'Петро', 'Петрович', 'Олена Іванівна']
    let i = 0
    global.fetch = vi.fn(async (url: string) => {
      if (String(url).includes('/read')) return new Response(JSON.stringify({ text: texts[i++], confidence: 0.9 }), { status: 200 })
      throw new Error('no Gemini expected: ' + url)
    }) as unknown as typeof fetch

    const img = await png()
    const res = await readDocument(img, 'image/png', 'ua_birth_certificate', { provider: failingProvider, originalBuffer: img })

    const father = res.fields.find((f) => f.field === 'father_full_name')
    expect(father).toBeTruthy()
    expect(father!.raw_cyrillic).toBe('Соловьяк Петро Петрович') // corrected child surname + father's own given+patronymic
    expect(father!.review_required).toBe(true)
    expect(father!.review_reasons).toContain('handwritten_htr_combined')
    // item 2 (2026-07-06): mother_full_name is ALSO combined now — a SINGLE given+patronymic box
    // (unlike father's two separate boxes; a two-box split live-tested worse for this row) plus
    // the same borrowed child surname.
    const mother = res.fields.find((f) => f.field === 'mother_full_name')
    expect(mother).toBeTruthy()
    expect(mother!.raw_cyrillic).toBe('Соловьяк Олена Іванівна')
    expect(mother!.review_required).toBe(true)
    expect(mother!.review_reasons).toContain('handwritten_htr_combined')
  })
})
