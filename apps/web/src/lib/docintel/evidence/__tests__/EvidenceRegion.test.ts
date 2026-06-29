import { describe, it, expect } from 'vitest'
import {
  fromTemplateBox,
  fullImageRegion,
  missingRegion,
  isHonestEvidence,
  type EvidenceRegion,
  type NormalizedBox,
} from '../EvidenceRegion'

describe('EvidenceRegion adapters', () => {
  it('fromTemplateBox → approximate / field_template with bbox preserved', () => {
    const box: NormalizedBox = [0.2326, 0.2277, 0.5451, 0.2923]
    const r = fromTemplateBox('family_name', box)
    expect(r).toMatchObject({
      fieldKey: 'family_name',
      status: 'approximate',
      source: 'field_template',
      page: 1,
    })
    expect(r.bbox).toEqual([0.2326, 0.2277, 0.5451, 0.2923])
    // bbox is a copy, not the same reference
    expect(r.bbox).not.toBe(box)
    expect(isHonestEvidence(r)).toBe(true)
  })

  it('fromTemplateBox respects explicit page', () => {
    const r = fromTemplateBox('given_name', [0, 0, 1, 1], 3)
    expect(r.page).toBe(3)
  })

  it('fullImageRegion (gemini) → full_image / model / null bbox', () => {
    const r = fullImageRegion('patronymic')
    expect(r).toMatchObject({
      fieldKey: 'patronymic',
      status: 'full_image',
      source: 'model',
      page: 1,
    })
    expect(r.bbox).toBeNull()
    expect(isHonestEvidence(r)).toBe(true)
  })

  it('missingRegion → missing / none / null bbox', () => {
    const r = missingRegion('family_name')
    expect(r).toMatchObject({
      fieldKey: 'family_name',
      status: 'missing',
      source: 'none',
      page: 1,
    })
    expect(r.bbox).toBeNull()
    expect(isHonestEvidence(r)).toBe(true)
  })
})

describe('isHonestEvidence — §3.6 honesty rule', () => {
  it('rejects a bbox-less region claiming exact', () => {
    const liar: EvidenceRegion = {
      fieldKey: 'family_name',
      bbox: null,
      page: 1,
      status: 'exact',
      source: 'model',
    }
    expect(isHonestEvidence(liar)).toBe(false)
  })

  it('rejects full_image that carries a bbox', () => {
    const liar: EvidenceRegion = {
      fieldKey: 'family_name',
      bbox: [0, 0, 1, 1],
      page: 1,
      status: 'full_image',
      source: 'model',
    }
    expect(isHonestEvidence(liar)).toBe(false)
  })

  it('rejects missing that carries a bbox', () => {
    const liar: EvidenceRegion = {
      fieldKey: 'family_name',
      bbox: [0, 0, 0.1, 0.1],
      page: 1,
      status: 'missing',
      source: 'none',
    }
    expect(isHonestEvidence(liar)).toBe(false)
  })

  it('rejects a field-precision status with no bbox', () => {
    for (const status of ['exact', 'combined', 'approximate'] as const) {
      const liar: EvidenceRegion = {
        fieldKey: 'family_name',
        bbox: null,
        page: 1,
        status,
        source: 'ocr_token',
      }
      expect(isHonestEvidence(liar)).toBe(false)
    }
  })

  it('accepts a genuine exact OCR-token region', () => {
    const r: EvidenceRegion = {
      fieldKey: 'family_name',
      bbox: [0.23, 0.22, 0.54, 0.29],
      page: 1,
      status: 'exact',
      source: 'ocr_token',
    }
    expect(isHonestEvidence(r)).toBe(true)
  })
})
