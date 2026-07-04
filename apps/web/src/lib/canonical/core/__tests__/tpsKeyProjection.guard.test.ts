/**
 * ONE-BRAIN v2 Phase 2c — CORE→TPS key-projection SAFETY guard (hint-scoped).
 *
 * `canonicalToTpsModuleResult` projects extended-hint registry keys onto the legacy/
 * TPS-consumed names (closes parity gap G3) — but ONLY for the extended hints. The LIVE
 * passport/booklet path must stay byte-identical: its MRZ candidates legitimately emit
 * `date_of_birth` (mrzAuthority.ts:34) and downstream consumes that key as-is today.
 * An earlier UNCONDITIONAL projection changed that live key and was caught by
 * formMapperCanonicalParity — this guard pins the hint scoping so it cannot regress.
 */
import { describe, it, expect } from 'vitest'
import { getDocTypeSpec } from '@/lib/docintel/documentRegistry'
import { projectCoreKeyToTps } from '../tpsAdapter'

const PROJECTION_DOMAIN = [
  'i94_date_of_entry',
  'i94_place_of_entry',
  'date_of_birth',
  'ead_category',
  'ead_validity_to',
]

describe('tpsKeyProjection — hint-scoped fixed points + pinned mapping', () => {
  it('LIVE hints (passport/booklet) are NEVER projected — incl. the MRZ date_of_birth key', () => {
    for (const hint of ['passport', 'booklet']) {
      for (const key of [...PROJECTION_DOMAIN, 'family_name', 'passport_number', 'dob']) {
        expect(projectCoreKeyToTps(key, hint)).toBe(key)
      }
    }
  })

  it('LIVE passport/booklet spec keys are fixed points regardless (defense in depth)', () => {
    for (const docId of ['ua_international_passport', 'ua_internal_passport_booklet'] as const) {
      const spec = getDocTypeSpec(docId)
      expect(spec, `spec ${docId} must exist`).toBeTruthy()
      for (const f of spec!.fields) {
        expect(
          PROJECTION_DOMAIN.includes(f.field),
          `${docId}.${f.field} must NOT be in the CORE→TPS projection domain (live path)`,
        ).toBe(false)
      }
    }
  })

  it('EXTENDED hints project exactly the harness-established table', () => {
    for (const hint of ['i94', 'ead', 'ead_old', 'i797', 'military_id', 'birth_certificate']) {
      expect(projectCoreKeyToTps('date_of_birth', hint)).toBe('dob')
    }
    expect(projectCoreKeyToTps('i94_date_of_entry', 'i94')).toBe('last_entry_date')
    expect(projectCoreKeyToTps('i94_place_of_entry', 'i94')).toBe('place_of_last_entry')
    expect(projectCoreKeyToTps('ead_category', 'ead')).toBe('ead_category_on_card')
    expect(projectCoreKeyToTps('ead_validity_to', 'ead')).toBe('ead_expiration_date')
  })

  it('identity for non-domain keys on extended hints (incl. new spec fields named as consumed)', () => {
    for (const k of ['i94_admission_number', 'i94_class_of_admission', 'i94_admit_until',
                     'country_of_citizenship', 'family_name', 'a_number', 'unknown_key']) {
      expect(projectCoreKeyToTps(k, 'i94')).toBe(k)
    }
  })

  it('unknown hints are never projected', () => {
    expect(projectCoreKeyToTps('date_of_birth', 'tps_notice')).toBe('date_of_birth')
    expect(projectCoreKeyToTps('date_of_birth', '')).toBe('date_of_birth')
  })
})
