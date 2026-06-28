/**
 * Phase 5 — split merged semantic fields: additive, flag-gated, lossless.
 *
 * Proves:
 *  - flag UNIFIED_DOC_CONTRACT_SPLIT_ENABLED defaults OFF;
 *  - OFF → splitMergedFields is the identity (same reference) → no behaviour change;
 *  - ON  → original fields untouched + new split fields appended (distinct keys);
 *  - parsers split series/number, place, and registry office correctly;
 *  - NO DATA LOSS (every split value is a substring of its merged source) and
 *    NO DUPLICATION (split keys are new; no two split values collide);
 *  - the mirror/value layer is UNAFFECTED by the split flag (splitter is unwired,
 *    so the Phase-0 golden PDF stays byte-identical).
 *
 * Fictional data only. OCR/models/handwriting/PDF layout untouched.
 */
import { describe, it, expect } from 'vitest'
import {
  isUnifiedDocContractSplitEnabled,
  splitMergedFields,
  computeSplitFields,
  splitSeriesNumber,
  splitBirthPlace,
  splitRegistryOffice,
} from '../splitMergedFields'
import { buildMirrorValues, type ExtractedFieldLite } from '@/lib/translation/pdf/buildMirrorValues'
import { getOfficialSchema } from '@/lib/translation/forms/ukraine/schemas/registry'

const OFF = {} as Record<string, string | undefined>
const ON = { UNIFIED_DOC_CONTRACT_SPLIT_ENABLED: '1' } as Record<string, string | undefined>

// Fictional birth-cert extraction with MERGED values that must split.
const FIXTURE: ExtractedFieldLite[] = [
  { field: 'child_family_name', value: 'Ivanenko', review_required: false },
  { field: 'dob', value: '1990-05-14', review_required: false },
  { field: 'place_of_birth_city', value: 'смт Lisove, Trostianets district, Vinnytsia oblast, UkrSSR', review_required: false },
  { field: 'issuing_authority', value: 'Trostianets District Civil Registry Office, Vinnytsia Oblast', review_required: false },
  { field: 'certificate_series_number', value: 'II-BK 530174', review_required: false },
]

describe('Phase 5 — flag default', () => {
  it('UNIFIED_DOC_CONTRACT_SPLIT_ENABLED defaults OFF; only "1" enables', () => {
    expect(isUnifiedDocContractSplitEnabled({})).toBe(false)
    expect(isUnifiedDocContractSplitEnabled({ UNIFIED_DOC_CONTRACT_SPLIT_ENABLED: '0' })).toBe(false)
    expect(isUnifiedDocContractSplitEnabled({ UNIFIED_DOC_CONTRACT_SPLIT_ENABLED: '1' })).toBe(true)
  })
})

describe('Phase 5 — OFF is identity', () => {
  it('splitMergedFields OFF returns the input unchanged (same reference)', () => {
    expect(splitMergedFields(FIXTURE, OFF)).toBe(FIXTURE)
  })
})

describe('Phase 5 — parsers', () => {
  it('series/number: "II-BK 530174" → series II-BK, number 530174', () => {
    expect(splitSeriesNumber('II-BK 530174')).toEqual({ series: 'II-BK', number: '530174' })
  })
  it('series/number: Cyrillic "III-ВВ № 123456" → III-ВВ / 123456', () => {
    expect(splitSeriesNumber('III-ВВ № 123456')).toEqual({ series: 'III-ВВ', number: '123456' })
  })
  it('series/number: non-matching string → empty (no fabrication)', () => {
    expect(splitSeriesNumber('not a series')).toEqual({})
  })

  it('place: Latin admin chain splits into all five parts', () => {
    expect(splitBirthPlace('смт Lisove, Trostianets district, Vinnytsia oblast, UkrSSR')).toEqual({
      settlement_type: 'смт', settlement: 'Lisove',
      district: 'Trostianets district', oblast: 'Vinnytsia oblast', republic: 'UkrSSR',
    })
  })
  it('place: Cyrillic admin chain splits into all five parts', () => {
    expect(splitBirthPlace('смт Лісове, Тростянецький район, Вінницька область, УРСР')).toEqual({
      settlement_type: 'смт', settlement: 'Лісове',
      district: 'Тростянецький район', oblast: 'Вінницька область', republic: 'УРСР',
    })
  })
  it('place: single settlement only → settlement, nothing else', () => {
    expect(splitBirthPlace('Vinnytsia')).toEqual({ settlement: 'Vinnytsia' })
  })

  it('registry: "<office>, <oblast>" → name + oblast (district embedded in name kept verbatim)', () => {
    expect(splitRegistryOffice('Trostianets District Civil Registry Office, Vinnytsia Oblast')).toEqual({
      name: 'Trostianets District Civil Registry Office', oblast: 'Vinnytsia Oblast',
    })
  })
})

describe('Phase 5 — ON is additive, lossless, non-duplicating', () => {
  const out = splitMergedFields(FIXTURE, ON)
  const split = computeSplitFields(FIXTURE)

  it('every original field is preserved untouched', () => {
    for (const orig of FIXTURE) {
      expect(out.find((f) => f.field === orig.field && f.value === orig.value)).toBeTruthy()
    }
    expect(out.length).toBe(FIXTURE.length + split.length)
  })

  it('produces the expected split keys for the fixture', () => {
    const keys = split.map((s) => s.runtimeKey).sort()
    expect(keys).toEqual([
      'document_number', 'document_series',
      'place_of_birth_district', 'place_of_birth_oblast', 'place_of_birth_republic', 'place_of_birth_settlement_type',
      'registry_office_oblast',
    ].sort())
  })

  it('NO DATA LOSS: every split value is a substring of its merged source value', () => {
    const srcVal = (k: string) => (FIXTURE.find((f) => f.field === k)?.value ?? '')
    for (const s of split) {
      const merged = srcVal(s.sourceMergedKey).replace(/\s+/g, ' ')
      const val = s.value.replace(/\s+/g, ' ')
      expect(merged.includes(val), `'${s.value}' must come from '${s.sourceMergedKey}'`).toBe(true)
    }
  })

  it('NO DUPLICATION: split keys are NEW (not legacy keys) and values do not collide within a source', () => {
    const legacyKeys = new Set(FIXTURE.map((f) => f.field))
    for (const s of split) expect(legacyKeys.has(s.runtimeKey)).toBe(false)
    const bySource = new Map<string, string[]>()
    for (const s of split) bySource.set(s.sourceMergedKey, [...(bySource.get(s.sourceMergedKey) ?? []), s.value])
    for (const [, vals] of bySource) expect(new Set(vals).size).toBe(vals.length)
  })

  it('critical split fields carry provenance (sourceMergedKey)', () => {
    expect(split.every((s) => s.sourceMergedKey && s.canonicalKey.includes('.'))).toBe(true)
  })
})

describe('Phase 5 — mirror/value layer UNAFFECTED by the split flag', () => {
  const schema = getOfficialSchema('ua_birth_certificate')!
  it('buildMirrorValues is identical whether the split flag is OFF or ON (splitter is unwired)', () => {
    const a = buildMirrorValues(schema, FIXTURE, OFF)
    const b = buildMirrorValues(schema, FIXTURE, ON)
    expect(b).toEqual(a)
  })
})
