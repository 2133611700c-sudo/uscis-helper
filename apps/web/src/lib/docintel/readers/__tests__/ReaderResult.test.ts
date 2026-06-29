/**
 * ReaderResult contract — invariants + byte-identical Gemini mapping (Step A).
 * Pure; no runtime behaviour touched.
 */
import { describe, it, expect } from 'vitest'
import { readerResultFromVision, type ReaderResult } from '../ReaderResult'
import type { VisionReadResult } from '../../types'

const okVision: VisionReadResult = {
  ok: true,
  model: 'gemini-2.5-pro',
  ms: 0,
  fields: [
    { field: 'family_name', cyrillic: 'Іваненко', iso_date: null, can_read: true, confidence: 0.91, reason: '' },
    { field: 'date_of_birth', cyrillic: '', iso_date: '1990-05-14', can_read: true, confidence: 0.8, reason: '' },
    { field: 'patronymic', cyrillic: '', iso_date: null, can_read: false, confidence: 0, reason: 'not legible' },
  ],
} as VisionReadResult

describe('ReaderResult — Gemini mapping is byte-identical (observation only)', () => {
  it('maps an ok read field-for-field without inventing values', () => {
    const r = readerResultFromVision(okVision)
    expect(r.readerFamily).toBe('gemini')
    expect(r.model).toBe('gemini-2.5-pro')
    expect(r.status).toBe('ok')
    expect(r.fields).toHaveLength(3)
    expect(r.fields[0]).toMatchObject({ field: 'family_name', rawCyrillic: 'Іваненко', abstained: false, confidence: 0.91 })
    expect(r.fields[1]).toMatchObject({ field: 'date_of_birth', isoDate: '1990-05-14', abstained: false })
    expect(r.fields[2]).toMatchObject({ field: 'patronymic', rawCyrillic: '', abstained: true })
  })

  it('a !ok read becomes status:"unavailable" (fail-closed, NOT empty success)', () => {
    const r = readerResultFromVision({ ok: false, model: null, ms: 0, fields: [], error: 'timeout', errorStatus: 429, errorTimeout: true } as VisionReadResult)
    expect(r.status).toBe('unavailable')
    expect(r.abstained).toBe(true)
    expect(r.fields).toHaveLength(0)
    expect(r.errorStatus).toBe(429)
    expect(r.errorTimeout).toBe(true)
  })

  it('a read where every field abstains → whole-read abstained', () => {
    const r = readerResultFromVision({ ok: true, model: 'gemini-2.5-pro', ms: 0, fields: [{ field: 'x', cyrillic: '', iso_date: null, can_read: false, confidence: 0, reason: '' }] } as VisionReadResult)
    expect(r.status).toBe('abstained')
    expect(r.abstained).toBe(true)
  })
})

describe('ReaderResult — INVARIANT: readers observe, never decide', () => {
  it('the contract carries NO decision keys (finalValue/confirmed/review_required)', () => {
    const r: ReaderResult = readerResultFromVision(okVision)
    const allKeys = new Set([...Object.keys(r), ...r.fields.flatMap((f) => Object.keys(f))])
    for (const forbidden of ['finalValue', 'final_value', 'confirmed', 'review_required', 'reviewRequired', 'normalizedValue']) {
      expect(allKeys.has(forbidden), `Reader must NOT emit decision key '${forbidden}'`).toBe(false)
    }
  })

  it('re-mapping the same read twice yields identical observations (no self-confirmation drift)', () => {
    expect(readerResultFromVision(okVision)).toEqual(readerResultFromVision(okVision))
  })
})
