/**
 * visionBboxLocator tests — fail-open + correct status mapping.
 * Fictional data only (no real PII; bboxes/IDs invented).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { OcrResult, OcrBlockedResult } from '@/lib/ocr/types'

// Mock the Vision provider so no network/credentials are needed.
const extractText = vi.fn()
vi.mock('@/lib/ocr/providers/google-vision', () => ({
  googleVisionProvider: {
    extractText: (...args: unknown[]) => extractText(...args),
  },
}))

// Import AFTER the mock is registered.
import { locateFieldEvidence } from '../visionBboxLocator'

const IMG = Buffer.from('fake-jpeg-bytes')
const MIME = 'image/jpeg'

function okResult(words: OcrResult['words']): OcrResult {
  return {
    provider: 'google_vision',
    raw_text: words.map((w) => w.text).join(' '),
    pages: [],
    lines: [],
    words,
    processing_ms: 5,
    warnings: [],
    created_at: '2026-06-15T00:00:00.000Z',
  }
}

beforeEach(() => {
  extractText.mockReset()
})

describe('locateFieldEvidence — fail-open', () => {
  it('returns [] when Vision is BLOCKED (missing credentials)', async () => {
    const blocked: OcrBlockedResult = {
      blocked: true,
      reason: 'no creds',
      required_env_vars: ['GOOGLE_VISION_SERVICE_ACCOUNT_JSON'],
    }
    extractText.mockResolvedValue(blocked)

    const out = await locateFieldEvidence({
      imageBuffer: IMG,
      mimeType: MIME,
      fieldOcrIds: { family_name: ['w_0001'] },
    })
    expect(out).toEqual([])
  })

  it('returns [] on a typed provider error (e.g. 403 billing) — never throws', async () => {
    extractText.mockResolvedValue({
      provider_error: true,
      error: {
        ok: false,
        error_code: 'OCR_BILLING_DISABLED',
        retryable: false,
        message: 'Recognition is temporarily unavailable. Please try again later.',
        detail: 'http_403',
      },
    })

    const out = await locateFieldEvidence({
      imageBuffer: IMG,
      mimeType: MIME,
      fieldOcrIds: { family_name: ['w_0001'] },
    })
    expect(out).toEqual([])
  })

  it('returns [] when the provider THROWS', async () => {
    extractText.mockRejectedValue(new Error('boom'))

    const out = await locateFieldEvidence({
      imageBuffer: IMG,
      mimeType: MIME,
      fieldOcrIds: { family_name: ['w_0001'] },
    })
    expect(out).toEqual([])
  })

  it('returns [] when no field map is provided', async () => {
    extractText.mockResolvedValue(okResult([]))
    const out = await locateFieldEvidence({ imageBuffer: IMG, mimeType: MIME })
    expect(out).toEqual([])
    // Provider need not even be consulted, but must not throw.
  })

  it('returns [] on a successful-but-empty read (no words/lines)', async () => {
    extractText.mockResolvedValue(okResult([]))
    const out = await locateFieldEvidence({
      imageBuffer: IMG,
      mimeType: MIME,
      fieldOcrIds: { family_name: ['w_0001'] },
    })
    expect(out).toEqual([])
  })
})

describe('locateFieldEvidence — status mapping', () => {
  it('single resolved ID → exact / ocr_token with bbox', async () => {
    extractText.mockResolvedValue(
      okResult([
        {
          id: 'w_0001',
          text: 'Shevchenko',
          page: 1,
          bbox: { x: 0.1, y: 0.2, width: 0.3, height: 0.05 },
          source: 'google_vision',
        },
      ]),
    )

    const out = await locateFieldEvidence({
      imageBuffer: IMG,
      mimeType: MIME,
      fieldOcrIds: { family_name: ['w_0001'] },
    })

    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({
      fieldKey: 'family_name',
      status: 'exact',
      source: 'ocr_token',
      page: 1,
    })
    // [x0,y0,x1,y1] = [x, y, x+width, y+height]
    const bbox = out[0].bbox!
    expect(bbox[0]).toBeCloseTo(0.1)
    expect(bbox[1]).toBeCloseTo(0.2)
    expect(bbox[2]).toBeCloseTo(0.4)
    expect(bbox[3]).toBeCloseTo(0.25)
  })

  it('multiple resolved IDs → combined / ocr_token with union bbox', async () => {
    extractText.mockResolvedValue(
      okResult([
        {
          id: 'w_0001',
          text: 'Taras',
          page: 1,
          bbox: { x: 0.1, y: 0.2, width: 0.2, height: 0.05 },
          source: 'google_vision',
        },
        {
          id: 'w_0002',
          text: 'Hryhorovych',
          page: 1,
          bbox: { x: 0.35, y: 0.2, width: 0.25, height: 0.05 },
          source: 'google_vision',
        },
      ]),
    )

    const out = await locateFieldEvidence({
      imageBuffer: IMG,
      mimeType: MIME,
      fieldOcrIds: { given_names: ['w_0001', 'w_0002'] },
    })

    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({
      fieldKey: 'given_names',
      status: 'combined',
      source: 'ocr_token',
    })
    // union: x0=0.1, y0=0.2, x1=max(0.3, 0.6)=0.6, y1=0.25
    expect(out[0].bbox?.[0]).toBeCloseTo(0.1)
    expect(out[0].bbox?.[2]).toBeCloseTo(0.6)
  })

  it('unknown ID → missing region (bbox null, source none)', async () => {
    extractText.mockResolvedValue(
      okResult([
        {
          id: 'w_0001',
          text: 'present',
          page: 1,
          bbox: { x: 0.1, y: 0.2, width: 0.2, height: 0.05 },
          source: 'google_vision',
        },
      ]),
    )

    const out = await locateFieldEvidence({
      imageBuffer: IMG,
      mimeType: MIME,
      fieldOcrIds: { date_of_birth: ['w_9999'] },
    })

    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({
      fieldKey: 'date_of_birth',
      status: 'missing',
      source: 'none',
      bbox: null,
    })
  })

  it('handles several fields at once with mixed statuses', async () => {
    extractText.mockResolvedValue(
      okResult([
        {
          id: 'w_0001',
          text: 'A',
          page: 1,
          bbox: { x: 0.1, y: 0.1, width: 0.1, height: 0.05 },
          source: 'google_vision',
        },
      ]),
    )

    const out = await locateFieldEvidence({
      imageBuffer: IMG,
      mimeType: MIME,
      fieldOcrIds: {
        family_name: ['w_0001'], // exact
        sex: ['w_0002'], // unknown → missing
      },
    })

    expect(out).toHaveLength(2)
    const byKey = Object.fromEntries(out.map((r) => [r.fieldKey, r]))
    expect(byKey.family_name.status).toBe('exact')
    expect(byKey.sex.status).toBe('missing')
  })
})
