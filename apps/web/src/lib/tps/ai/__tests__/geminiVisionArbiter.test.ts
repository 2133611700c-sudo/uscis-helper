import { describe, it, expect } from 'vitest'
import {
  visionReadsToFields,
  readBookletViaVision,
  type VisionFieldRead,
} from '../geminiVisionArbiter'

describe('geminiVisionArbiter — visionReadsToFields (KMU-55 transliteration)', () => {
  const reads: VisionFieldRead[] = [
    { field: 'family_name', cyrillic: "REDACTED_NAME", can_read: true, confidence: 1, reason: '' },
    { field: 'given_name', cyrillic: 'Сергій', can_read: true, confidence: 1, reason: '' },
    { field: 'middle_name', cyrillic: 'Сергійович', can_read: true, confidence: 1, reason: '' },
    { field: 'dob', cyrillic: '25 червня 1986 року', iso_date: '1986-06-25', can_read: true, confidence: 1, reason: '' },
    { field: 'city_of_birth', cyrillic: 'Тростянець', can_read: true, confidence: 0.9, reason: '' },
    { field: 'province_of_birth', cyrillic: 'Вінницька область', can_read: true, confidence: 0.9, reason: '' },
  ]

  const fields = visionReadsToFields(reads, 'doc_test')
  const byField = Object.fromEntries(fields.map((f) => [f.field, f]))

  it('transliterates names via KMU-55, not the LLM (exact official spelling)', () => {
    expect(byField.family_name.normalized_value).toBe('REDACTED')
    expect(byField.given_name.normalized_value).toBe('Serhii')
    expect(byField.middle_name.normalized_value).toBe('Serhiiovych') // full word, not "Yovych" suffix
  })

  it('city is transliterated to Latin (Trostianets, NOT Cyrillic, NOT Prostianets)', () => {
    expect(byField.city_of_birth.normalized_value).toBe('Trostianets')
    expect(String(byField.city_of_birth.normalized_value).toLowerCase()).not.toContain('prost')
  })

  it('dob passes through ISO from the model', () => {
    expect(byField.dob.normalized_value).toBe('1986-06-25')
  })

  it('every field is review_required and tagged gemini_vision provenance', () => {
    for (const f of fields) {
      expect(f.review_required).toBe(true)
      expect(f.source_zone).toBe('gemini_vision')
      expect(f.extraction_source).toBe('dual_ocr_crossref') // reuse to avoid union drift
      expect(f.language_layer).toBe('cyrillic')
    }
  })

  it('skips fields the model could not read', () => {
    const out = visionReadsToFields(
      [{ field: 'family_name', cyrillic: '', can_read: false, confidence: 0, reason: 'illegible' }],
      'doc_x',
    )
    expect(out).toHaveLength(0)
  })

  it('drops dob with non-ISO value (no guessing)', () => {
    const out = visionReadsToFields(
      [{ field: 'dob', cyrillic: '25 червня', iso_date: 'June 25', can_read: true, confidence: 1, reason: '' }],
      'doc_x',
    )
    expect(out).toHaveLength(0)
  })
})

describe('geminiVisionArbiter — readBookletViaVision guardrails', () => {
  it('returns ok:false when GEMINI_API_KEY is not set (never throws)', async () => {
    const saved = process.env.GEMINI_API_KEY
    delete process.env.GEMINI_API_KEY
    try {
      const r = await readBookletViaVision(Buffer.from('x'), 'image/jpeg')
      expect(r.ok).toBe(false)
      expect(r.fields).toEqual([])
      expect(r.error).toMatch(/GEMINI_API_KEY/)
    } finally {
      if (saved !== undefined) process.env.GEMINI_API_KEY = saved
    }
  })
})
