import { describe, expect, it } from 'vitest'
import type { OcrResult } from '@/lib/ocr/types'
import { runI94Module } from '@/lib/tps/modules/i94'

function mkOcr(lines: string[]): OcrResult {
  return {
    created_at: new Date().toISOString(),
    provider: 'google_vision',
    raw_text: lines.join('\n'),
    pages: [{ page: 1, width: 1000, height: 1000, lines: [], words: [] }],
    words: [],
    lines: lines.map((text, i) => ({
      id: `l_${i}`,
      text,
      page: 1,
      bbox: { x: 0.1, y: 0.1 + i * 0.05, width: 0.6, height: 0.03 },
      words: [],
      confidence: 0.95,
      source: 'google_vision',
    })),
    processing_ms: 10,
    warnings: [],
  }
}

describe('runI94Module', () => {
  it('extracts admission number when OCR reads I-94 as 1-94', () => {
    const ocr = mkOcr([
      'Admission ( 1-94 ) Number',
      '12345678901',
      'Class of Admission',
      'UHP',
      'Date of Entry',
      '03/15/2024',
    ])
    const out = runI94Module(ocr, { document_id: 'doc_test' })
    expect(out.matched).toBe(true)
    const keys = out.fields.map((f) => f.field)
    expect(keys).toContain('i94_admission_number')
    expect(keys).toContain('last_entry_date')
  })
})
