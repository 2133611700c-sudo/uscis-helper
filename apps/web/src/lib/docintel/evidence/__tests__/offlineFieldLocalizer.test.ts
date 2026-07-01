/**
 * offlineFieldLocalizer — deterministic field→token localization (evidence entry seam).
 * Proves provider OCR tokens localize an already-chosen field value into honest
 * EvidenceRegion[] with NO network, NO DeepSeek, NO fabrication. FICTIONAL data only.
 */
import { describe, it, expect } from 'vitest'
import { localizeFieldsInOcr } from '../offlineFieldLocalizer'
import type { OcrResult, OcrWord, OcrPage } from '@/lib/ocr/types'

let seq = 0
const word = (text: string, page: number, x: number, y: number, w = 0.08, h = 0.03): OcrWord => ({
  id: `w_${String(seq++).padStart(4, '0')}`,
  text,
  page,
  bbox: { x, y, width: w, height: h },
  source: 'google_vision',
})

function ocrOf(pages: OcrWord[][]): OcrResult {
  const ocrPages: OcrPage[] = pages.map((words, i) => ({
    page: i + 1,
    width: 1000,
    height: 1400,
    lines: [],
    words,
  }))
  const flat = ocrPages.flatMap((p) => p.words)
  return {
    provider: 'google_vision',
    raw_text: flat.map((w) => w.text).join(' '),
    pages: ocrPages,
    lines: [],
    words: flat,
    processing_ms: 1,
    warnings: [],
    created_at: '2026-06-30T00:00:00.000Z',
  }
}

describe('localizeFieldsInOcr — deterministic evidence-only localization', () => {
  it('single-token value → exact region with a real 0..1 bbox', () => {
    const ocr = ocrOf([[word('Testenko', 1, 0.2, 0.25), word('Ivan', 1, 0.3, 0.3)]])
    const [r] = localizeFieldsInOcr([{ key: 'family_name', value: 'Testenko' }], ocr)
    expect(r.status).toBe('exact')
    expect(r.source).toBe('ocr_token')
    expect(r.page).toBe(1)
    expect(r.bbox).toEqual([0.2, 0.25, 0.28, 0.28])
  })

  it('multi-token value → combined region = union of the token boxes', () => {
    const ocr = ocrOf([[word('Ivano', 1, 0.1, 0.4), word('Frankivsk', 1, 0.19, 0.4)]])
    const [r] = localizeFieldsInOcr([{ key: 'place_of_birth_city', value: 'Ivano-Frankivsk' }], ocr)
    expect(r.status).toBe('combined')
    // union spans both boxes; punctuation in the value is ignored
    expect(r.bbox![0]).toBeCloseTo(0.1)
    expect(r.bbox![2]).toBeCloseTo(0.27)
  })

  it('case- and space-insensitive match (Cyrillic)', () => {
    const ocr = ocrOf([[word('ШЕВЧЕНКО', 1, 0.2, 0.2)]])
    const [r] = localizeFieldsInOcr([{ key: 'family_name', value: 'Шевченко' }], ocr)
    expect(r?.status).toBe('exact')
  })

  it('page-aware: a value on page 2 gets page:2 (no page-1 fallback)', () => {
    const ocr = ocrOf([[word('Kyiv', 1, 0.5, 0.5)], [word('Testville', 2, 0.2, 0.2)]])
    const [r] = localizeFieldsInOcr([{ key: 'place_of_registration', value: 'Testville' }], ocr)
    expect(r.page).toBe(2)
  })

  it('value not present in OCR → omitted (never fabricates a box)', () => {
    const ocr = ocrOf([[word('Testenko', 1, 0.2, 0.25)]])
    expect(localizeFieldsInOcr([{ key: 'family_name', value: 'Nonexistent' }], ocr)).toEqual([])
  })

  it('empty / null value → omitted', () => {
    const ocr = ocrOf([[word('Testenko', 1, 0.2, 0.25)]])
    expect(localizeFieldsInOcr([{ key: 'x', value: '' }, { key: 'y', value: null }], ocr)).toEqual([])
  })

  it('is evidence-only: never returns a value, only geometry+status+source', () => {
    const ocr = ocrOf([[word('Testenko', 1, 0.2, 0.25)]])
    const [r] = localizeFieldsInOcr([{ key: 'family_name', value: 'Testenko' }], ocr)
    expect(Object.keys(r).sort()).toEqual(['bbox', 'fieldKey', 'page', 'source', 'status'])
  })
})
