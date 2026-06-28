/**
 * Locks the unified birth-cert contract to the LIVE A (documentRegistry) and B
 * (birth-certificate.schema) layers. If anyone changes a read-side or output field
 * name, this test fails until the contract is updated — so the single namespace can
 * never silently drift back into separate islands.
 *
 * Pure assertions over exported data; no runtime behaviour touched.
 */
import { describe, it, expect } from 'vitest'
import {
  birthCertSovietV1Contract as CONTRACT,
  BIRTH_CERT_LEGACY_DOCTYPE,
  readKeyToRuntime,
  outputKeyToRuntime,
  canonicalToRuntime,
} from '../birthCertSovietV1Contract'
import { getDocTypeSpec } from '@/lib/docintel/documentRegistry'
import { birthCertificateSchema } from '@/lib/translation/forms/ukraine/schemas/birth-certificate.schema'

const A_KEYS = (getDocTypeSpec(BIRTH_CERT_LEGACY_DOCTYPE)?.fields ?? []).map((f) => f.field)
const B_FIELDS = birthCertificateSchema.fields
const B_KEYS = B_FIELDS.map((f) => f.key)

describe('birthCertSovietV1Contract — structural integrity', () => {
  it('A and B layers both exist and refine ua_birth_certificate', () => {
    expect(A_KEYS.length).toBeGreaterThan(0)
    expect(B_KEYS.length).toBeGreaterThan(0)
    expect(birthCertificateSchema.docType).toBe(BIRTH_CERT_LEGACY_DOCTYPE)
  })

  it('runtimeKey, canonicalKey and order are unique', () => {
    const rt = CONTRACT.map((f) => f.runtimeKey)
    const ck = CONTRACT.map((f) => f.canonicalKey)
    const ord = CONTRACT.map((f) => f.order)
    expect(new Set(rt).size).toBe(rt.length)
    expect(new Set(ck).size).toBe(ck.length)
    expect(new Set(ord).size).toBe(ord.length)
  })

  it('every readSideKey / outputKey is unique across the contract', () => {
    const reads = CONTRACT.map((f) => f.readSideKey).filter(Boolean)
    const outs = CONTRACT.map((f) => f.outputKey).filter(Boolean)
    expect(new Set(reads).size).toBe(reads.length)
    expect(new Set(outs).size).toBe(outs.length)
  })
})

describe('birthCertSovietV1Contract — coverage of the live layers (no orphans)', () => {
  it('EVERY read-side (A) field maps to exactly one contract entry', () => {
    for (const a of A_KEYS) {
      const matches = CONTRACT.filter((f) => f.readSideKey === a)
      expect(matches, `read-side key '${a}' must be covered by the contract`).toHaveLength(1)
    }
  })

  it('EVERY output (B) field maps to exactly one contract entry', () => {
    for (const b of B_KEYS) {
      const matches = CONTRACT.filter((f) => f.outputKey === b)
      expect(matches, `output key '${b}' must be covered by the contract`).toHaveLength(1)
    }
  })

  it('splitsInto targets all exist as canonical keys in the contract', () => {
    const canon = new Set(CONTRACT.map((f) => f.canonicalKey))
    for (const f of CONTRACT) {
      for (const t of f.splitsInto ?? []) {
        expect(canon.has(t), `splitsInto target '${t}' (from ${f.canonicalKey}) must be a contract field`).toBe(true)
      }
    }
  })
})

describe('birthCertSovietV1Contract — agreement with existing buildMirrorValues convention', () => {
  // The legacy A→B mapping (buildMirrorValues ALIASES, ua_birth_certificate) that the
  // contract must reproduce via canonical keys. Locks decisions #2/#3/#4 to the code.
  const LEGACY_A_TO_B: Record<string, string> = {
    child_family_name: 'child_surname',
    dob: 'date_of_birth',
    place_of_birth_city: 'place_of_birth',
    certificate_series_number: 'series_number',
    issuing_authority: 'place_of_registration',
  }

  it('A→B implied by the contract equals the legacy alias map', () => {
    for (const [aKey, bKey] of Object.entries(LEGACY_A_TO_B)) {
      const viaRead = readKeyToRuntime(aKey)
      const viaOut = outputKeyToRuntime(bKey)
      expect(viaRead, `read '${aKey}' must resolve`).toBeDefined()
      expect(viaOut, `output '${bKey}' must resolve`).toBeDefined()
      expect(viaRead, `A '${aKey}' and B '${bKey}' must land on the same runtimeKey`).toBe(viaOut)
    }
  })

  it('direct (identity) A↔B keys resolve to the same runtimeKey', () => {
    for (const k of ['child_given_name', 'child_patronymic', 'father_full_name', 'mother_full_name', 'act_record_number', 'act_record_date', 'date_of_issue']) {
      if (A_KEYS.includes(k) && B_KEYS.includes(k)) {
        expect(readKeyToRuntime(k)).toBe(outputKeyToRuntime(k))
      }
    }
  })
})

describe('birthCertSovietV1Contract — single English-label source', () => {
  it('englishLabel equals B.sourceLabelEn for every field that has an outputKey', () => {
    const labelOf = new Map(B_FIELDS.map((f) => [f.key, f.sourceLabelEn]))
    for (const f of CONTRACT) {
      if (f.outputKey) {
        expect(f.englishLabel, `label for '${f.canonicalKey}' must match schema sourceLabelEn`).toBe(labelOf.get(f.outputKey))
      }
    }
  })
})

describe('birthCertSovietV1Contract — safety policy', () => {
  it('every critical field is alwaysReview and never auto-finalized (Constitution L6)', () => {
    for (const f of CONTRACT.filter((x) => x.criticality === 'critical')) {
      expect(f.autoFinalize, `${f.canonicalKey} critical → autoFinalize false`).toBe(false)
      expect(f.alwaysReview, `${f.canonicalKey} critical → alwaysReview true`).toBe(true)
    }
  })

  it('no contract field auto-finalizes (handwritten Soviet cert → human review, ADR-026)', () => {
    expect(CONTRACT.every((f) => f.autoFinalize === false)).toBe(true)
  })

  it('Soviet-only fields are tagged scopeEra and absent from the modern read-side spec', () => {
    const soviet = CONTRACT.filter((f) => f.scopeEra === 'soviet_pre1991')
    expect(soviet.length).toBeGreaterThan(0)
    for (const f of soviet) {
      expect(f.readSideKey, `${f.canonicalKey} is Soviet-only → should have no legacy read key`).toBeUndefined()
    }
  })
})

describe('birthCertSovietV1Contract — projection helpers', () => {
  it('canonicalToRuntime round-trips for a known field', () => {
    expect(canonicalToRuntime('person.child.surname')).toBe('family_name')
    expect(canonicalToRuntime('document.number')).toBe('document_number')
  })
})
