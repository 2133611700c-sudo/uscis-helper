/**
 * reviewGate.test.ts — the Translation Review Gate hard block (v2).
 * Final certified output requires name + address + 2 attestation checkboxes +
 * a completed signature. Anything missing → refusal.
 */
import { describe, it, expect } from 'vitest'
import { assertReviewGate, getUnresolvedReviewFields, isSignatureComplete } from '../reviewGate'

const ID = { signerName: 'Ivan Ivanenko', signerAddress: '1213 Gordon St, Los Angeles, CA 90038' }
const SIG = { signedAt: '2026-05-30T12:00:00.000Z', signatureMethod: 'drawn_on_screen' as const, signatureDataUrl: 'data:image/png;base64,iVBORw0KGgo=' }
const CHECKS = { dataReviewed: true, accuracyAttested: true }

describe('assertReviewGate v2 — hard block', () => {
  it('blocks a machine-only request (no name)', () => {
    const r = assertReviewGate({})
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('signer_name_required')
  })

  it('blocks name present but address missing', () => {
    const r = assertReviewGate({ signerName: ID.signerName, ...CHECKS, ...SIG })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('signer_address_required')
  })

  it('blocks when checkbox 1 (data reviewed) is missing', () => {
    const r = assertReviewGate({ ...ID, accuracyAttested: true, ...SIG })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('data_not_reviewed')
  })

  it('blocks when checkbox 2 (accuracy attested) is missing', () => {
    const r = assertReviewGate({ ...ID, dataReviewed: true, ...SIG })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('accuracy_not_attested')
  })

  it('blocks when signature is missing', () => {
    const r = assertReviewGate({ ...ID, ...CHECKS })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('signature_required')
  })

  it('blocks when OCR review_required fields are still unresolved', () => {
    const r = assertReviewGate({
      ...ID,
      ...CHECKS,
      ...SIG,
      extractedFields: [
        { field: 'family_name', normalized_value: 'Ivanenko', review_required: false },
        { field: 'given_name', normalized_value: 'Ivan', review_required: true },
      ],
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('ocr_review_unresolved')
  })

  it('blocks a drawn signature with no data URL', () => {
    const r = assertReviewGate({ ...ID, ...CHECKS, signedAt: SIG.signedAt, signatureMethod: 'drawn_on_screen', signatureDataUrl: '' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('signature_required')
  })

  it('ALLOWS name + address + both checkboxes + drawn signature', () => {
    expect(assertReviewGate({ ...ID, ...CHECKS, ...SIG }).ok).toBe(true)
  })

  it('ALLOWS a wet signature', () => {
    expect(assertReviewGate({ ...ID, ...CHECKS, signedAt: SIG.signedAt, signatureMethod: 'manual_wet_signature' }).ok).toBe(true)
  })

  it('back-compat: reviewConfirmed=true satisfies both checkboxes', () => {
    expect(assertReviewGate({ ...ID, reviewConfirmed: true, ...SIG }).ok).toBe(true)
  })

  it('blocks whitespace-only name', () => {
    const r = assertReviewGate({ signerName: '   ', signerAddress: ID.signerAddress, ...CHECKS, ...SIG })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('signer_name_required')
  })
})

describe('isSignatureComplete', () => {
  it('false without signedAt', () => { expect(isSignatureComplete({ signatureMethod: 'manual_wet_signature' })).toBe(false) })
  it('true for wet signature with signedAt', () => { expect(isSignatureComplete({ signedAt: SIG.signedAt, signatureMethod: 'manual_wet_signature' })).toBe(true) })
  it('false for drawn without data url', () => { expect(isSignatureComplete({ signedAt: SIG.signedAt, signatureMethod: 'drawn_on_screen' })).toBe(false) })
})

describe('getUnresolvedReviewFields', () => {
  it('returns review_required fields and blank values', () => {
    expect(getUnresolvedReviewFields([
      { field: 'family_name', normalized_value: 'Ivanenko', review_required: false },
      { field: 'given_name', normalized_value: '', review_required: false },
      { field: 'dob', normalized_value: '1990-01-01', review_required: true },
    ])).toEqual(['given_name', 'dob'])
  })

  it('returns empty array when every field is resolved', () => {
    expect(getUnresolvedReviewFields([
      { field: 'family_name', normalized_value: 'Ivanenko', review_required: false },
      { field: 'given_name', normalized_value: 'Ivan', review_required: false },
    ])).toEqual([])
  })
})
