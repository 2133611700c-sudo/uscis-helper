/**
 * reviewGate.test.ts — the Translation Review Gate hard block.
 * Proves a certified translation can only render after a human confirmed the
 * review (explicit checkbox OR completed signature) with signer identity present.
 */
import { describe, it, expect } from 'vitest'
import { assertReviewGate, isSignatureComplete } from '../reviewGate'

const SIGNER = { signerName: 'Serhii Kuropiatnyk', signerAddress: '1213 Gordon St, Los Angeles, CA 90038' }

describe('assertReviewGate — hard block', () => {
  it('blocks machine-only request (no review, no signature)', () => {
    const r = assertReviewGate({ ...SIGNER })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('review_not_confirmed')
  })

  it('blocks reviewConfirmed=false and unsigned', () => {
    const r = assertReviewGate({ ...SIGNER, reviewConfirmed: false })
    expect(r.ok).toBe(false)
  })

  it('blocks reviewConfirmed=true but signerName missing', () => {
    const r = assertReviewGate({ reviewConfirmed: true, signerAddress: SIGNER.signerAddress })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('signer_name_required')
  })

  it('allows reviewConfirmed=true with name but missing address — WARNS, does not block (live wizard sends empty addr)', () => {
    const r = assertReviewGate({ reviewConfirmed: true, signerName: SIGNER.signerName })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.warnings).toContain('signer_address_missing')
  })

  it('allows reviewConfirmed=true + full signer data with no warnings', () => {
    const r = assertReviewGate({ ...SIGNER, reviewConfirmed: true })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.warnings).toEqual([])
  })

  it('allows a completed drawn signature with signer data (legit wizard path)', () => {
    const r = assertReviewGate({
      ...SIGNER,
      signedAt: '2026-05-29T12:00:00.000Z',
      signatureMethod: 'drawn_on_screen',
      signatureDataUrl: 'data:image/png;base64,iVBORw0KGgo=',
    })
    expect(r.ok).toBe(true)
  })

  it('allows a manual wet signature with signer data', () => {
    const r = assertReviewGate({
      ...SIGNER,
      signedAt: '2026-05-29T12:00:00.000Z',
      signatureMethod: 'manual_wet_signature',
    })
    expect(r.ok).toBe(true)
  })

  it('blocks a drawn signature that has no data URL (incomplete act)', () => {
    const r = assertReviewGate({
      ...SIGNER,
      signedAt: '2026-05-29T12:00:00.000Z',
      signatureMethod: 'drawn_on_screen',
      signatureDataUrl: '',
    })
    expect(r.ok).toBe(false)
  })

  it('blocks whitespace-only signer name', () => {
    const r = assertReviewGate({ signerName: '   ', signerAddress: '  ', reviewConfirmed: true })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('signer_name_required')
  })

  it('models the live TranslateWizard payload (drawn sig, name, empty addr) → render allowed + address warning', () => {
    const r = assertReviewGate({
      signerName: 'Serhii Kuropiatnyk',
      signerAddress: '',
      signedAt: '2026-05-29T12:00:00.000Z',
      signatureMethod: 'drawn_on_screen',
      signatureDataUrl: 'data:image/png;base64,iVBORw0KGgo=',
    })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.warnings).toContain('signer_address_missing')
  })
})

describe('isSignatureComplete', () => {
  it('false without signedAt', () => {
    expect(isSignatureComplete({ signatureMethod: 'manual_wet_signature' })).toBe(false)
  })
  it('true for wet signature with signedAt', () => {
    expect(isSignatureComplete({ signedAt: '2026-05-29T12:00:00Z', signatureMethod: 'manual_wet_signature' })).toBe(true)
  })
  it('false for drawn without data url', () => {
    expect(isSignatureComplete({ signedAt: '2026-05-29T12:00:00Z', signatureMethod: 'drawn_on_screen' })).toBe(false)
  })
})
