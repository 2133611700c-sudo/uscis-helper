/**
 * ua_birth_certificate_soviet — item 5 (2026-07-06). A separate docTypeId for Soviet-era
 * blanks so the "національність"/nationality line can be requested WITHOUT touching the
 * shared, era-agnostic ua_birth_certificate spec (which stays free of that line — modern
 * post-1991 certs don't carry it; requesting it there risked fabrication, see the NOTE on
 * that registry entry). This test locks in: exact-match registry lookup (no accidental
 * inheritance), the two new nationality fields, and crop-box-template inheritance via
 * templateFor()'s substring match (ensemble/handwrittenFieldRoute.ts).
 */
import { describe, it, expect } from 'vitest'
import { DOCUMENT_TYPES, getDocTypeSpec, docTypesForConsumer } from '../documentRegistry'
import { FIELD_BOX_TEMPLATES } from '../ensemble/handwrittenFieldRoute'

describe('ua_birth_certificate_soviet registry entry', () => {
  it('is registered as its own exact-match id, distinct from the shared ua_birth_certificate', () => {
    expect(getDocTypeSpec('ua_birth_certificate_soviet')).not.toBeNull()
    expect(getDocTypeSpec('ua_birth_certificate_soviet')).not.toBe(getDocTypeSpec('ua_birth_certificate'))
    // exact-match only — a near-miss id must NOT resolve to either spec
    expect(getDocTypeSpec('ua_birth_certificate_sovietx')).toBeNull()
  })

  it('carries father_nationality/mother_nationality; the shared ua_birth_certificate spec does not', () => {
    const soviet = getDocTypeSpec('ua_birth_certificate_soviet')!
    const shared = getDocTypeSpec('ua_birth_certificate')!
    expect(soviet.fields.some((f) => f.field === 'father_nationality')).toBe(true)
    expect(soviet.fields.some((f) => f.field === 'mother_nationality')).toBe(true)
    expect(shared.fields.some((f) => f.field === 'father_nationality')).toBe(false)
    expect(shared.fields.some((f) => f.field === 'mother_nationality')).toBe(false)
  })

  it('every field is handwritten:true (vintage hand-filled blank, same invariant as the shared spec)', () => {
    const soviet = getDocTypeSpec('ua_birth_certificate_soviet')!
    expect(soviet.fields.every((f) => f.handwritten === true)).toBe(true)
  })

  it('shares the same consumers as the modern birth-certificate spec', () => {
    const soviet = getDocTypeSpec('ua_birth_certificate_soviet')!
    const shared = getDocTypeSpec('ua_birth_certificate')!
    expect(soviet.consumers.slice().sort()).toEqual(shared.consumers.slice().sort())
    for (const c of soviet.consumers) expect(docTypesForConsumer(c)).toContain('ua_birth_certificate_soviet')
  })

  it('appears in DOCUMENT_TYPES as an additive entry (registry size grew by exactly one)', () => {
    expect(DOCUMENT_TYPES.ua_birth_certificate_soviet).toBeDefined()
  })

  it('inherits the ua_birth_certificate crop-box templates via templateFor()\'s substring match ' +
     '(docTypeId.includes(key)) — "ua_birth_certificate_soviet".includes("ua_birth_certificate") ' +
     'is true, and no OTHER FIELD_BOX_TEMPLATES key is a substring of it, so the match is unambiguous', () => {
    const matches = Object.keys(FIELD_BOX_TEMPLATES).filter((key) => 'ua_birth_certificate_soviet'.includes(key))
    expect(matches).toEqual(['ua_birth_certificate'])
  })
})
