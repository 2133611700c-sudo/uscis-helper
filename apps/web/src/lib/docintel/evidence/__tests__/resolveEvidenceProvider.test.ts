/**
 * resolveEvidenceProvider — strict, default-OFF, fail-open switch (One-Brain §7 / Gate 3).
 * Proves the provider is turn-on-able by config alone but safely off by default, and that
 * flag-ON-without-credentials never throws and never harms extraction.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'

// Mock the Google Vision provider at the boundary so no network / no credentials are needed.
const extractTextMock = vi.fn()
vi.mock('@/lib/ocr/providers/google-vision', () => ({
  googleVisionProvider: { name: 'google_vision', extractText: (...a: unknown[]) => extractTextMock(...a) },
}))

import { resolveEvidenceProvider, isGoogleVisionEvidenceEnabled } from '../resolveEvidenceProvider'
import { disabledEvidenceProvider } from '../evidenceProvider'
import { googleVisionEvidenceProvider } from '../googleVisionEvidenceProvider'

const env = (v?: string) => (v === undefined ? {} : { GOOGLE_VISION_EVIDENCE_ENABLED: v }) as NodeJS.ProcessEnv

afterEach(() => extractTextMock.mockReset())

describe('isGoogleVisionEvidenceEnabled — strict "1"', () => {
  it('absent → false', () => expect(isGoogleVisionEvidenceEnabled(env())).toBe(false))
  it('"0" → false', () => expect(isGoogleVisionEvidenceEnabled(env('0'))).toBe(false))
  it('"true" → false (loosely-truthy never enables)', () => expect(isGoogleVisionEvidenceEnabled(env('true'))).toBe(false))
  it('"yes" → false', () => expect(isGoogleVisionEvidenceEnabled(env('yes'))).toBe(false))
  it('"1" → true', () => expect(isGoogleVisionEvidenceEnabled(env('1'))).toBe(true))
})

describe('resolveEvidenceProvider — default-off switch', () => {
  it('1. flag absent → disabledEvidenceProvider', () => {
    expect(resolveEvidenceProvider(env())).toBe(disabledEvidenceProvider)
  })
  it('2. "0" → disabled', () => expect(resolveEvidenceProvider(env('0'))).toBe(disabledEvidenceProvider))
  it('3. "true" → disabled', () => expect(resolveEvidenceProvider(env('true'))).toBe(disabledEvidenceProvider))
  it('4. "1" → googleVisionEvidenceProvider', () => {
    expect(resolveEvidenceProvider(env('1'))).toBe(googleVisionEvidenceProvider)
  })

  it('6. flag OFF → the Google client (extractText) is NEVER called', async () => {
    const p = resolveEvidenceProvider(env())
    await p.locateEvidence({ document: { buffer: Buffer.from('x'), mime: 'image/jpeg' }, fields: [{ key: 'family_name', value: 'X' }] })
    expect(extractTextMock).not.toHaveBeenCalled()
  })

  it('5. "1" + missing credentials (extractText blocked) → fail-open unavailable, never throws', async () => {
    extractTextMock.mockResolvedValue({ blocked: true, reason: 'no_credentials' })
    const p = resolveEvidenceProvider(env('1'))
    const res = await p.locateEvidence({ document: { buffer: Buffer.from('x'), mime: 'image/jpeg' }, fields: [{ key: 'family_name', value: 'X' }] })
    expect(res.status).toBe('unavailable')
  })

  it('7. "1" + provider throws → resolver-selected provider still resolves unavailable (no throw)', async () => {
    extractTextMock.mockRejectedValue(new Error('network'))
    const p = resolveEvidenceProvider(env('1'))
    await expect(
      p.locateEvidence({ document: { buffer: Buffer.from('x'), mime: 'image/jpeg' }, fields: [{ key: 'family_name', value: 'X' }] }),
    ).resolves.toMatchObject({ status: 'unavailable' })
  })
})
