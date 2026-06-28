/**
 * Phase 3 — runtime alias layers sourced from the unified contract, flag-gated.
 *
 * Proves:
 *  - flag UNIFIED_DOC_CONTRACT_ENABLED defaults OFF;
 *  - the contract-derived birth-cert mirror alias map EQUALS the legacy ALIASES;
 *  - buildMirrorValues / collectMirrorExtras give IDENTICAL output OFF vs ON;
 *  - resolveKeyAliases ON is content-equal to OFF (no drift);
 *  - the contract actually contributes the birth-cert synonym (date_of_birth↔dob).
 *
 * No runtime default behaviour changes (flag OFF); ON parity lets Phase 4 flip it.
 */
import { describe, it, expect } from 'vitest'
import {
  birthCertMirrorAliases,
  birthCertContractKeyAliases,
  isUnifiedDocContractEnabled,
} from '../birthCertSovietV1Contract'
import { ALIASES, buildMirrorValues, collectMirrorExtras, type ExtractedFieldLite } from '@/lib/translation/pdf/buildMirrorValues'
import { resolveKeyAliases } from '@/lib/canonical/core/keyAliases'
import { getOfficialSchema } from '@/lib/translation/forms/ukraine/schemas/registry'

const OFF = {} as Record<string, string | undefined>
const ON = { UNIFIED_DOC_CONTRACT_ENABLED: '1' } as Record<string, string | undefined>

// Same stable FICTIONAL fixture used by the Phase-0 golden baseline.
const FIXTURE: ExtractedFieldLite[] = [
  { field: 'child_family_name', value: 'Ivanenko', review_required: false },
  { field: 'child_given_name', value: 'Olha', review_required: false },
  { field: 'child_patronymic', value: 'Petrivna', review_required: true },
  { field: 'dob', value: '1990-05-14', review_required: false },
  { field: 'place_of_birth_city', value: 'Vinnytsia', review_required: false },
  { field: 'father_full_name', value: 'Petro Ivanenko', review_required: false },
  { field: 'act_record_number', value: '84', review_required: false },
  { field: 'act_record_date', value: '1990-05-22', review_required: false },
  { field: 'issuing_authority', value: 'Trostianets District Civil Registry Office', review_required: false },
  { field: 'certificate_series_number', value: 'II-BK 530174', review_required: false },
  { field: 'date_of_issue', value: '1990-05-22', review_required: false },
]

describe('Phase 3 — flag default', () => {
  it('UNIFIED_DOC_CONTRACT_ENABLED defaults OFF; only "1" enables', () => {
    expect(isUnifiedDocContractEnabled({})).toBe(false)
    expect(isUnifiedDocContractEnabled({ UNIFIED_DOC_CONTRACT_ENABLED: '0' })).toBe(false)
    expect(isUnifiedDocContractEnabled({ UNIFIED_DOC_CONTRACT_ENABLED: 'true' })).toBe(false)
    expect(isUnifiedDocContractEnabled({ UNIFIED_DOC_CONTRACT_ENABLED: '1' })).toBe(true)
  })
})

describe('Phase 3 — mirror alias map: contract == legacy', () => {
  it('birthCertMirrorAliases() deep-equals the legacy ALIASES["ua_birth_certificate"]', () => {
    expect(birthCertMirrorAliases()).toEqual(ALIASES['ua_birth_certificate'])
  })

  it('preserves the dual place-of-birth keys (place_of_birth_city AND city_of_birth)', () => {
    const m = birthCertMirrorAliases()
    expect(m['place_of_birth_city']).toBe('place_of_birth')
    expect(m['city_of_birth']).toBe('place_of_birth')
  })
})

describe('Phase 3 — buildMirrorValues / collectMirrorExtras: OFF == ON', () => {
  const schema = getOfficialSchema('ua_birth_certificate')!

  it('mirror values are identical OFF vs ON', () => {
    const off = buildMirrorValues(schema, FIXTURE, OFF)
    const on = buildMirrorValues(schema, FIXTURE, ON)
    expect(on).toEqual(off)
  })

  it('mirror extras are identical OFF vs ON', () => {
    const off = collectMirrorExtras(schema, FIXTURE, OFF)
    const on = collectMirrorExtras(schema, FIXTURE, ON)
    expect(on).toEqual(off)
  })
})

describe('Phase 3 — KEY_ALIASES: contract-sourced, no drift', () => {
  it('resolveKeyAliases ON is content-equal to OFF', () => {
    expect(resolveKeyAliases(ON)).toEqual(resolveKeyAliases(OFF))
  })

  it('the contract actually contributes date_of_birth -> [dob]', () => {
    expect(birthCertContractKeyAliases()).toMatchObject({ date_of_birth: ['dob'] })
  })

  it('contract contribution is a SUBSET of legacy KEY_ALIASES (never invents keys)', () => {
    const legacy = resolveKeyAliases(OFF)
    for (const [k, vals] of Object.entries(birthCertContractKeyAliases())) {
      expect(legacy[k], `contract key '${k}' must already exist in legacy`).toBeDefined()
      for (const v of vals) expect(legacy[k]).toContain(v)
    }
  })
})
