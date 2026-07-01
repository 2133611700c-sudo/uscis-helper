/**
 * googleVisionEvidenceProvider — EVIDENCE-ONLY contract tests.
 *
 * Verifies the real (drop-in) Google-Vision-backed provider:
 *   (a) ok OcrResult with matching words → { status: 'available' } + exact/combined regions
 *   (b) blocked (no creds / 403 billing)  → { status: 'unavailable', reason: 'provider_error' }
 *   (c) extractText throws                → { status: 'unavailable' } (never throws)
 *   (d) ok OcrResult, no matching words   → { status: 'unavailable', reason: 'no_geometry' }
 * Plus the evidence-only guard: the result exposes ONLY regionsByField/status/reason —
 * NEVER a value/candidate/confidence field (it never reads or decides a field value).
 *
 * FICTIONAL data only (no real PII).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { OcrResult, OcrWord, OcrBlockedResult, OcrProviderErrorResult } from '@/lib/ocr/types'

const extractText = vi.fn()

vi.mock('@/lib/ocr/providers/google-vision', () => ({
  googleVisionProvider: {
    extractText: (...args: unknown[]) => extractText(...args),
  },
}))

// Import AFTER the mock is registered.
import { googleVisionEvidenceProvider } from '../googleVisionEvidenceProvider'

// ── Fixtures (fictional) ────────────────────────────────────────────────────
function word(id: string, text: string, x: number, y: number): OcrWord {
  return {
    id,
    text,
    page: 1,
    bbox: { x, y, width: 0.1, height: 0.03 },
    confidence: 0.99,
    source: 'google_vision',
  }
}

/** OcrResult whose tokens contain the field values below (fictional person). */
function okOcrResult(words: OcrWord[]): OcrResult {
  return {
    provider: 'google_vision',
    raw_text: words.map((w) => w.text).join(' '),
    pages: [{ page: 1, width: 1000, height: 1400, lines: [], words }],
    lines: [],
    words,
    processing_ms: 42,
    warnings: [],
    created_at: '2026-06-30T00:00:00.000Z',
  }
}

const blockedResult: OcrBlockedResult = {
  blocked: true,
  reason: 'Google Cloud Vision credentials are not configured.',
  required_env_vars: ['GOOGLE_VISION_SERVICE_ACCOUNT_JSON'],
}

const providerErrorResult: OcrProviderErrorResult = {
  provider_error: true,
  error: {
    ok: false,
    error_code: 'OCR_BILLING_DISABLED',
    retryable: false,
    message: 'Recognition is temporarily unavailable.',
    detail: 'http_403',
  },
}

const DOC = { buffer: Buffer.from('fictional-image-bytes'), mime: 'image/jpeg' as const }

beforeEach(() => {
  extractText.mockReset()
})

describe('googleVisionEvidenceProvider — evidence-only locator', () => {
  it('(a) ok OcrResult with matching words → available, with exact + combined regions', async () => {
    // Fictional value "Shevchuk" = single token → 'exact';
    // "Mariia Petrivna" = two contiguous tokens → 'combined' (union bbox).
    const words = [
      word('w_0000', 'Shevchuk', 0.1, 0.2),
      word('w_0001', 'Mariia', 0.1, 0.3),
      word('w_0002', 'Petrivna', 0.21, 0.3),
    ]
    extractText.mockResolvedValue(okOcrResult(words))

    const res = await googleVisionEvidenceProvider.locateEvidence({
      document: DOC,
      fields: [
        { key: 'family_name', value: 'Shevchuk' },
        { key: 'given_name', value: 'Mariia Petrivna' },
      ],
    })

    expect(res.status).toBe('available')
    if (res.status !== 'available') throw new Error('unreachable')

    // Passed the caller's document buffer/mime straight through to the provider.
    expect(extractText).toHaveBeenCalledWith({ imageBuffer: DOC.buffer, mimeType: DOC.mime })

    // family_name: single token → exact.
    expect(res.regionsByField.family_name).toHaveLength(1)
    expect(res.regionsByField.family_name[0]).toMatchObject({
      fieldKey: 'family_name',
      status: 'exact',
      source: 'ocr_token',
      page: 1,
    })
    {
      const b = res.regionsByField.family_name[0].bbox!
      expect(b[0]).toBeCloseTo(0.1, 10)
      expect(b[1]).toBeCloseTo(0.2, 10)
      expect(b[2]).toBeCloseTo(0.2, 10)
      expect(b[3]).toBeCloseTo(0.23, 10)
    }

    // given_name: two contiguous tokens → combined (union of both bboxes).
    expect(res.regionsByField.given_name).toHaveLength(1)
    expect(res.regionsByField.given_name[0]).toMatchObject({
      fieldKey: 'given_name',
      status: 'combined',
      source: 'ocr_token',
      page: 1,
    })
    // union of [0.1,0.3,0.2,0.33] and [0.21,0.3,0.31,0.33]
    {
      const b = res.regionsByField.given_name[0].bbox!
      expect(b[0]).toBeCloseTo(0.1, 10)
      expect(b[1]).toBeCloseTo(0.3, 10)
      expect(b[2]).toBeCloseTo(0.31, 10)
      expect(b[3]).toBeCloseTo(0.33, 10)
    }
  })

  it('(b) blocked (no creds / 403 billing) → unavailable / provider_error (never throws)', async () => {
    extractText.mockResolvedValue(blockedResult)

    const res = await googleVisionEvidenceProvider.locateEvidence({
      document: DOC,
      fields: [{ key: 'family_name', value: 'Shevchuk' }],
    })

    expect(res).toEqual({ status: 'unavailable', reason: 'provider_error' })
  })

  it('(b2) typed provider error (429/5xx/403/timeout) → unavailable / provider_error', async () => {
    extractText.mockResolvedValue(providerErrorResult)

    const res = await googleVisionEvidenceProvider.locateEvidence({
      document: DOC,
      fields: [{ key: 'family_name', value: 'Shevchuk' }],
    })

    expect(res).toEqual({ status: 'unavailable', reason: 'provider_error' })
  })

  it('(c) extractText throws → unavailable (fail-open, never throws)', async () => {
    extractText.mockRejectedValue(new Error('network exploded'))

    const res = await googleVisionEvidenceProvider.locateEvidence({
      document: DOC,
      fields: [{ key: 'family_name', value: 'Shevchuk' }],
    })

    expect(res.status).toBe('unavailable')
  })

  it('(d) ok OcrResult with NO matching words → unavailable / no_geometry', async () => {
    // OCR read succeeded but none of its tokens match the requested value.
    extractText.mockResolvedValue(okOcrResult([word('w_0000', 'Koval', 0.5, 0.5)]))

    const res = await googleVisionEvidenceProvider.locateEvidence({
      document: DOC,
      fields: [{ key: 'family_name', value: 'Shevchuk' }],
    })

    expect(res).toEqual({ status: 'unavailable', reason: 'no_geometry' })
  })

  it('evidence-only guard: result has NO value/candidate/confidence — only regionsByField/status/reason', async () => {
    extractText.mockResolvedValue(okOcrResult([word('w_0000', 'Shevchuk', 0.1, 0.2)]))

    const res = await googleVisionEvidenceProvider.locateEvidence({
      document: DOC,
      fields: [{ key: 'family_name', value: 'Shevchuk' }],
    })

    // Top-level result shape is a closed evidence contract.
    expect(Object.keys(res).sort()).toEqual(['regionsByField', 'status'])
    expect(res).not.toHaveProperty('value')
    expect(res).not.toHaveProperty('candidate')
    expect(res).not.toHaveProperty('confidence')

    // Each region is pure geometry — it never carries a field value or a semantic score.
    if (res.status !== 'available') throw new Error('unreachable')
    for (const regions of Object.values(res.regionsByField)) {
      for (const r of regions) {
        expect(r).not.toHaveProperty('value')
        expect(r).not.toHaveProperty('candidate')
        expect(r).not.toHaveProperty('confidence')
        // Only the EvidenceRegion geometry keys are present.
        expect(Object.keys(r).sort()).toEqual(['bbox', 'fieldKey', 'page', 'source', 'status'])
      }
    }
  })
})
