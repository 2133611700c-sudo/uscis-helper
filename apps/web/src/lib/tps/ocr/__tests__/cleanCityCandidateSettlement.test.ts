/**
 * cleanCityCandidate — Ukrainian "селище" settlement-designator stripping — NEW 2026-07-06.
 *
 * BUG FOUND + FIXED: cleanCityCandidate's settlement-designator regex used
 * `\b(?:...|селище...)\b` — JS `\b` is ASCII-only (`\w` never includes Cyrillic, even with the
 * `/u` flag), so the Ukrainian "селище"/"селище міського типу" branch could never match; only the
 * English "urban-type settlement"/"settlement" branches ever fired. Verified directly in Node
 * before this fix. FICTIONAL place name used throughout (project PII policy).
 */
import { describe, it, expect } from 'vitest'
import { postExtractNormalize } from '../postExtractNormalize'
import type { TpsExtractedField } from '@/lib/tps/types'

const cityField = (raw: string): TpsExtractedField => ({
  field: 'city_of_birth',
  raw_value: raw,
  normalized_value: raw,
  extraction_source: 'document_ai' as TpsExtractedField['extraction_source'],
  source_document_id: 'fictional_doc',
  source_zone: 'visual',
  bbox: null,
  confidence: 0.9,
  review_required: false,
  passes: [],
  failures: [],
} as unknown as TpsExtractedField)

describe('cleanCityCandidate (via postExtractNormalize) — Ukrainian settlement designator', () => {
  it('strips bare "селище" so the field is NOT rejected for containing a settlement descriptor', () => {
    const fields = [cityField('селище Тростянець')]
    postExtractNormalize(fields)
    const f = fields[0]
    expect(f.failures.some((x) => x.includes('contains_settlement_descriptor'))).toBe(false)
    expect((f.normalized_value ?? '').toLowerCase()).not.toContain('селище')
  })

  it('strips "селище міського типу" (the fuller form)', () => {
    const fields = [cityField('селище міського типу Тростянець')]
    postExtractNormalize(fields)
    const f = fields[0]
    expect((f.normalized_value ?? '').toLowerCase()).not.toContain('селище')
    expect((f.normalized_value ?? '').toLowerCase()).not.toContain('міського')
  })

  it('the fixed designator regex does not itself over-strip mid-word Cyrillic ("Поселище" is ' +
    'separately rejected by the pre-existing, unrelated CITY_NOISE_RE substring filter — ' +
    'confirmed here so this fix is not mistaken for the cause of that rejection)', () => {
    const fields = [cityField('Поселище')]
    postExtractNormalize(fields)
    const f = fields[0]
    expect(f.failures).toContain('knowledge_city_rejected:contains_label_noise')
    expect(f.failures.some((x) => x.includes('contains_settlement_descriptor'))).toBe(false)
  })

  it('regression guard: the pre-existing English "settlement" designator still gets rejected upstream (unrelated to this fix)', () => {
    const fields = [cityField('urban-type settlement Trostianets')]
    postExtractNormalize(fields)
    const f = fields[0]
    expect(f.failures.some((x) => x.includes('contains_settlement_descriptor'))).toBe(true)
  })
})
