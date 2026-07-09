/**
 * canonicalRegistry.test.ts — Phase 1 canonical registry contract.
 * Pure: registry shape + fail-closed guarantees + validator. No network, no providers.
 */
import { describe, it, expect } from 'vitest'
import {
  CANONICAL_DOCUMENT_REGISTRY as REG,
  validateCanonicalDocumentRegistry,
  getCanonicalEntry,
  DOCUMENT_TYPE_IDS,
  READER_ROUTE_IDS,
  SERVICE_ROUTE_IDS,
  type CanonicalRegistryEntry,
} from '../canonicalRegistry'

describe('registry shape', () => {
  it('exports every required entry', () => {
    for (const id of ['i94', 'ead_card', 'i797_notice', 'us_drivers_license', 'passport',
      'ua_birth_certificate_soviet', 'ua_birth_certificate_modern', 'ua_marriage_certificate',
      'unknown', 'unsupported', 'not_a_document']) {
      expect(REG[id as keyof typeof REG], `missing ${id}`).toBeDefined()
    }
  })
  it('every entry key equals its id (no duplicate/mismatch)', () => {
    for (const [k, e] of Object.entries(REG)) expect(k).toBe(e.id)
    expect(new Set(DOCUMENT_TYPE_IDS).size).toBe(DOCUMENT_TYPE_IDS.length)
  })
  it('every entry has family, supportedStatus, handwritingPolicy, reviewPolicy', () => {
    for (const e of Object.values(REG)) {
      expect(e.family).toBeTruthy(); expect(e.supportedStatus).toBeTruthy()
      expect(e.handwritingPolicy).toBeTruthy(); expect(e.reviewPolicy).toBeTruthy()
    }
  })
  it('all service/reader routes reference known ids', () => {
    for (const e of Object.values(REG)) {
      expect(READER_ROUTE_IDS as readonly string[]).toContain(e.readerRoute)
      for (const s of e.serviceRoutes) expect(SERVICE_ROUTE_IDS as readonly string[]).toContain(s)
    }
  })
  it('expected/risky/required fields are internally consistent', () => {
    for (const e of Object.values(REG)) {
      for (const f of e.riskyFields) expect(e.expectedFields, `${e.id} risky`).toContain(f)
      for (const f of e.requiredFields) expect(e.expectedFields, `${e.id} required`).toContain(f)
    }
  })
})

describe('validator', () => {
  it('the shipped registry validates clean', () => {
    const r = validateCanonicalDocumentRegistry()
    expect(r.errors).toEqual([])
    expect(r.ok).toBe(true)
  })
  it('rejects a duplicate id', () => {
    const bad = { ...REG, dup: { ...REG.i94 } } as Record<string, CanonicalRegistryEntry>
    // key 'dup' != id 'i94' AND id 'i94' now duplicated
    const r = validateCanonicalDocumentRegistry(bad)
    expect(r.ok).toBe(false)
    expect(r.errors.join(' ')).toMatch(/duplicate id 'i94'|key 'dup' != id/)
  })
  it('rejects an expectedField outside the canonical field vocabulary', () => {
    const bad = { ...REG, i94: { ...REG.i94, expectedFields: [...REG.i94.expectedFields, 'made_up_field' as never] } }
    expect(validateCanonicalDocumentRegistry(bad as never).ok).toBe(false)
  })
  it('rejects minConfidenceToRoute > minConfidenceToTrust', () => {
    const bad = { ...REG, i94: { ...REG.i94, minConfidenceToRoute: 0.99, minConfidenceToTrust: 0.5 } }
    expect(validateCanonicalDocumentRegistry(bad as never).ok).toBe(false)
  })
  it('rejects an active status with readerRoute none', () => {
    const bad = { ...REG, i94: { ...REG.i94, readerRoute: 'none' as const } }
    expect(validateCanonicalDocumentRegistry(bad as never).ok).toBe(false)
  })
  it('rejects a soviet civil record that is not force_review', () => {
    const bad = { ...REG, ua_birth_certificate_soviet: { ...REG.ua_birth_certificate_soviet, handwritingPolicy: 'not_expected' as const } }
    expect(validateCanonicalDocumentRegistry(bad as never).ok).toBe(false)
  })
})

describe('fail-closed guarantees', () => {
  it('unknown → unknown_reader + manual_review_required', () => {
    expect(REG.unknown.readerRoute).toBe('unknown_reader')
    expect(REG.unknown.reviewPolicy).toBe('manual_review_required')
  })
  it('unsupported → manual review, no service routes', () => {
    expect(REG.unsupported.reviewPolicy).toBe('manual_review_required')
    expect(REG.unsupported.serviceRoutes).toEqual([])
  })
  it('not_a_document → reject_or_retake + reader none', () => {
    expect(REG.not_a_document.reviewPolicy).toBe('reject_or_retake')
    expect(REG.not_a_document.readerRoute).toBe('none')
  })
  it('soviet birth certificate forces handwriting review', () => {
    expect(REG.ua_birth_certificate_soviet.handwritingPolicy).toBe('force_review')
    expect(REG.ua_birth_certificate_soviet.reviewPolicy).toBe('force_review_handwritten_fields')
  })
  it('#1: handwriting = high_risk_force_review, NOT an external HTR-host dependency', () => {
    // HTR is our OWN capability, never a required third-party host. Handwriting safety comes from the
    // force_review policy, so the soviet birth cert must NOT carry an htr external blocker...
    expect(REG.ua_birth_certificate_soviet.externalBlockers.some((b) => b.includes('htr'))).toBe(false)
    // ...but handwriting is STILL always force-reviewed (the real, host-independent guarantee).
    expect(REG.ua_birth_certificate_soviet.handwritingPolicy).toBe('force_review')
  })
  it('us_drivers_license now has a registry entry (Phase 0 gap closed)', () => {
    expect(REG.us_drivers_license).toBeDefined()
    expect(REG.us_drivers_license.readerRoute).toBe('us_drivers_license_reader')
  })
  it('getCanonicalEntry fails closed to unknown for an unrecognized id', () => {
    expect(getCanonicalEntry('totally_made_up').id).toBe('unknown')
  })
})

describe('no-behavior-change (Phase 1 is pure data)', () => {
  it('registry module imports nothing that performs I/O (structural: entries are plain data)', () => {
    // every entry is a plain object with primitive/array fields — no functions, no promises
    for (const e of Object.values(REG)) {
      for (const v of Object.values(e)) {
        expect(typeof v === 'function').toBe(false)
      }
    }
  })
})
