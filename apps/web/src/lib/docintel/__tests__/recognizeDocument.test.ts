/**
 * recognizeDocument — STEP D extraction parity (mock reader; no live Gemini).
 * Proves the extracted orchestrator composes the existing spine faithfully:
 * reads → candidates → fail-closed → arbitration → canonical result. Pure.
 */
import { describe, it, expect, vi } from 'vitest'
import { recognizeDocument } from '../recognizeDocument'
import type { ExtractedDocField } from '../types'

function field(over: Partial<ExtractedDocField>): ExtractedDocField {
  return {
    field: 'family_name', kind: 'name', raw_cyrillic: 'Іваненко', value: 'Ivanenko',
    confidence: 0.9, review_required: false, source: 'vision', provider: 'gemini', ...over,
  }
}
const okRead = (fields: ExtractedDocField[]) => ({ ok: true, doc_type_id: 'ua_birth_certificate', fields, status: 'ok', ms: 5 }) as never
const errRead = () => ({ ok: false, doc_type_id: 'ua_birth_certificate', fields: [], status: 'provider_error', ms: 5, provider_error: { error_code: 'RATE_LIMIT', http_status: 429 } }) as never

const PAGE = { buffer: Buffer.from('x'), mime: 'image/jpeg' }

describe('recognizeDocument — faithful spine extraction', () => {
  it('ok read → status ok, candidates flow into a canonical result, cyrillic preserved', async () => {
    const reader = vi.fn().mockResolvedValue(okRead([field({ field: 'family_name', raw_cyrillic: 'Іваненко' })]))
    const out = await recognizeDocument({ pages: [PAGE], docTypeId: 'ua_birth_certificate', product: 'translation', reader: reader as never })
    expect(out.status).toBe('ok')
    expect(out.canonicalResult).not.toBeNull()
    expect(out.canonicalResult!.fields.length).toBeGreaterThan(0)
    expect(out.cyrillicMap.size).toBeGreaterThan(0)
    // reader called with the docTypeId + product (faithful args)
    expect(reader).toHaveBeenCalledWith(PAGE.buffer, PAGE.mime, 'ua_birth_certificate', expect.objectContaining({ product: 'translation' }))
  })

  it('FAIL CLOSED: provider error + no candidates → unavailable, canonicalResult null', async () => {
    const reader = vi.fn().mockResolvedValue(errRead())
    const out = await recognizeDocument({ pages: [PAGE], docTypeId: 'ua_birth_certificate', product: 'tps', reader: reader as never })
    expect(out.status).toBe('unavailable')
    expect(out.canonicalResult).toBeNull()
    expect(out.providerErrors).toHaveLength(1)
  })

  it('multi-page: cyrillic map merges from every page; pageResults per page', async () => {
    const reader = vi.fn()
      .mockResolvedValueOnce(okRead([field({ field: 'family_name', raw_cyrillic: 'Іваненко' })]))
      .mockResolvedValueOnce(okRead([field({ field: 'given_name', raw_cyrillic: 'Олена', value: 'Olena' })]))
    const out = await recognizeDocument({ pages: [PAGE, PAGE], docTypeId: 'ua_birth_certificate', product: 'ead', reader: reader as never })
    expect(out.pageResults).toHaveLength(2)
    expect(out.cyrillicMap.size).toBeGreaterThanOrEqual(2)
  })

  it('extraCandidates (e.g. MRZ) are injected before arbitration', async () => {
    const reader = vi.fn().mockResolvedValue(okRead([]))
    const out = await recognizeDocument({
      pages: [PAGE], docTypeId: 'ua_international_passport', product: 'reparole',
      extraCandidates: [{ key: 'passport_number', value: 'MX481390', rawCyrillic: null, confidence: 0.99, page: 1 } as never],
      reader: reader as never,
    })
    expect(out.status).toBe('ok')
    // the injected candidate survives into the canonical result
    expect(out.canonicalResult?.fields.some((f) => f.key === 'passport_number')).toBe(true)
  })
})
