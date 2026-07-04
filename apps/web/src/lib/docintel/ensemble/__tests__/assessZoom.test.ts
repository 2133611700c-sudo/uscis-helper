/**
 * assessZoom — blueprint #2 ASSESS→ZOOM node. FICTIONAL data only, cropRead injected.
 * Pins: targets come from HARD critic findings only; the zoom NEVER changes a value and
 * NEVER lowers review; disagreement adds 'zoom_mismatch'; soft/empty fields never zoom.
 */
import { describe, it, expect, vi } from 'vitest'
import sharp from 'sharp'
import { assessZoomTargets, verifySuspectFieldsByZoom, isAssessZoomEnabled } from '../assessZoom'
import type { ExtractedDocField } from '../../types'

const NOW = new Date('2026-07-04T00:00:00Z')
const f = (field: string, value: string | null, over: Partial<ExtractedDocField> = {}): ExtractedDocField => ({
  field, kind: 'text' as ExtractedDocField['kind'], raw_cyrillic: null, value,
  confidence: 0.9, review_required: false, source: 'vision', provider: 'gemini', ...over,
})
const page = () => sharp({ create: { width: 100, height: 60, channels: 3, background: '#fff' } }).png().toBuffer()

describe('isAssessZoomEnabled — strict flag', () => {
  it("only '1' enables", () => {
    expect(isAssessZoomEnabled({})).toBe(false)
    expect(isAssessZoomEnabled({ ASSESS_ZOOM_LOOP: 'true' })).toBe(false)
    expect(isAssessZoomEnabled({ ASSESS_ZOOM_LOOP: '1' })).toBe(true)
  })
})

describe('assessZoomTargets — free deterministic ASSESS', () => {
  it('hard contradiction (dob in future) names the field; clean doc names nothing', () => {
    expect(assessZoomTargets([f('dob', '2030-01-01')], NOW)).toEqual(['dob'])
    expect(assessZoomTargets([f('dob', '1990-01-01')], NOW)).toEqual([])
  })

  it('soft place_unverified NEVER zooms (a re-read cannot resolve an incomplete registry)', () => {
    const fields = [f('place_of_birth_city', null, { raw_cyrillic: 'Вигаданське' })]
    expect(assessZoomTargets(fields, NOW)).toEqual([])
  })

  it('empty implicated fields are excluded (they belong to tile-recover, not zoom)', () => {
    // sex↔patronymic conflict implicates both, but sex is empty → only patronymic zooms
    const fields = [
      f('sex', 'F'),
      f('patronymic', null, { raw_cyrillic: 'Петрович' }),
    ]
    const targets = assessZoomTargets(fields, NOW)
    expect(targets).toContain('patronymic')
    expect(targets).toContain('sex') // sex has a value ('F') — included
  })
})

describe('verifySuspectFieldsByZoom — paid ZOOM, review-monotonic-UP', () => {
  it('no targets → cropRead never called, fields unchanged', async () => {
    const cropRead = vi.fn()
    const res = await verifySuspectFieldsByZoom({
      fields: [f('dob', '1990-01-01')], originalBuffer: await page(), fieldLabels: {}, cropRead, now: NOW,
    })
    expect(cropRead).not.toHaveBeenCalled()
    expect(res.diag.targets).toEqual([])
  })

  it('zoom DISAGREES → value untouched, review forced up with zoom_mismatch', async () => {
    const cropRead = vi.fn().mockResolvedValue({ dob: '1995-02-02' })
    const res = await verifySuspectFieldsByZoom({
      fields: [f('dob', '2030-01-01')], originalBuffer: await page(), fieldLabels: { dob: 'дата' }, cropRead, now: NOW,
    })
    const dob = res.fields.find((x) => x.field === 'dob')!
    expect(dob.value).toBe('2030-01-01') // NEVER changes a value
    expect(dob.review_required).toBe(true)
    expect(dob.review_reasons).toContain('zoom_mismatch')
    expect(res.diag.mismatched_keys).toEqual(['dob'])
  })

  it('zoom AGREES → review NOT lowered (stable-misread safety), diagnostic only', async () => {
    const cropRead = vi.fn().mockResolvedValue({ dob: '2030-01-01' })
    const res = await verifySuspectFieldsByZoom({
      fields: [f('dob', '2030-01-01', { review_required: true })],
      originalBuffer: await page(), fieldLabels: {}, cropRead, now: NOW,
    })
    const dob = res.fields.find((x) => x.field === 'dob')!
    expect(dob.review_required).toBe(true)
    expect(dob.review_reasons ?? []).not.toContain('zoom_mismatch')
    expect(res.diag.agreed).toBe(1)
  })

  it('cropRead throws → fail-open, fields unchanged, error in diag', async () => {
    const cropRead = vi.fn().mockRejectedValue(new Error('down'))
    const res = await verifySuspectFieldsByZoom({
      fields: [f('dob', '2030-01-01')], originalBuffer: await page(), fieldLabels: {}, cropRead, now: NOW,
    })
    expect(res.fields.find((x) => x.field === 'dob')!.value).toBe('2030-01-01')
    expect(res.diag.error).toBe('down')
  })

  it('diag is keys-only (PII-free): no field values leak', async () => {
    const cropRead = vi.fn().mockResolvedValue({ dob: '1995-02-02' })
    const res = await verifySuspectFieldsByZoom({
      fields: [f('dob', '2030-01-01')], originalBuffer: await page(), fieldLabels: {}, cropRead, now: NOW,
    })
    const json = JSON.stringify(res.diag)
    expect(json).not.toContain('2030-01-01')
    expect(json).not.toContain('1995-02-02')
  })
})
