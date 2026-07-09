/**
 * realProviders.test.ts — the deterministic, vision-free parts of the real intake providers.
 * PII-free: all images are synthetic solid-colour tiles generated at runtime.
 */
import { describe, it, expect } from 'vitest'
import sharp from 'sharp'
import { realPreflight, PREFLIGHT_MIN_SIDE_PX, declaredToCanonical } from '../realProviders'

function tile(w: number, h: number): Promise<Buffer> {
  return sharp({ create: { width: w, height: h, channels: 3, background: { r: 200, g: 200, b: 200 } } }).jpeg().toBuffer()
}

describe('realPreflight — deterministic, fail-closed image gate', () => {
  it('a normal-sized image → isDocument, quality ok, measured', async () => {
    const p = await realPreflight(await tile(1200, 900))
    expect(p.isDocument).toBe(true)
    expect(p.mediaType).toBe('image')
    expect(p.quality).toBe('ok')
    expect(p.pageCount).toBe(1)
  })
  it(`an image below ${PREFLIGHT_MIN_SIDE_PX}px on the short side → quality low`, async () => {
    const p = await realPreflight(await tile(300, 200))
    expect(p.isDocument).toBe(true) // decodable, but too small to read reliably
    expect(p.quality).toBe('low')
  })
  it('a corrupt / non-image buffer → fail-closed not-a-document', async () => {
    const p = await realPreflight(Buffer.from('this is not an image at all'))
    expect(p.isDocument).toBe(false)
    expect(p.mediaType).toBe('unknown')
    expect(p.quality).toBe('low')
  })
  it('an empty buffer → fail-closed', async () => {
    const p = await realPreflight(Buffer.alloc(0))
    expect(p.isDocument).toBe(false)
  })
})

describe('declaredToCanonical — maps a service hint to a canonical id or null', () => {
  it('maps known docintel ids', () => {
    expect(declaredToCanonical('ua_birth_certificate_soviet')).toBe('ua_birth_certificate_soviet')
    expect(declaredToCanonical('ua_internal_passport_booklet')).toBe('passport')
  })
  it('unknown / empty → null (never a fabricated type)', () => {
    expect(declaredToCanonical('made_up_type')).toBeNull()
    expect(declaredToCanonical(null)).toBeNull()
    expect(declaredToCanonical(undefined)).toBeNull()
  })
})
