/**
 * visionExtractReviewExplainerRoute.test.ts
 *
 * Route proof for blueprint #5 prose helper wiring:
 *  - deterministic review_explanations remain the base layer;
 *  - DeepSeek prose is optional, strict-flagged, keys+codes only;
 *  - no prose is emitted when the deterministic base is OFF.
 *
 * FICTIONAL data only. Reader + preprocess are thin-seam mocked; no network spend.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ExtractedDocField } from '@/lib/docintel/types'

vi.mock('@/lib/security/rate-limit', () => ({
  rateLimit: vi.fn(async () => ({ allowed: true, resetAt: new Date(Date.now() + 60_000) })),
  getClientIP: () => '127.0.0.1',
}))

vi.mock('@/lib/ocr/image-preprocess', () => ({
  preprocessImage: vi.fn(async (buffer: Buffer, mime: string) => ({
    ok: true,
    buffer,
    mimeType: mime,
    width: 1500,
    height: 2000,
    exifOrientation: 1,
  })),
}))

const readerMock = vi.fn()
vi.mock('@/lib/docintel/documentFieldReader', () => ({
  readDocument: (...args: unknown[]) => readerMock(...args),
}))

const deepseekComposeReviewSummary = vi.fn()
vi.mock('@/lib/review/reviewExplainer', async () => {
  const actual = await vi.importActual<typeof import('@/lib/review/reviewExplainer')>('@/lib/review/reviewExplainer')
  return {
    ...actual,
    deepseekComposeReviewSummary: (...args: unknown[]) => deepseekComposeReviewSummary(...args),
  }
})

import { POST } from '../vision-extract/route'

function extractedField(over: Partial<ExtractedDocField> & { field: string }): ExtractedDocField {
  return {
    field: over.field,
    kind: over.kind ?? 'date',
    raw_cyrillic: over.raw_cyrillic ?? '01 січня 2030',
    value: over.value ?? '01/01/2030',
    confidence: over.confidence ?? 0.93,
    review_required: over.review_required ?? true,
    source: 'vision',
    provider: over.provider ?? 'mock-reader',
    review_reasons: over.review_reasons ?? ['zoom_mismatch'],
  }
}

function readerReturns(fields: ExtractedDocField[]) {
  readerMock.mockResolvedValue({
    ok: true,
    doc_type_id: 'mock',
    fields,
    anchor_read: true,
    provider: 'mock-reader',
    model: 'mock-model',
    ms: 5,
    status: 'ok',
  })
}

function makeRequest(): Request {
  const bytes = new Uint8Array(120_000)
  const fd = new FormData()
  fd.append('file', new Blob([bytes], { type: 'image/jpeg' }), 'doc.jpg')
  fd.append('docTypeId', 'ua_internal_passport_booklet')
  return new Request('http://localhost/api/translation/vision-extract', { method: 'POST', body: fd })
}

const ENV_KEYS = [
  'ONE_BRAIN_RECOGNIZE_ENABLED',
  'CANONICAL_CONTINUITY_MODE',
  'REVIEW_EXPLAINER_ENABLED',
  'DEEPSEEK_REVIEW_EXPLAINER',
] as const
const saved: Record<string, string | undefined> = {}

beforeEach(() => {
  for (const k of ENV_KEYS) saved[k] = process.env[k]
  readerMock.mockReset()
  deepseekComposeReviewSummary.mockReset()
  process.env.ONE_BRAIN_RECOGNIZE_ENABLED = '1'
  process.env.CANONICAL_CONTINUITY_MODE = 'off'
  delete process.env.REVIEW_EXPLAINER_ENABLED
  delete process.env.DEEPSEEK_REVIEW_EXPLAINER
})

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k]
    else process.env[k] = saved[k]
  }
})

describe('vision-extract review explainer wiring', () => {
  it('emits deterministic review_explanations when the base flag is ON', async () => {
    process.env.REVIEW_EXPLAINER_ENABLED = '1'
    readerReturns([extractedField({ field: 'dob' })])

    const res = await POST(makeRequest() as never)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.review_explanations).toHaveLength(1)
    expect(json.review_explanations[0].field).toBe('dob')
    expect(JSON.stringify(json.review_explanations[0].explanations)).toContain('DIFFERENT text')
    expect(json).not.toHaveProperty('review_summary')
    expect(deepseekComposeReviewSummary).not.toHaveBeenCalled()
  })

  it('emits optional review_summary only when both flags are ON', async () => {
    process.env.REVIEW_EXPLAINER_ENABLED = '1'
    process.env.DEEPSEEK_REVIEW_EXPLAINER = '1'
    deepseekComposeReviewSummary.mockResolvedValue('Check the date region first.')
    readerReturns([extractedField({ field: 'dob', review_reasons: ['zoom_mismatch'] })])

    const res = await POST(makeRequest() as never)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.review_explanations).toHaveLength(1)
    expect(json.review_summary).toBe('Check the date region first.')
    expect(deepseekComposeReviewSummary).toHaveBeenCalledTimes(1)
    expect(deepseekComposeReviewSummary.mock.calls[0][0]).toEqual([
      { field: 'dob', reasons: ['critical_no_mrz_anchor', 'zoom_mismatch'] },
    ])
  })

  it('does not emit prose when the deterministic base layer is OFF', async () => {
    process.env.DEEPSEEK_REVIEW_EXPLAINER = '1'
    deepseekComposeReviewSummary.mockResolvedValue('Should never appear.')
    readerReturns([extractedField({ field: 'dob' })])

    const res = await POST(makeRequest() as never)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).not.toHaveProperty('review_explanations')
    expect(json).not.toHaveProperty('review_summary')
    expect(deepseekComposeReviewSummary).not.toHaveBeenCalled()
  })
})
