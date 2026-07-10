/**
 * detectDocumentTypeCatalog.test.ts — regression guard for the 2026-07-10 live finding:
 * the intake docType detector classified a real Soviet birth certificate as 'unknown' because
 * knownTypeCatalog() was built from the field-reader DOCUMENT_TYPES registry, which (on this
 * branch) lacks ua_birth_certificate_soviet — so the model was never offered it, even though its
 * signature exists and normalizeDetection() would accept it. The catalog must be built from
 * DOC_TYPE_SIGNATURES so the advertised set == the accepted set.
 */
import { describe, it, expect } from 'vitest'
import { knownTypeCatalog, DOC_TYPE_SIGNATURES } from '../detectDocumentType'

describe('docType detector — catalog == signature set (no silently-dropped types)', () => {
  const ids = knownTypeCatalog().map((e) => e.id)

  it('offers ua_birth_certificate_soviet (the live-regression case)', () => {
    expect(ids).toContain('ua_birth_certificate_soviet')
  })

  it('the advertised catalog equals the accepted set (DOC_TYPE_SIGNATURES keys)', () => {
    expect(new Set(ids)).toEqual(new Set(Object.keys(DOC_TYPE_SIGNATURES)))
  })

  it('every offered entry carries a non-empty signature', () => {
    for (const e of knownTypeCatalog()) {
      expect(e.signature.length).toBeGreaterThan(0)
    }
  })
})
