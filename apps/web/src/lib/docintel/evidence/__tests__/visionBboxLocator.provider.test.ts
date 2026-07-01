/**
 * visionBboxLocator — REAL-PROVIDER-GEOMETRY proof (One-Brain STEP E).
 *
 * PURPOSE: prove that Google Vision OCR-token geometry — the exact OcrResult shape
 * the REAL `googleVisionProvider.extractText` returns (tokens with `w_NNNN` ids +
 * normalized 0..1 bboxes derived from `verticesToBbox`) — flows through the
 * UNMODIFIED `locateFieldEvidence` and yields HONEST `EvidenceRegion[]`:
 *   - a single-token field  → status 'exact'    with a real 0..1 bbox
 *   - a multi-token field   → status 'combined' with the UNION bbox
 * and that when Vision is 403/blocked/throws (billing unavailable at runtime),
 * the locator FAILS OPEN → [] and never throws.
 *
 * We mock ONLY the provider boundary (no network/creds), feeding it a provider-shaped
 * OcrResult identical to what the real REST parser produces. Nothing in the
 * production code is touched. FICTIONAL data only (no real PII).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { OcrResult, OcrWord, OcrProviderErrorResult } from '@/lib/ocr/types'

// Mock the Vision provider boundary so no network/credentials are needed.
const extractText = vi.fn()
vi.mock('@/lib/ocr/providers/google-vision', () => ({
  googleVisionProvider: {
    extractText: (...args: unknown[]) => extractText(...args),
  },
}))

// Import AFTER the mock is registered.
import { locateFieldEvidence } from '../visionBboxLocator'

const IMG = Buffer.from('x')
const MIME = 'image/jpeg'

/**
 * Build a provider-shaped OcrResult exactly as the REAL google-vision parser emits:
 * every word has a stable `w_NNNN` id, page 1, and a normalized 0..1 bbox
 * (as produced by verticesToBbox → {x, y, width, height}), source 'google_vision'.
 */
function providerResult(words: OcrWord[]): OcrResult {
  return {
    provider: 'google_vision',
    raw_text: words.map((w) => w.text).join(' '),
    // The locator resolves against `words`; lines are the paragraph unions and
    // are not needed for this proof, so we keep them empty (still a non-empty read).
    pages: [
      {
        page: 1,
        width: 1000,
        height: 1400,
        lines: [],
        words,
      },
    ],
    lines: [],
    words,
    processing_ms: 7,
    warnings: [],
    created_at: '2026-06-30T00:00:00.000Z',
  }
}

beforeEach(() => {
  extractText.mockReset()
})

describe('locateFieldEvidence — REAL provider geometry → honest EvidenceRegion', () => {
  it('maps single-token field → exact and two-token field → combined UNION, both with real 0..1 bboxes', async () => {
    // Deterministic, provider-shaped OCR tokens with real normalized bboxes.
    //   w_0001 — the family_name value, one token.
    //   w_0002 + w_0003 — the given_name value, spanning two adjacent tokens.
    extractText.mockResolvedValue(
      providerResult([
        {
          id: 'w_0001',
          text: 'Kovalenko', // fictional
          page: 1,
          bbox: { x: 0.12, y: 0.30, width: 0.24, height: 0.045 },
          source: 'google_vision',
        },
        {
          id: 'w_0002',
          text: 'Oksana', // fictional
          page: 1,
          bbox: { x: 0.12, y: 0.40, width: 0.18, height: 0.045 },
          source: 'google_vision',
        },
        {
          id: 'w_0003',
          text: 'Ivanivna', // fictional
          page: 1,
          bbox: { x: 0.34, y: 0.40, width: 0.22, height: 0.045 },
          source: 'google_vision',
        },
      ]),
    )

    const regions = await locateFieldEvidence({
      imageBuffer: IMG,
      mimeType: MIME,
      fieldOcrIds: {
        family_name: ['w_0001'],
        given_name: ['w_0002', 'w_0003'],
      },
    })

    expect(regions).toHaveLength(2)
    const byKey = Object.fromEntries(regions.map((r) => [r.fieldKey, r]))

    // ── family_name: single resolved token → EXACT, source ocr_token ──────────
    const fam = byKey.family_name
    expect(fam.status).toBe('exact')
    expect(fam.source).toBe('ocr_token')
    expect(fam.page).toBe(1)
    const famBox = fam.bbox!
    // Real 4-number bbox, all within 0..1.
    expect(famBox).toHaveLength(4)
    expect(famBox.every((n) => n >= 0 && n <= 1)).toBe(true)
    // [x0,y0,x1,y1] = [x, y, x+width, y+height]
    expect(famBox[0]).toBeCloseTo(0.12)
    expect(famBox[1]).toBeCloseTo(0.30)
    expect(famBox[2]).toBeCloseTo(0.36) // 0.12 + 0.24
    expect(famBox[3]).toBeCloseTo(0.345) // 0.30 + 0.045

    // ── given_name: two resolved tokens → COMBINED, bbox = UNION ──────────────
    const giv = byKey.given_name
    expect(giv.status).toBe('combined')
    expect(giv.source).toBe('ocr_token')
    const givBox = giv.bbox!
    expect(givBox).toHaveLength(4)
    expect(givBox.every((n) => n >= 0 && n <= 1)).toBe(true)
    // Union of w_0002 [0.12,0.40,0.30,0.445] and w_0003 [0.34,0.40,0.56,0.445]:
    //   x0 = min(0.12, 0.34) = 0.12
    //   y0 = min(0.40, 0.40) = 0.40
    //   x1 = max(0.30, 0.56) = 0.56
    //   y1 = max(0.445, 0.445) = 0.445
    expect(givBox[0]).toBeCloseTo(0.12)
    expect(givBox[1]).toBeCloseTo(0.40)
    expect(givBox[2]).toBeCloseTo(0.56)
    expect(givBox[3]).toBeCloseTo(0.445)
    // The union strictly contains each individual token box (honest widening).
    expect(givBox[2]).toBeGreaterThan(0.30) // wider than w_0002 alone
    expect(givBox[0]).toBeLessThan(0.34) // starts left of w_0003
  })

  it('FAIL-OPEN: provider 403 (billing unavailable) → [] and never throws', async () => {
    // The exact typed error the real provider returns on an HTTP 403 billing block.
    const billing403: OcrProviderErrorResult = {
      provider_error: true,
      error: {
        ok: false,
        error_code: 'OCR_BILLING_DISABLED',
        retryable: false,
        message: 'Recognition is temporarily unavailable. Please try again later.',
        detail: 'http_403',
      },
    }
    extractText.mockResolvedValue(billing403)

    const regions = await locateFieldEvidence({
      imageBuffer: IMG,
      mimeType: MIME,
      fieldOcrIds: { family_name: ['w_0001'], given_name: ['w_0002', 'w_0003'] },
    })

    // Graceful degradation: no evidence, no throw.
    expect(regions).toEqual([])
  })

  it('FAIL-OPEN: provider THROWS (network/timeout) → [] and never throws', async () => {
    extractText.mockRejectedValue(new Error('vision endpoint unreachable'))

    await expect(
      locateFieldEvidence({
        imageBuffer: IMG,
        mimeType: MIME,
        fieldOcrIds: { family_name: ['w_0001'] },
      }),
    ).resolves.toEqual([])
  })
})
