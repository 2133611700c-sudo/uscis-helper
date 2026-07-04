/**
 * ONE-BRAIN v2 Phase 3 — one-arbitration SHADOW instrument.
 * Pins: legacy→candidate emitter preserves values/provenance/review; the differ
 * classifies coverage loss / value drift / review loosening-vs-tightening correctly;
 * strict flag. FICTIONAL data only.
 */
import { describe, it, expect } from 'vitest'
import {
  legacyFieldsToCandidates,
  runOneArbitrationShadow,
  isTpsOneArbitrationShadowEnabled,
} from '../oneArbitrationShadow'
import type { TpsExtractedField, TpsModuleResult } from '../types'

const tf = (over: Partial<TpsExtractedField> & { field: string }): TpsExtractedField => ({
  field: over.field,
  raw_value: over.raw_value ?? 'RAW',
  normalized_value: over.normalized_value ?? 'Norm',
  extraction_source: over.extraction_source ?? 'ocr_visual',
  source_document_id: 'doc-1',
  source_zone: over.source_zone ?? 'zone_a',
  bbox: null,
  language_layer: over.language_layer ?? 'latin',
  confidence: over.confidence ?? 0.9,
  review_required: over.review_required ?? false,
  ocr_word_ids: [],
  passes: [],
  failures: [],
  user_corrected: false,
})

const legacyResult = (fields: TpsExtractedField[]): TpsModuleResult => ({
  module: 'i94' as never,
  matched: true,
  match_reason: 'rule',
  fields,
  warnings: [],
  manual_review_required: false,
  manual_review_reasons: [],
})

describe('legacyFieldsToCandidates — observation-only emitter', () => {
  it('preserves value/confidence/review + per-field provenance', () => {
    const [c] = legacyFieldsToCandidates([
      tf({ field: 'i94_admission_number', normalized_value: '12345678901', extraction_source: 'ocr_keyword', review_required: true }),
    ])
    expect(c.key).toBe('i94_admission_number')
    expect(c.value).toBe('12345678901')
    expect(c.provider).toBe('tps_legacy:ocr_keyword')
    expect(c.reviewRequired).toBe(true)
  })

  it('MRZ zones keep source mrz (arbitration MRZ-authority applies as in live Core)', () => {
    const [c] = legacyFieldsToCandidates([tf({ field: 'passport_number', source_zone: 'mrz_line_2' })])
    expect(c.source).toBe('mrz')
  })

  it('cyrillic layer carries rawCyrillic', () => {
    const [c] = legacyFieldsToCandidates([
      tf({ field: 'family_name_cyrillic', raw_value: 'Тестенко', language_layer: 'cyrillic' }),
    ])
    expect(c.rawCyrillic).toBe('Тестенко')
  })
})

describe('runOneArbitrationShadow — PII-free differ semantics', () => {
  it('same fields in → no coverage loss; diff carries only keys/counts (no values)', () => {
    const legacy = legacyResult([
      tf({ field: 'family_name', normalized_value: 'Testenko' }),
      tf({ field: 'given_name', normalized_value: 'Ivan' }),
    ])
    const d = runOneArbitrationShadow(legacy, 'i94', 'doc-1')
    expect(d.missing_in_shadow).toEqual([])
    expect(d.legacy_fields).toBe(2)
    expect(d.shadow_fields).toBeGreaterThan(0)
    // PII-free: the serialized diff must not contain field VALUES
    const json = JSON.stringify(d)
    expect(json).not.toContain('Testenko')
    expect(json).not.toContain('Ivan')
  })

  it('review tightening is recorded as tightened (acceptable), not loosened', () => {
    // critical identity field with no MRZ anchor → arbitration forces review even
    // though legacy had it clean — that's monotonic-UP, allowed.
    const legacy = legacyResult([tf({ field: 'family_name', normalized_value: 'Testenko', review_required: false })])
    const d = runOneArbitrationShadow(legacy, 'i94', 'doc-1')
    expect(d.review_loosened_keys).toEqual([])
    // family_name is critical → shadow reviews it
    expect(d.review_tightened_keys).toContain('family_name')
  })

  it('strict flag: absent/"true"/"0" OFF, "1" ON', () => {
    expect(isTpsOneArbitrationShadowEnabled({})).toBe(false)
    expect(isTpsOneArbitrationShadowEnabled({ TPS_ONE_ARBITRATION_SHADOW: 'true' })).toBe(false)
    expect(isTpsOneArbitrationShadowEnabled({ TPS_ONE_ARBITRATION_SHADOW: '0' })).toBe(false)
    expect(isTpsOneArbitrationShadowEnabled({ TPS_ONE_ARBITRATION_SHADOW: '1' })).toBe(true)
  })
})
