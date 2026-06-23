/**
 * tileRegionRead.test.ts — STAGE 4 hi-res tile recovery. Deterministic: a FAKE targeted crop
 * reader is injected (no Gemini); sharp runs on a generated image. Proves: empty critical field is
 * filled from the tile that reads it (held for review, reason tagged, raw cyrillic only); a
 * confidently-read field is never touched; no-empty ⇒ no tiles; criticalKeys gating; fail-open;
 * flag default OFF.
 */
import { describe, it, expect } from 'vitest'
import sharp from 'sharp'
import {
  recoverEmptyFieldsByTiles,
  isEmptyField,
  isHiResTileRecoverEnabled,
  type CropFieldReadFn,
} from '../tileRegionRead'
import type { ExtractedDocField } from '../../types'

const field = (p: Partial<ExtractedDocField> & { field: string }): ExtractedDocField => ({
  kind: 'name', raw_cyrillic: null, value: null, confidence: 0, review_required: false,
  source: 'vision', provider: 'gemini', ...p,
})

async function img(): Promise<Buffer> {
  return sharp({ create: { width: 1200, height: 800, channels: 3, background: '#eeeeee' } }).jpeg().toBuffer()
}

const LABELS = { father_full_name: 'Батько', given_name: 'Імʼя', notes: 'Notes' }

describe('isEmptyField', () => {
  it('empty when no value AND no raw cyrillic', () => {
    expect(isEmptyField(field({ field: 'f', value: '', raw_cyrillic: '' }))).toBe(true)
    expect(isEmptyField(field({ field: 'f', value: null, raw_cyrillic: null }))).toBe(true)
  })
  it('not empty when it has a value or cyrillic', () => {
    expect(isEmptyField(field({ field: 'f', value: 'X' }))).toBe(false)
    expect(isEmptyField(field({ field: 'f', raw_cyrillic: 'Куропятник' }))).toBe(false)
  })
})

describe('recoverEmptyFieldsByTiles', () => {
  it('fills an empty field from the tile that reads it; held for review, raw cyrillic only', async () => {
    const base = [
      field({ field: 'given_name', value: 'Sergey', raw_cyrillic: 'Сергей' }),
      field({ field: 'father_full_name', value: '', raw_cyrillic: '' }),
    ]
    const cropRead: CropFieldReadFn = async (_crop, fields) => {
      // the targeted reader recovers the father name (only when asked for it).
      const r: Record<string, string> = {}
      if (fields.some((f) => f.key === 'father_full_name')) r.father_full_name = 'Куропятник Сергей Леонидович'
      return r
    }
    const { fields, diag } = await recoverEmptyFieldsByTiles({ baseFields: base, originalBuffer: await img(), fieldLabels: LABELS, cropRead })
    const father = fields.find((f) => f.field === 'father_full_name')!
    expect(father.raw_cyrillic).toBe('Куропятник Сергей Леонидович')
    expect(father.value).toBeNull() // downstream C3/transliteration own the canonical value
    expect(father.review_required).toBe(true)
    expect(father.review_reasons).toContain('hires_tile_recovered')
    expect(fields.find((f) => f.field === 'given_name')!.value).toBe('Sergey') // untouched
    expect(diag).toMatchObject({ emptyBefore: 1, recovered: 1 })
    expect(diag.tiles).toBeGreaterThanOrEqual(1)
  })

  it('stops after recovering all empties (does not read the 2nd tile needlessly)', async () => {
    const base = [field({ field: 'father_full_name', value: '', raw_cyrillic: '' })]
    let calls = 0
    const cropRead: CropFieldReadFn = async () => { calls++; return { father_full_name: 'X' } }
    const { diag } = await recoverEmptyFieldsByTiles({ baseFields: base, originalBuffer: await img(), fieldLabels: LABELS, cropRead })
    expect(diag.recovered).toBe(1)
    expect(calls).toBe(1) // first tile recovered it ⇒ no second tile
  })

  it('no empties ⇒ no tiles, no crop reads', async () => {
    const base = [field({ field: 'given_name', value: 'Sergey', raw_cyrillic: 'Сергей' })]
    let calls = 0
    const cropRead: CropFieldReadFn = async () => { calls++; return {} }
    const { diag } = await recoverEmptyFieldsByTiles({ baseFields: base, originalBuffer: await img(), fieldLabels: LABELS, cropRead })
    expect(diag.tiles).toBe(0)
    expect(calls).toBe(0)
  })

  it('respects criticalKeys (a non-critical empty is left alone)', async () => {
    const base = [field({ field: 'notes', value: '', raw_cyrillic: '' })]
    const cropRead: CropFieldReadFn = async () => ({ notes: 'X' })
    const { diag } = await recoverEmptyFieldsByTiles({
      baseFields: base, originalBuffer: await img(), fieldLabels: LABELS, cropRead,
      criticalKeys: new Set(['father_full_name']),
    })
    expect(diag.emptyBefore).toBe(0)
    expect(diag.tiles).toBe(0)
  })

  it('fail-open: a throwing crop reader leaves the base fields intact', async () => {
    const base = [field({ field: 'father_full_name', value: '', raw_cyrillic: '' })]
    const cropRead: CropFieldReadFn = async () => { throw new Error('boom') }
    const { fields, diag } = await recoverEmptyFieldsByTiles({ baseFields: base, originalBuffer: await img(), fieldLabels: LABELS, cropRead })
    expect(isEmptyField(fields[0])).toBe(true) // untouched (still empty)
    expect(diag.recovered).toBe(0)
  })

  it('flag default OFF; only "1" enables', () => {
    expect(isHiResTileRecoverEnabled({})).toBe(false)
    expect(isHiResTileRecoverEnabled({ HIRES_TILE_RECOVER_ENABLED: '1' })).toBe(true)
  })
})
