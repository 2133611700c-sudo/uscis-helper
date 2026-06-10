/**
 * applyDateEnsemble.test.ts — field-level cross-engine date check.
 * Synthetic data only. Pins the real handwritten failure: primary (Gemini) reads
 * the month as July, the second engine (Vision) reads June → force review +
 * attach the second reading; never overwrite, never lower review.
 */
import { describe, it, expect } from 'vitest'
import { extractDateCandidatesFromText } from '../dateReconcile'
import { applyDateEnsemble, type EnsembleField } from '../applyDateEnsemble'

describe('extractDateCandidatesFromText', () => {
  it('pulls Ukrainian/Russian word-month dates and ISO from OCR noise', () => {
    const text = 'родился (лась) 14 июня 1990\nдата видачі 03.05.1991\nact 1990-06-14 №428'
    const got = extractDateCandidatesFromText(text)
    expect(got).toEqual(expect.arrayContaining(['14 июня 1990', '03.05.1991', '1990-06-14']))
  })
  it('returns empty for text with no dates', () => {
    expect(extractDateCandidatesFromText('no dates here, just words')).toEqual([])
  })
})

describe('applyDateEnsemble — cross-engine date conflict', () => {
  const fields: EnsembleField[] = [
    { field: 'child_family_name', kind: 'name', value: 'Kovalenko', review_required: false },
    { field: 'dob', kind: 'date', value: '1990-07-14', raw_cyrillic: '14 липня 1990', review_required: false },
  ]

  it('Gemini July vs Vision June on the same year → force review + candidate attached', () => {
    const out = applyDateEnsemble(fields, 'родился (лась) 14 июня 1990')
    expect(out.applied).toBe(true)
    expect(out.disagreements).toContain('dob')
    const dob = out.fields.find((f) => f.field === 'dob')!
    expect(dob.review_required).toBe(true)
    expect(dob.review_reasons).toContain('date_ensemble_disagreement')
    expect(dob.review_reasons).toContain('date_month_disagreement')
    expect(dob.ensemble_candidate).toBe('14 июня 1990')
    // never overwrites the primary value
    expect(dob.value).toBe('1990-07-14')
  })

  it('agreement → no new review, no disagreement', () => {
    const out = applyDateEnsemble(fields, 'родился (лась) 14 липня 1990')
    expect(out.disagreements).toEqual([])
    const dob = out.fields.find((f) => f.field === 'dob')!
    expect(dob.review_required).toBe(false)
    expect(dob.ensemble_candidate).toBeUndefined()
  })

  it('does not touch non-date fields', () => {
    const out = applyDateEnsemble(fields, 'родился (лась) 14 июня 1990')
    const name = out.fields.find((f) => f.field === 'child_family_name')!
    expect(name.review_required).toBe(false)
  })

  it('an unrelated date on the page (different year) does not false-flag', () => {
    // Vision sees only a 2010 date; the dob is 1990 → no shared-year anchor → no flag.
    const out = applyDateEnsemble(fields, 'якась інша дата 02 березня 2010')
    expect(out.disagreements).toEqual([])
  })

  it('never lowers an already-required review', () => {
    const reviewed: EnsembleField[] = [
      { field: 'dob', kind: 'date', value: '1990-06-14', raw_cyrillic: '14 червня 1990', review_required: true },
    ]
    const out = applyDateEnsemble(reviewed, 'родился 14 июня 1990') // agreement
    expect(out.fields[0].review_required).toBe(true)
  })
})
