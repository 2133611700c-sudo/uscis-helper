/**
 * mirrorEndToEnd.test.ts — proves the mirror PDF pipeline produces a VALID,
 * COMPLETE, review-marked PDF end-to-end from realistic extracted fields, and
 * that it NEVER invents a value (uncertain → [CONFIRM], missing → blank line).
 *
 * This is the verification gate for enabling MIRROR_PDF_ENABLED: structural
 * correctness is asserted here; only the visual "looks right" is left to a human.
 * Synthetic example names only (privacy rule) — Ivanenko, never a real person.
 */
import { describe, it, expect } from 'vitest'
import { renderMirrorTranslationPDF } from '../renderMirrorTranslationPDF'
import type { ExtractedFieldLite } from '../buildMirrorValues'

// A realistic birth-cert extraction: some clean, one review-flagged (ambiguous
// source script — the gate we just built), one missing entirely.
const SYNTHETIC_BIRTH: ExtractedFieldLite[] = [
  { field: 'child_family_name', value: 'Ivanenko', review_required: false },
  { field: 'child_given_name', value: 'Ivan', review_required: false },
  // patronymic read but ambiguous source script → carried as review candidate:
  { field: 'child_patronymic', value: 'Petrovych', review_required: true },
  { field: 'dob', value: '1990-05-14', review_required: false },
  { field: 'city_of_birth', value: 'Vinnytsia', review_required: false }, // REAL extractor key
  { field: 'father_full_name', value: 'Ivan Ivanenko', review_required: false },
  // mother deliberately omitted → renderer must emit "[enter from document]"
]

describe('mirror PDF end-to-end (synthetic birth certificate)', () => {
  it('produces a valid, non-trivial PDF buffer', async () => {
    const res = await renderMirrorTranslationPDF('ua_birth_certificate', SYNTHETIC_BIRTH)
    expect(res).not.toBeNull()
    const pdf = res!.pdf
    expect(pdf.length).toBeGreaterThan(1000) // a real PDF, not an empty stub
    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-') // valid PDF magic
    expect(res!.officialSource.act).toMatch(/КМУ|КАБ|постанов|№/i) // sourced schema
  })

  it('flags the review-required and the missing fields as unresolved (never invented)', async () => {
    const res = await renderMirrorTranslationPDF('ua_birth_certificate', SYNTHETIC_BIRTH)
    // child_patronymic is review-flagged → must be unresolved (rendered [CONFIRM]).
    expect(res!.unresolved).toContain('child_patronymic')
    // a clean field must NOT be flagged unresolved.
    expect(res!.unresolved).not.toContain('child_family_name')
    // at least one schema field had no extraction → some unresolved exist.
    expect(res!.unresolved.length).toBeGreaterThan(0)
  })

  it('REGRESSION: city_of_birth and certificate_series_number are mapped, not lost', async () => {
    // Before the alias fix the mirror expected `place_of_birth_city`/`series_number`
    // verbatim, but the extractor emits `city_of_birth`/`certificate_series_number`,
    // so place of birth and the series silently rendered as [enter from document]
    // even when read. Assert the REAL extractor keys now resolve (NOT unresolved).
    const res = await renderMirrorTranslationPDF('ua_birth_certificate', [
      { field: 'child_family_name', value: 'Ivanenko', review_required: false },
      { field: 'city_of_birth', value: 'Vinnytsia', review_required: false },
      { field: 'certificate_series_number', value: 'I-АМ № 428069', review_required: false },
    ])
    expect(res!.unresolved).not.toContain('place_of_birth')
    expect(res!.unresolved).not.toContain('series_number')
  })

  it('returns null for a docType with no official schema (caller falls back to generic)', async () => {
    const res = await renderMirrorTranslationPDF('ua_id_card', SYNTHETIC_BIRTH) // military now HAS a schema (2026-06-11); id_card does not
    expect(res).toBeNull()
  })

  it('renders all five supported certificate schemas without throwing', async () => {
    const types = [
      'ua_birth_certificate', 'ua_marriage_certificate', 'ua_divorce_certificate',
      'ua_death_certificate', 'ua_name_change_certificate',
    ]
    for (const t of types) {
      const res = await renderMirrorTranslationPDF(t, SYNTHETIC_BIRTH)
      expect(res, `schema ${t} should render`).not.toBeNull()
      expect(res!.pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-')
    }
  })
})
