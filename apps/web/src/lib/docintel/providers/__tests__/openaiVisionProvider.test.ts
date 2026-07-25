/**
 * openaiVisionProvider.test.ts — the OpenAI resilience fallback reader.
 * Covers: environment-aware flag policy, JSON parse into VisionFieldRead[], HTTP-error → errorStatus,
 * timeout → errorTimeout, and missing key → honest error (never throws into the caller).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { openaiVisionProvider, isReaderFallbackEnabled } from '../openaiVisionProvider'
import type { DocTypeSpec } from '../../types'
import fs from 'node:fs'
import path from 'node:path'

const SPEC = {
  title_en: 'Soviet birth certificate', script: 'cyrillic',
  fields: [
    { field: 'child_name', label_uk: "ім'я дитини", kind: 'name' },
    { field: 'birth_date', label_uk: 'дата народження', kind: 'date' },
  ],
} as unknown as DocTypeSpec

const img = Buffer.from('fake-image-bytes')

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); delete process.env.OPENAI_API_KEY })

describe('reader fallback flag', () => {
  it('defaults OFF outside production and ON in production with an explicit kill switch', () => {
    expect(isReaderFallbackEnabled({})).toBe(false)
    expect(isReaderFallbackEnabled({ ONE_BRAIN_READER_FALLBACK: '1' })).toBe(true)
    expect(isReaderFallbackEnabled({ VERCEL_ENV: 'production' })).toBe(true)
    expect(isReaderFallbackEnabled({
      VERCEL_ENV: 'production',
      ONE_BRAIN_READER_FALLBACK: '0',
    })).toBe(false)
  })
})

describe('openaiVisionProvider.readFields', () => {
  it('no OPENAI_API_KEY → honest error, no throw', async () => {
    const r = await openaiVisionProvider.readFields(img, 'image/jpeg', SPEC)
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/OPENAI_API_KEY/)
  })

  it('parses the model JSON into VisionFieldRead[] (only allowed keys)', async () => {
    process.env.OPENAI_API_KEY = 'sk-test'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ choices: [{ message: { content: JSON.stringify({
        child_name: { cyrillic: 'Тарас', can_read: true, confidence: 0.6, reason: 'hand' },
        birth_date: { cyrillic: '', iso_date: '1970-01-02', can_read: true, confidence: 0.5, reason: 'ok' },
        NOT_IN_SPEC: { cyrillic: 'x', can_read: true, confidence: 1, reason: '' },
      }) } }] }),
    } as unknown as Response))
    const r = await openaiVisionProvider.readFields(img, 'image/jpeg', SPEC)
    expect(r.ok).toBe(true)
    expect(r.model).toBeTruthy()
    expect(r.fields.map((f) => f.field).sort()).toEqual(['birth_date', 'child_name']) // NOT_IN_SPEC dropped
    expect(r.fields.find((f) => f.field === 'child_name')?.cyrillic).toBe('Тарас')
  })

  it('HTTP error → ok:false + errorStatus (so the reader can classify it)', async () => {
    process.env.OPENAI_API_KEY = 'sk-test'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 429, json: async () => ({}) } as unknown as Response))
    const r = await openaiVisionProvider.readFields(img, 'image/jpeg', SPEC)
    expect(r.ok).toBe(false)
    expect(r.errorStatus).toBe(429)
  })

  it('abort/timeout → ok:false + errorTimeout, never throws', async () => {
    process.env.OPENAI_API_KEY = 'sk-test'
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(Object.assign(new Error('aborted'), { name: 'AbortError' })))
    const r = await openaiVisionProvider.readFields(img, 'image/jpeg', SPEC)
    expect(r.ok).toBe(false)
    expect(r.errorTimeout).toBe(true)
  })
})

describe('documentFieldReader — fallback wiring is safe (source-guard)', () => {
  const SRC = fs.readFileSync(path.resolve(__dirname, '..', '..', 'documentFieldReader.ts'), 'utf-8')
  it('fallback is gated by the flag AND only when no provider injected AND only on retriable failure', () => {
    expect(SRC).toMatch(/if \(!read\.ok && !opts\.provider && isReaderFallbackEnabled\(\)\)/)
    expect(SRC).toMatch(/const retriable =/)
  })
  it('exactly one OpenAI fallback read, in a try/catch (never crashes the primary path)', () => {
    // the fallback passes openaiVisionProvider to coordinatedDocumentRead exactly once (call-site,
    // not counting the named import / module path)
    expect((SRC.match(/docTypeId, openaiVisionProvider/g) ?? []).length).toBe(1)
    const block = SRC.slice(SRC.indexOf('READER RESILIENCE'))
    expect(block).toMatch(/try \{/)
    expect(block).toMatch(/\} catch/)
  })
})
