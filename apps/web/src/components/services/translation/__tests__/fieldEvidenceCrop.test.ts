import { describe, it, expect } from 'vitest'
import { evidenceCropDecision, resolveEvidenceImageUrl } from '../fieldEvidenceCrop'
import type { EvidenceRegion } from '@/lib/docintel/evidence/EvidenceRegion'

const region = (over: Partial<EvidenceRegion>): EvidenceRegion => ({
  fieldKey: 'family_name',
  bbox: [0.1, 0.2, 0.4, 0.26],
  page: 1,
  status: 'approximate',
  source: 'field_template',
  ...over,
})

describe('evidenceCropDecision — STEP-E review crop honesty (§3.6)', () => {
  it('renders nothing without a region', () => {
    expect(evidenceCropDecision(null).render).toBe(false)
    expect(evidenceCropDecision(undefined).render).toBe(false)
  })

  it('renders nothing when there is no field-level bbox', () => {
    expect(evidenceCropDecision(region({ bbox: null, status: 'full_image' })).render).toBe(false)
  })

  it('does NOT show full_image / zone_fallback / missing as a located crop', () => {
    for (const status of ['full_image', 'zone_fallback', 'missing'] as const) {
      expect(evidenceCropDecision(region({ status })).render).toBe(false)
    }
  })

  it('template evidence renders but is labelled APPROXIMATE, never "exact"', () => {
    const d = evidenceCropDecision(region({ status: 'approximate', source: 'field_template' }))
    expect(d.render).toBe(true)
    expect(d.approximate).toBe(true)
    expect(d.label).toMatch(/Approximate/i)
    expect(d.label).not.toMatch(/exact/i)
  })

  it('exact / combined evidence may claim "the part we read"', () => {
    for (const status of ['exact', 'combined'] as const) {
      const d = evidenceCropDecision(region({ status, source: 'ocr_token' }))
      expect(d.render).toBe(true)
      expect(d.approximate).toBe(false)
      expect(d.label).toBe('The part of your document we read')
    }
  })

  it('never falls back to page 1 when the evidence points to a missing page', () => {
    const urls = ['blob:page-1']
    expect(resolveEvidenceImageUrl(region({ page: 2 }), urls)).toBeNull()
  })

  it('resolves the exact page preview when that page exists', () => {
    const urls = ['blob:page-1', 'blob:page-2']
    expect(resolveEvidenceImageUrl(region({ page: 2 }), urls)).toBe('blob:page-2')
  })
})
