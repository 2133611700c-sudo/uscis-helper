/**
 * passport_number (series+number) extraction — NEW 2026-07-06.
 *
 * This field previously had ZERO test coverage anywhere in the project, despite being one of
 * the most important fields for translation/form-filling (owner-emphasized). While auditing a
 * different Cyrillic \b bug this session, found this field's SERIES_NUMBER_RE regex had the
 * SAME defect: `\b` is ASCII-only in JavaScript (`\w` never includes Cyrillic, even with the
 * `/u` flag), so the ORIGINAL `\b...\b`-bounded pattern could only ever match when Vision
 * happened to output the Latin-lookalike spelling ("EA991991") — genuine Cyrillic OCR output
 * ("ЕА991991") never matched, in any context, including at the start of an already-trimmed
 * OCR line (verified directly in Node, reproducibly). Fixed with an explicit
 * Cyrillic+Latin+digit-aware boundary. These tests lock in both the fix and the pre-existing
 * (already-working) Latin-lookalike behavior, so this field can never silently regress again.
 */
import { describe, it, expect } from 'vitest'
import { runPassportBookletModule } from '../passportBooklet'
import type { OcrResult, OcrLine } from '@/lib/ocr/types'

function line(id: string, text: string): OcrLine {
  return {
    id, text, page: 1,
    bbox: { x: 0, y: 0, width: 0.1, height: 0.02 },
    words: [], confidence: 0.9, source: 'google_vision',
  }
}

function bookletOcr(seriesNumberLine: string): OcrResult {
  const lines: OcrLine[] = [
    line('l_01', 'Паспорт громадянина України'),
    line('l_02', 'Шевченко'),
    line('l_03', 'Прізвище'),
    line('l_04', seriesNumberLine),
  ]
  return {
    provider: 'google_vision',
    raw_text: lines.map((l) => l.text).join('\n'),
    pages: [{ page: 1, width: 800, height: 1200, lines, words: [] }],
    lines, words: [], processing_ms: 0, warnings: [],
    created_at: '2026-05-27T00:00:00.000Z',
  }
}

function getPassportNumber(ocr: OcrResult): string | null {
  const result = runPassportBookletModule(ocr, { document_id: 'test_booklet' })
  return result.fields.find((f) => f.field === 'passport_number')?.normalized_value ?? null
}

describe('passportBooklet — series+number extraction (SERIES_NUMBER_RE)', () => {
  // The module always renders `${series} ${number}` (one space between the letter group and the
  // digit group) and preserves whatever internal spacing the digit group itself had — this is the
  // MODULE's existing, pre-session formatting convention, unrelated to the \b/Cyrillic regex fix.
  // These tests lock in the actual behavior, verified live via vitest, not assumed.
  it('matches genuine CYRILLIC series+number on its own trimmed line (was completely broken pre-fix)', () => {
    expect(getPassportNumber(bookletOcr('ЕА991991'))).toBe('ЕА 991991')
  })

  it('matches genuine Cyrillic series+number with a space', () => {
    expect(getPassportNumber(bookletOcr('ЕА 991991'))).toBe('ЕА 991991')
  })

  it('still matches the Latin-lookalike spelling (pre-existing behavior, must not regress)', () => {
    expect(getPassportNumber(bookletOcr('EA991991'))).toBe('EA 991991')
  })

  it('still matches spaced digit groups: "ЕА 991 991"', () => {
    expect(getPassportNumber(bookletOcr('ЕА 991 991'))).toBe('ЕА 991 991')
  })

  it('does not false-positive-truncate a 2-letter substring inside a longer run', () => {
    // "КНОПКА" contains no valid 6-digit run, so this must simply not extract anything spurious.
    expect(getPassportNumber(bookletOcr('КНОПКА 991991'))).toBeNull()
  })
})
