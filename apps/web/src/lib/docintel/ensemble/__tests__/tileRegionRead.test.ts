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
  foldMajority,
  tileVoteRuns,
  geminiReadFieldsFromCrop,
  votingSettled,
  type CropFieldReadFn,
  type SingleCropSampler,
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
    expect(isEmptyField(field({ field: 'f', raw_cyrillic: 'Соловьяк' }))).toBe(false)
  })
})

describe('recoverEmptyFieldsByTiles', () => {
  it('fills an empty field from the tile that reads it; held for review, raw cyrillic only', async () => {
    const base = [
      field({ field: 'given_name', value: 'Andrey', raw_cyrillic: 'Андрей' }),
      field({ field: 'father_full_name', value: '', raw_cyrillic: '' }),
    ]
    const cropRead: CropFieldReadFn = async (_crop, fields) => {
      // the targeted reader recovers the father name (only when asked for it).
      const r: Record<string, string> = {}
      if (fields.some((f) => f.key === 'father_full_name')) r.father_full_name = 'Соловьяк Андрей Богданович'
      return r
    }
    const { fields, diag } = await recoverEmptyFieldsByTiles({ baseFields: base, originalBuffer: await img(), fieldLabels: LABELS, cropRead })
    const father = fields.find((f) => f.field === 'father_full_name')!
    expect(father.raw_cyrillic).toBe('Соловьяк Андрей Богданович')
    expect(father.value).toBeNull() // downstream C3/transliteration own the canonical value
    expect(father.review_required).toBe(true)
    expect(father.review_reasons).toContain('hires_tile_recovered')
    expect(fields.find((f) => f.field === 'given_name')!.value).toBe('Andrey') // untouched
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
    const base = [field({ field: 'given_name', value: 'Andrey', raw_cyrillic: 'Андрей' })]
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

describe('foldMajority (K-sample stabilization)', () => {
  const F = [{ key: 'father' }, { key: 'mother' }]
  it('value in 2 of 3 ⇒ wins (exact raw string preserved)', () => {
    const out = foldMajority(
      [{ father: 'Соловьяк Андрей' }, { father: 'Соловьяк Андрей' }, { father: 'Иванов' }],
      F, 3,
    )
    expect(out.father).toBe('Соловьяк Андрей')
  })
  it('3 all different (1/1/1) ⇒ omitted (no majority)', () => {
    const out = foldMajority([{ father: 'A' }, { father: 'B' }, { father: 'C' }], F, 3)
    expect(out.father).toBeUndefined()
  })
  it('normalize-then-vote: "Андрей" vs "андрей " count as one ⇒ majority', () => {
    const out = foldMajority([{ father: 'Андрей' }, { father: 'андрей ' }, { father: 'X' }], F, 3)
    // winner token has 2 votes; emits the most frequent raw (tie → first seen = 'Андрей')
    expect(normalizeLower(out.father)).toBe('андрей')
  })
  it('5 runs, 2-2-1 ⇒ no strict majority ⇒ omitted', () => {
    const out = foldMajority([{ father: 'A' }, { father: 'A' }, { father: 'B' }, { father: 'B' }, { father: 'C' }], F, 5)
    expect(out.father).toBeUndefined()
  })
  it('5 runs, 3 agree ⇒ wins', () => {
    const out = foldMajority([{ father: 'A' }, { father: 'A' }, { father: 'A' }, { father: 'B' }, { father: 'C' }], F, 5)
    expect(out.father).toBe('A')
  })
  it('lone read (1 of 3, others empty) ⇒ omitted (flaky single never wins)', () => {
    const out = foldMajority([{ father: 'Lone' }, {}, {}], F, 3)
    expect(out.father).toBeUndefined()
  })
  function normalizeLower(s: string | undefined) { return (s ?? '').trim().toLowerCase() }
})

describe('tileVoteRuns env parsing', () => {
  it('default 3; "1"→1; "5"→5; garbage→3; "9"→clamp 5', () => {
    expect(tileVoteRuns({})).toBe(3)
    expect(tileVoteRuns({ TILE_VOTE_RUNS: '1' })).toBe(1)
    expect(tileVoteRuns({ TILE_VOTE_RUNS: '5' })).toBe(5)
    expect(tileVoteRuns({ TILE_VOTE_RUNS: 'x' })).toBe(3)
    expect(tileVoteRuns({ TILE_VOTE_RUNS: '0' })).toBe(3)
    expect(tileVoteRuns({ TILE_VOTE_RUNS: '9' })).toBe(5)
  })
})

describe('geminiReadFieldsFromCrop voting wrapper (injected sampler)', () => {
  const fields = [{ key: 'father', label: 'Батько' }]
  const crop = Buffer.from('x')
  it('passes only majority keys through', async () => {
    const seq = [{ father: 'X' }, { father: 'X' }, { father: 'Y' }]
    let i = 0
    const sampler: SingleCropSampler = async () => seq[i++]
    const out = await geminiReadFieldsFromCrop(crop, fields, 'k', 'm', 60_000, { runs: 3, sampler })
    expect(out.father).toBe('X')
  })
  it('per-sample throw still reaches majority (2 of 3 agree)', async () => {
    const seq: Array<() => Promise<Record<string, string>>> = [
      async () => ({ father: 'X' }),
      async () => { throw new Error('socket') },
      async () => ({ father: 'X' }),
    ]
    let i = 0
    const sampler: SingleCropSampler = () => seq[i++]()
    const out = await geminiReadFieldsFromCrop(crop, fields, 'k', 'm', 60_000, { runs: 3, sampler })
    expect(out.father).toBe('X')
  })
  it('runs:1 ⇒ returns the single sample verbatim (back-compat)', async () => {
    const sampler: SingleCropSampler = async () => ({ father: 'Solo' })
    const out = await geminiReadFieldsFromCrop(crop, fields, 'k', 'm', 60_000, { runs: 1, sampler })
    expect(out.father).toBe('Solo')
  })
  it('COST early-exit: first 2 agree ⇒ stops at 2 calls (not 3), same result', async () => {
    let calls = 0
    const sampler: SingleCropSampler = async () => { calls++; return { father: 'X' } }
    const out = await geminiReadFieldsFromCrop(crop, fields, 'k', 'm', 60_000, { runs: 3, sampler })
    expect(out.father).toBe('X')
    expect(calls).toBe(2) // saved the 3rd Gemini call
  })
})

describe('votingSettled (cost early-exit predicate)', () => {
  const F = [{ key: 'father' }]
  it('2 of 3 agree ⇒ settled (majority reached)', () => {
    expect(votingSettled([{ father: 'X' }, { father: 'X' }], F, 3)).toBe(true)
  })
  it('1 of 3 ⇒ not settled (a 3rd could still form a majority)', () => {
    expect(votingSettled([{ father: 'X' }], F, 3)).toBe(false)
  })
  it('2 disagree of 3 ⇒ not settled (remaining sample could tie the leader to 2)', () => {
    expect(votingSettled([{ father: 'X' }, { father: 'Y' }], F, 3)).toBe(false)
  })
  it('all-empty so far with 1 remaining ⇒ settled (cannot reach majority)', () => {
    expect(votingSettled([{}, {}], F, 3)).toBe(true)
  })
})

describe('recoverEmptyFieldsByTiles with a voting crop reader (integration)', () => {
  const field = (p: Partial<ExtractedDocField> & { field: string }): ExtractedDocField => ({
    kind: 'name', raw_cyrillic: null, value: null, confidence: 0, review_required: false,
    source: 'vision', provider: 'gemini', ...p,
  })
  it('majority-won field filled; no-majority field stays empty', async () => {
    const base = [
      field({ field: 'father_full_name', value: '', raw_cyrillic: '' }),
      field({ field: 'mother_full_name', value: '', raw_cyrillic: '' }),
    ]
    // father: 2/3 agree → filled. mother: 1/1/1 → omitted (stays empty).
    const samples = [
      { father_full_name: 'Соловьяк Андрей', mother_full_name: 'A' },
      { father_full_name: 'Соловьяк Андрей', mother_full_name: 'B' },
      { father_full_name: 'Z', mother_full_name: 'C' },
    ]
    let i = 0
    const sampler: SingleCropSampler = async () => samples[i++ % samples.length]
    const votingCropRead: CropFieldReadFn = (crop, flds) =>
      geminiReadFieldsFromCrop(crop, flds, 'k', 'm', 60_000, { runs: 3, sampler })
    const img = await (await import('sharp')).default({ create: { width: 1200, height: 800, channels: 3, background: '#eee' } }).jpeg().toBuffer()
    const { fields, diag } = await recoverEmptyFieldsByTiles({
      baseFields: base, originalBuffer: img, fieldLabels: { father_full_name: 'Батько', mother_full_name: 'Мати' },
      cropRead: votingCropRead,
    })
    const father = fields.find((f) => f.field === 'father_full_name')!
    expect(father.raw_cyrillic).toBe('Соловьяк Андрей')
    expect(father.review_reasons).toContain('hires_tile_recovered')
    expect(isEmptyField(fields.find((f) => f.field === 'mother_full_name')!)).toBe(true) // no majority ⇒ held
    expect(diag.recovered).toBe(1)
  })
})
