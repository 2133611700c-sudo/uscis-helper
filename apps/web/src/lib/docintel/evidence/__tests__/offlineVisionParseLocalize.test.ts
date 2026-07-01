/**
 * offlineVisionParseLocalize.test.ts — OFFLINE end-to-end proof:
 *   real Google Vision response (fictional) → REAL production parser → OcrResult
 *   → NEW deterministic localizer → honest EvidenceRegion[].
 *
 * NO network, NO billing, NO google-auth-library. We drive the ACTUAL production
 * parser `googleVisionProvider.extractText` (apps/web/src/lib/ocr/providers/google-vision.ts)
 * by:
 *   1. Setting a FAKE GOOGLE_CLOUD_VISION_API_KEY so loadVisionCredentials() takes
 *      the simple API-key REST path (skips the service-account/getAccessToken branch).
 *   2. Stubbing global.fetch to return { responses: [ <fixture fullTextAnnotation> ] },
 *      exactly the JSON shape extractText reads (data.responses[0].fullTextAnnotation).
 *
 * So the pages→blocks→paragraphs→words→symbols walk, the w_NNNN id assignment, and
 * verticesToBbox normalization are all EXERCISED FOR REAL — not mirrored in the test.
 *
 * Then localizeFieldsInOcr() (the NEW deterministic localizer) turns already-chosen
 * field VALUES into EvidenceRegion[] and we assert honest geometry.
 *
 * All fixture data is FICTIONAL and PII-free (Testenko / Ivan Petrovych / Kyiv / Vinnytsia Oblast).
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { googleVisionProvider } from '@/lib/ocr/providers/google-vision'
import { isBlocked, isProviderError, type OcrResult } from '@/lib/ocr/types'
import { localizeFieldsInOcr } from '../offlineFieldLocalizer'
import { isHonestEvidence, type EvidenceRegion } from '../EvidenceRegion'

// Fixture lives outside src/, so read it via fs (no JSON-import config needed).
const FIXTURE_PATH = path.resolve(
  __dirname,
  '../../../../../test-fixtures/vision/birth-cert-fulltextannotation.fixture.json',
)
const fullTextAnnotation = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8'))

// Page dims from the fixture (needed to verify normalization: pixel/pageDim → 0..1).
const PAGE_W = 1000
const PAGE_H = 1400

let prevKey: string | undefined

beforeEach(() => {
  prevKey = process.env.GOOGLE_CLOUD_VISION_API_KEY
  // Fake key → loadVisionCredentials() returns apiKey path (no google-auth-library).
  process.env.GOOGLE_CLOUD_VISION_API_KEY = 'FAKE_TEST_KEY_NOT_A_REAL_SECRET'

  // Mock the network. extractText does: const data = await res.json(); data.responses[0].
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify({ responses: [{ fullTextAnnotation }] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
})

afterEach(() => {
  vi.restoreAllMocks()
  if (prevKey === undefined) delete process.env.GOOGLE_CLOUD_VISION_API_KEY
  else process.env.GOOGLE_CLOUD_VISION_API_KEY = prevKey
})

async function runRealParser(): Promise<OcrResult> {
  const res = await googleVisionProvider.extractText({
    imageBuffer: Buffer.from('fictional-image-bytes'), // never sent (fetch is mocked)
    mimeType: 'image/jpeg',
  })
  // Narrow to a real OcrResult (would be BLOCKED/ProviderError on the failure paths).
  expect(isBlocked(res)).toBe(false)
  expect(isProviderError(res)).toBe(false)
  return res as OcrResult
}

describe('offline: real Vision response → real extractText parser → OcrResult', () => {
  it('drives the REAL parser and produces normalized 0..1 word tokens with w_NNNN ids across 2 pages', async () => {
    const ocr = await runRealParser()

    expect(ocr.provider).toBe('google_vision')
    // 4 fictional words: Testenko, Ivan, Petrovych, Kyiv (page 1) + Vinnytsia, Oblast (page 2) = 6
    expect(ocr.words).toHaveLength(6)
    expect(ocr.pages).toHaveLength(2)

    // Multipage really parsed.
    expect(ocr.pages[0].words.map((w) => w.text)).toEqual(['Testenko', 'Ivan', 'Petrovych', 'Kyiv'])
    expect(ocr.pages[1].words.map((w) => w.text)).toEqual(['Vinnytsia', 'Oblast'])

    // Stable ids assigned by the real parser.
    expect(ocr.words.map((w) => w.id)).toEqual(['w_0000', 'w_0001', 'w_0002', 'w_0003', 'w_0004', 'w_0005'])

    // verticesToBbox normalization: Testenko px [100..340]x[200..250] / 1000x1400.
    const testenko = ocr.words[0]
    expect(testenko.text).toBe('Testenko')
    expect(testenko.page).toBe(1)
    expect(testenko.bbox.x).toBeCloseTo(100 / PAGE_W, 6)
    expect(testenko.bbox.y).toBeCloseTo(200 / PAGE_H, 6)
    expect(testenko.bbox.width).toBeCloseTo(240 / PAGE_W, 6)
    expect(testenko.bbox.height).toBeCloseTo(50 / PAGE_H, 6)
  })
})

describe('offline: OcrResult → NEW localizer → honest EvidenceRegion[]', () => {
  it('exact single-token, combined multi-token union, and honest omission of absent values', async () => {
    const ocr = await runRealParser()

    const regions: EvidenceRegion[] = localizeFieldsInOcr(
      [
        { key: 'family_name', value: 'Testenko' },        // single word → exact
        { key: 'given_and_patronymic', value: 'Ivan Petrovych' }, // two words → combined
        { key: 'place_of_birth_city', value: 'Kyiv' },    // single word → exact
        { key: 'place_of_registration', value: 'Vinnytsia Oblast' }, // two words, page 2 → combined
        { key: 'mothers_name', value: 'Nonexistentova' }, // NOT in OCR → omitted
      ],
      ocr,
    )

    // Every emitted region must pass the §3.6 honesty guard.
    for (const r of regions) expect(isHonestEvidence(r)).toBe(true)

    // Absent value produced NO region (never fabricated).
    expect(regions.find((r) => r.fieldKey === 'mothers_name')).toBeUndefined()
    expect(regions).toHaveLength(4)

    // family_name → exact, single-token bbox, real 0..1 numbers.
    const fam = regions.find((r) => r.fieldKey === 'family_name')!
    expect(fam.status).toBe('exact')
    expect(fam.source).toBe('ocr_token')
    expect(fam.page).toBe(1)
    expect(fam.bbox).not.toBeNull()
    const [fx0, fy0, fx1, fy1] = fam.bbox!
    for (const c of [fx0, fy0, fx1, fy1]) {
      expect(c).toBeGreaterThanOrEqual(0)
      expect(c).toBeLessThanOrEqual(1)
    }
    expect(fx1).toBeGreaterThan(fx0)
    expect(fy1).toBeGreaterThan(fy0)
    // Matches the single Testenko token (px 100..340 x 200..250).
    expect(fx0).toBeCloseTo(100 / PAGE_W, 6)
    expect(fx1).toBeCloseTo(340 / PAGE_W, 6)

    // given_and_patronymic → combined, union bbox CONTAINS both Ivan and Petrovych tokens.
    const gp = regions.find((r) => r.fieldKey === 'given_and_patronymic')!
    expect(gp.status).toBe('combined')
    expect(gp.page).toBe(1)
    const [gx0, gy0, gx1, gy1] = gp.bbox!
    // Ivan px x[100..260], Petrovych px x[280..600]; union x must span 100..600.
    expect(gx0).toBeCloseTo(100 / PAGE_W, 6)
    expect(gx1).toBeCloseTo(600 / PAGE_W, 6)
    // union y spans min top (320) .. max bottom (372).
    expect(gy0).toBeCloseTo(320 / PAGE_H, 6)
    expect(gy1).toBeCloseTo(372 / PAGE_H, 6)

    // Sanity: the two child tokens really sit inside the union bbox.
    const ivan = ocr.words.find((w) => w.text === 'Ivan')!
    const petr = ocr.words.find((w) => w.text === 'Petrovych')!
    for (const w of [ivan, petr]) {
      expect(w.bbox.x).toBeGreaterThanOrEqual(gx0 - 1e-9)
      expect(w.bbox.y).toBeGreaterThanOrEqual(gy0 - 1e-9)
      expect(w.bbox.x + w.bbox.width).toBeLessThanOrEqual(gx1 + 1e-9)
      expect(w.bbox.y + w.bbox.height).toBeLessThanOrEqual(gy1 + 1e-9)
    }

    // place_of_birth_city → exact on page 1.
    const city = regions.find((r) => r.fieldKey === 'place_of_birth_city')!
    expect(city.status).toBe('exact')
    expect(city.page).toBe(1)

    // place_of_registration → combined on PAGE 2 (proves page-aware localization).
    const reg = regions.find((r) => r.fieldKey === 'place_of_registration')!
    expect(reg.status).toBe('combined')
    expect(reg.page).toBe(2)
  })
})
