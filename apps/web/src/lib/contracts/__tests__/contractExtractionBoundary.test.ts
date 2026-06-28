/**
 * Workstream D — Gemini→contract extraction boundary.
 * Schema from contract; candidate-only; malformed/confirmed-stripping; provenance.
 * Fictional data only.
 */
import { describe, it, expect } from 'vitest'
import {
  buildContractExtractionSchema,
  buildExtractionProvenance,
  sanitizeContractExtractionResponse,
  CONTRACT_EXTRACTION_SCHEMA_VERSION,
} from '../contractExtractionBoundary'

describe('Workstream D — schema from contract', () => {
  it('derives the extraction schema from the contract (read-side keys)', () => {
    const s = buildContractExtractionSchema('ua_birth_certificate')!
    expect(s.schemaVersion).toBe(CONTRACT_EXTRACTION_SCHEMA_VERSION)
    const keys = s.fields.map((f) => f.key)
    expect(keys).toContain('child_family_name')
    expect(keys).toContain('dob')
    expect(keys).toContain('certificate_series_number')
    // required REQUIRED_ONCE fields flagged
    expect(s.fields.find((f) => f.key === 'child_family_name')!.required).toBe(true)
  })
  it('returns null for an unmodeled docType', () => {
    expect(buildContractExtractionSchema('ua_international_passport')).toBeNull()
  })
})

describe('Workstream D — provenance', () => {
  it('captures provider/requested/actual model + flags fallback mismatch', () => {
    const p = buildExtractionProvenance({ provider: 'gemini', requestedModel: 'gemini-2.5-pro', actualModel: 'gemini-2.5-pro', extractedAt: '2026-06-28T00:00:00Z' })
    expect(p.modelMismatch).toBe(false)
    expect(p.promptSchemaVersion).toBe(CONTRACT_EXTRACTION_SCHEMA_VERSION)
    const f = buildExtractionProvenance({ provider: 'gemini', requestedModel: 'gemini-2.5-pro', actualModel: 'gemini-2.5-flash', extractedAt: '2026-06-28T00:00:00Z' })
    expect(f.modelMismatch).toBe(true) // silent fallback surfaced
  })
})

describe('Workstream D — sanitize model response (candidate-only)', () => {
  const raw = [
    { field: 'child_family_name', value: 'Soloviak', raw_cyrillic: "Солов'як", confirmed: true, final_value: 'Soloviak' }, // model wrongly claims confirmed
    { field: 'dob', value: '1990-01-15' },
    { field: 'totally_made_up', value: 'x' }, // unknown key
    { field: 'child_patronymic', value: '' }, // empty → no fabrication
  ]
  const out = sanitizeContractExtractionResponse(raw, 'ua_birth_certificate')

  it('strips model-claimed confirmed/final_value; confirmed is ALWAYS false', () => {
    expect(out.strippedConfirmedClaims).toContain('child_family_name')
    expect(out.fields.every((f) => f.confirmed === false)).toBe(true)
  })
  it('drops unknown keys (no schema drift/injection)', () => {
    expect(out.droppedUnknownKeys).toContain('totally_made_up')
    expect(out.fields.find((f) => f.field === 'totally_made_up')).toBeUndefined()
  })
  it('handwritten/critical field kept as review-required candidate', () => {
    expect(out.fields.find((f) => f.field === 'child_family_name')!.review_required).toBe(true)
  })
  it('empty value is not fabricated (value=null, review_required)', () => {
    const pat = out.fields.find((f) => f.field === 'child_patronymic')!
    expect(pat.value).toBeNull()
    expect(pat.review_required).toBe(true)
  })
})
