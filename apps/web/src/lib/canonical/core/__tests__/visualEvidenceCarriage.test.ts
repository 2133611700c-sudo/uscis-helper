/**
 * Visual-evidence CARRIAGE proof (One-Brain live evidence chain, §8–§11).
 *
 * Proves geometry rides the SAME contracts end-to-end, not a route-local post-hoc splice:
 *   FieldCandidate.visualEvidence → arbitrateDocument → CanonicalField.visualEvidence
 *   → canonicalToFieldOut → FieldOut.evidence
 * plus: dedupe, same-value pooling, survival through the knowledge layer, and
 * byte-identical absence (no evidence in → no evidence out).
 */
import { describe, it, expect } from 'vitest'
import { arbitrateDocument } from '../arbitration'
import { canonicalToFieldOut } from '../translationAdapter'
import type { FieldCandidate } from '../types'
import type { EvidenceRegion } from '@/lib/docintel/evidence/EvidenceRegion'

const providerRegion = (fieldKey: string): EvidenceRegion => ({
  fieldKey,
  bbox: [0.12, 0.30, 0.36, 0.345],
  page: 1,
  status: 'exact',
  source: 'ocr_token',
})

const cand = (over: Partial<FieldCandidate>): FieldCandidate => ({
  key: 'family_name',
  value: 'Shevchenko',
  source: 'ai_vision',
  confidence: 0.9,
  provider: 'docintel:gemini:page1',
  ...over,
})

describe('visual-evidence carriage — provider geometry → canonical → FieldOut', () => {
  it('carries a candidate region onto CanonicalField.visualEvidence and out to FieldOut.evidence', () => {
    const region = providerRegion('family_name')
    const [canonical] = arbitrateDocument([cand({ visualEvidence: [region] })])
    expect(canonical.visualEvidence).toBeDefined()
    expect(canonical.visualEvidence).toHaveLength(1)
    expect(canonical.visualEvidence![0]).toMatchObject({ status: 'exact', source: 'ocr_token', page: 1 })

    const out = canonicalToFieldOut(canonical)
    expect(out.evidence).toBeDefined()
    expect(out.evidence).toHaveLength(1)
    expect(out.evidence![0].bbox).toEqual([0.12, 0.30, 0.36, 0.345])
  })

  it('byte-identical when no candidate carries geometry (no evidence in → none out)', () => {
    const [canonical] = arbitrateDocument([cand({})])
    expect(canonical.visualEvidence).toBeUndefined()
    const out = canonicalToFieldOut(canonical)
    expect('evidence' in out).toBe(false)
  })

  it('pools regions from same-value candidates and dedupes identical ones', () => {
    const region = providerRegion('family_name')
    // three candidates, same value; two carry the identical region, one carries none
    const [canonical] = arbitrateDocument([
      cand({ visualEvidence: [region] }),
      cand({ visualEvidence: [region] }),
      cand({}),
    ])
    expect(canonical.visualEvidence).toHaveLength(1) // deduped to a single region
  })

  it('geometry survives the knowledge layer (arbitrateDocument with knowledge ctx)', () => {
    const region = providerRegion('family_name')
    const [canonical] = arbitrateDocument(
      [cand({ value: 'Шевченко', rawCyrillic: 'Шевченко', visualEvidence: [region] })],
      { docTypeId: 'ua_birth_certificate', product: 'translation' } as never,
    )
    expect(canonical.visualEvidence).toBeDefined()
    expect(canonical.visualEvidence![0].status).toBe('exact')
  })

  it('honesty: presence of a bbox does NOT clear review or change the value', () => {
    const region = providerRegion('family_name')
    const [withGeo] = arbitrateDocument([cand({ reviewRequired: true, reviewReasons: ['low_confidence'], confidence: 0.2, visualEvidence: [region] })])
    const [without] = arbitrateDocument([cand({ reviewRequired: true, reviewReasons: ['low_confidence'], confidence: 0.2 })])
    expect(withGeo.reviewRequired).toBe(without.reviewRequired)
    expect(withGeo.rawValue).toBe(without.rawValue)
  })
})
