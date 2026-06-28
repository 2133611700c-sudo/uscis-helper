/**
 * Workstream A — live review contract annotation (server-side data contract).
 *
 * annotateReviewFields gated on UNIFIED_DOC_CONTRACT_ENABLED:
 *  - OFF → rows unchanged (same reference);
 *  - ON  → each row gets contract_review_state; a fully-split merged field
 *          (certificate_series_number with document_series + document_number present)
 *          is marked evidence_only; split rows are first-class with their own state.
 *
 * Fictional data only.
 */
import { describe, it, expect } from 'vitest'
import { annotateReviewFields, type AnnotatedReviewRow } from '../contractReviewState'

const OFF = {} as Record<string, string | undefined>
const ON = { UNIFIED_DOC_CONTRACT_ENABLED: '1' } as Record<string, string | undefined>

const ROWS: AnnotatedReviewRow[] = [
  { field: 'child_family_name', raw_value: "Солов'як", normalized_value: 'Soloviak', review_required: true, confirmed: false },
  { field: 'child_given_name', raw_value: 'Андрій', normalized_value: 'Andrii', review_required: false, confirmed: true },
  { field: 'certificate_series_number', raw_value: 'II-ВК 530174', normalized_value: 'II-BK 530174', review_required: true, confirmed: false },
  { field: 'document_series', raw_value: 'II-ВК', normalized_value: 'II-BK', review_required: true, confirmed: false },
  { field: 'document_number', raw_value: '530174', normalized_value: '530174', review_required: true, confirmed: false },
  { field: 'place_of_birth_oblast', raw_value: 'Вінницька область', normalized_value: '', review_required: true, confirmed: false },
]

describe('Workstream A — OFF identity', () => {
  it('returns the same reference when flag OFF', () => {
    expect(annotateReviewFields(ROWS, OFF)).toBe(ROWS)
  })
})

describe('Workstream A — ON annotation', () => {
  const out = annotateReviewFields(ROWS, ON)
  const get = (k: string) => out.find((r) => r.field === k)!

  it('every row gets a contract_review_state', () => {
    expect(out.every((r) => typeof r.contract_review_state === 'string')).toBe(true)
    expect(get('child_family_name').contract_review_state).toBe('candidate') // has value, unconfirmed
    expect(get('child_given_name').contract_review_state).toBe('confirmed')
    expect(get('place_of_birth_oblast').contract_review_state).toBe('unreadable') // raw, no normalized value
  })

  it('fully-split merged field is evidence_only (its splits are present)', () => {
    expect(get('certificate_series_number').evidence_only).toBe(true)
    // the split children themselves are NOT evidence_only (first-class editable)
    expect(get('document_series').evidence_only).toBe(false)
    expect(get('document_number').evidence_only).toBe(false)
  })

  it('merged field WITHOUT its splits present stays editable (not evidence_only)', () => {
    const partial = annotateReviewFields([
      { field: 'certificate_series_number', raw_value: 'II-ВК 530174', normalized_value: 'II-BK 530174', review_required: true, confirmed: false },
    ] as AnnotatedReviewRow[], ON)
    expect(partial[0].evidence_only).toBe(false)
  })

  it('does not mutate the input rows', () => {
    expect((ROWS[0] as AnnotatedReviewRow).contract_review_state).toBeUndefined()
  })
})
