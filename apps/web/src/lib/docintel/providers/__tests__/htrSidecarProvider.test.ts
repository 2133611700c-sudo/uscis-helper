import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  isHtrSidecarEnabled,
  readFieldCrop,
  readHandwrittenFieldsViaSidecar,
} from '../htrSidecarProvider'

const REAL_FETCH = global.fetch
const REAL_URL = process.env.HTR_SIDECAR_URL

afterEach(() => {
  global.fetch = REAL_FETCH
  if (REAL_URL === undefined) delete process.env.HTR_SIDECAR_URL
  else process.env.HTR_SIDECAR_URL = REAL_URL
  vi.restoreAllMocks()
})

describe('htrSidecarProvider — field-first handwriting reader (ADR-026), OFF by default', () => {
  it('is DISABLED when HTR_SIDECAR_URL is unset → no behaviour change', async () => {
    delete process.env.HTR_SIDECAR_URL
    const fetchSpy = vi.fn()
    global.fetch = fetchSpy as unknown as typeof fetch
    expect(isHtrSidecarEnabled()).toBe(false)
    expect(await readFieldCrop(Buffer.from('x'))).toBeNull()
    expect(await readHandwrittenFieldsViaSidecar(Buffer.from('x'), [{ field: 'family_name', box: [0, 0, 10, 10] }])).toEqual([])
    expect(fetchSpy).not.toHaveBeenCalled() // never touches the network when disabled
  })

  it('reads ONE field crop via the sidecar when enabled', async () => {
    process.env.HTR_SIDECAR_URL = 'http://127.0.0.1:8077'
    global.fetch = vi.fn(async () => new Response(JSON.stringify({ text: 'Соловьяк', confidence: 0.96 }), { status: 200 })) as unknown as typeof fetch
    const r = await readFieldCrop(Buffer.from('png-bytes'))
    expect(r).toEqual({ field: '', text: 'Соловьяк', confidence: 0.96 })
  })

  it('fail-safe: a sidecar error / non-200 → null (pipeline keeps the LLM read + review)', async () => {
    process.env.HTR_SIDECAR_URL = 'http://127.0.0.1:8077'
    global.fetch = vi.fn(async () => new Response('err', { status: 503 })) as unknown as typeof fetch
    expect(await readFieldCrop(Buffer.from('x'))).toBeNull()
    global.fetch = vi.fn(async () => { throw new Error('network down') }) as unknown as typeof fetch
    expect(await readFieldCrop(Buffer.from('x'))).toBeNull()
  })

  it('field-first: crops each box at native res and returns per-field reads (enabled)', async () => {
    process.env.HTR_SIDECAR_URL = 'http://127.0.0.1:8077'
    // a real 60x30 white PNG so sharp.extract succeeds
    const sharp = (await import('sharp')).default
    const img = await sharp({ create: { width: 60, height: 30, channels: 3, background: { r: 250, g: 250, b: 250 } } }).png().toBuffer()
    const reads = ['Соловьяк', 'Сергій']
    let i = 0
    global.fetch = vi.fn(async () => new Response(JSON.stringify({ text: reads[i++], confidence: 0.9 }), { status: 200 })) as unknown as typeof fetch
    const out = await readHandwrittenFieldsViaSidecar(img, [
      { field: 'family_name', box: [0, 0, 30, 30] },
      { field: 'given_name', box: [30, 0, 60, 30] },
    ])
    expect(out.map((r) => r.field)).toEqual(['family_name', 'given_name'])
    expect(out.map((r) => r.text)).toEqual(['Соловьяк', 'Сергій'])
  })
})
