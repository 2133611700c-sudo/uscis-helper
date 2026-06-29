import { describe, it, expect } from 'vitest'
import {
  bboxFromOcrBox,
  templateEvidenceForDocType,
  geminiEvidence,
  assertHonest,
} from '../evidenceAdapters'
import { isHonestEvidence, type EvidenceRegion } from '../EvidenceRegion'

describe('bboxFromOcrBox', () => {
  it('converts {x,y,width,height} → [x0,y0,x1,y1] (x1=x+width, y1=y+height)', () => {
    // Fictional box.
    expect(bboxFromOcrBox({ x: 0.1, y: 0.2, width: 0.3, height: 0.25 })).toEqual([
      0.1, 0.2, 0.4, 0.45,
    ])
  })

  it('keeps a zero-origin box honest (full-width)', () => {
    expect(bboxFromOcrBox({ x: 0, y: 0, width: 1, height: 1 })).toEqual([0, 0, 1, 1])
  })
})

describe('templateEvidenceForDocType', () => {
  it('returns approximate/field_template regions for ua_birth_certificate name fields', () => {
    const regions = templateEvidenceForDocType('ua_birth_certificate')
    expect(regions.length).toBeGreaterThan(0)

    const keys = regions.map((r) => r.fieldKey).sort()
    expect(keys).toEqual(['family_name', 'given_name', 'patronymic'])

    for (const r of regions) {
      expect(r.status).toBe('approximate')
      expect(r.source).toBe('field_template')
      expect(r.bbox).not.toBeNull()
      expect(r.page).toBe(1)
      expect(isHonestEvidence(r)).toBe(true)
    }
  })

  it('resolves a versioned doc id via substring match', () => {
    const regions = templateEvidenceForDocType('ua_birth_certificate_soviet_v1')
    expect(regions.map((r) => r.fieldKey).sort()).toEqual([
      'family_name',
      'given_name',
      'patronymic',
    ])
  })

  it('honors an explicit page number', () => {
    const regions = templateEvidenceForDocType('ua_birth_certificate', 3)
    expect(regions.every((r) => r.page === 3)).toBe(true)
  })

  it('returns [] for a doc type with no template', () => {
    expect(templateEvidenceForDocType('us_passport_card')).toEqual([])
    expect(templateEvidenceForDocType('')).toEqual([])
  })
})

describe('geminiEvidence', () => {
  it('maps each field to a full_image / model region with null bbox', () => {
    const regions = geminiEvidence(['family_name', 'given_name'])
    expect(regions).toHaveLength(2)
    for (const r of regions) {
      expect(r.status).toBe('full_image')
      expect(r.source).toBe('model')
      expect(r.bbox).toBeNull()
      expect(isHonestEvidence(r)).toBe(true)
    }
  })

  it('returns [] for no fields', () => {
    expect(geminiEvidence([])).toEqual([])
  })
})

describe('assertHonest', () => {
  it('returns an honest region unchanged', () => {
    const r = geminiEvidence(['family_name'])[0]
    expect(assertHonest(r)).toBe(r)
  })

  it('throws on a dishonest region (full_image claiming exact with a bbox)', () => {
    const liar: EvidenceRegion = {
      fieldKey: 'family_name',
      bbox: [0, 0, 1, 1],
      page: 1,
      status: 'exact',
      source: 'model',
    }
    // exact + source model is fine for the honesty guard per se, but a full_image
    // lie is the canonical §3.6 violation:
    const fullImageLie: EvidenceRegion = {
      fieldKey: 'family_name',
      bbox: [0, 0, 1, 1],
      page: 1,
      status: 'full_image',
      source: 'model',
    }
    expect(isHonestEvidence(liar)).toBe(true) // sanity: exact+bbox is honest
    expect(() => assertHonest(fullImageLie)).toThrow(/dishonest/)
  })
})
