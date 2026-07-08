/**
 * splitMergedFields.ts — item 6 (2026-07-06): this Phase 5 module (series/number split,
 * place-of-birth district/oblast/republic split, registry-office district/oblast split) existed
 * with ZERO test coverage — found via `npx vitest run` returning "No test files found" for it.
 * Verified the regex logic directly in Node against FICTIONAL data before writing these
 * assertions (project PII policy — no real document values in any committed file).
 */
import { describe, it, expect } from 'vitest'
import {
  splitSeriesNumber,
  splitBirthPlace,
  splitRegistryOffice,
  computeSplitFields,
  splitMergedFields,
  isUnifiedDocContractSplitEnabled,
} from '../splitMergedFields'
import type { ExtractedFieldLite } from '@/lib/translation/pdf/buildMirrorValues'

describe('splitSeriesNumber', () => {
  it('splits Roman-numeral series + Cyrillic letters + digits, with №', () => {
    expect(splitSeriesNumber('II-БК № 530174')).toEqual({ series: 'II-БК', number: '530174' })
  })
  it('splits without the № sign', () => {
    expect(splitSeriesNumber('III-ВВ 123456')).toEqual({ series: 'III-ВВ', number: '123456' })
  })
  it('returns empty on too few digits (redaction/garbage guard)', () => {
    expect(splitSeriesNumber('I-АМ №18')).toEqual({})
  })
  it('returns empty on non-matching input', () => {
    expect(splitSeriesNumber('garbage')).toEqual({})
  })
})

describe('splitBirthPlace', () => {
  it('splits settlement + district + oblast + republic (village, full Soviet form)', () => {
    expect(splitBirthPlace('село Тростянець, Козятинського району, Вінницької області, УРСР')).toEqual({
      settlement_type: 'село', settlement: 'Тростянець',
      district: 'Козятинського району', oblast: 'Вінницької області', republic: 'УРСР',
    })
  })
  it('splits an oblast-center city with no district segment', () => {
    expect(splitBirthPlace('м. Вінниця, Вінницької області, УРСР')).toEqual({
      settlement_type: 'м.', settlement: 'Вінниця', oblast: 'Вінницької області', republic: 'УРСР',
    })
  })
  it('handles smt (urban-type settlement) with no republic segment', () => {
    expect(splitBirthPlace('смт Іллінці, Іллінецького району, Вінницької області')).toEqual({
      settlement_type: 'смт', settlement: 'Іллінці', district: 'Іллінецького району', oblast: 'Вінницької області',
    })
  })
  it('a bare city name with no commas → settlement only, no fabricated district/oblast', () => {
    expect(splitBirthPlace('Київ')).toEqual({ settlement: 'Київ' })
  })
  it('empty input → empty parts object', () => {
    expect(splitBirthPlace('')).toEqual({})
  })
})

describe('splitRegistryOffice', () => {
  it('peels off a standalone trailing oblast segment, keeps the office name intact', () => {
    expect(splitRegistryOffice('Козятинський районний відділ РАЦС, Вінницька область')).toEqual({
      oblast: 'Вінницька область', name: 'Козятинський районний відділ РАЦС',
    })
  })
  it('does NOT mangle district/oblast words embedded in a single continuous name (no comma)', () => {
    const raw = 'відділ реєстрації актів цивільного стану Козятинського району Вінницької області'
    expect(splitRegistryOffice(raw)).toEqual({ name: raw })
  })
})

const field = (overrides: Partial<ExtractedFieldLite>): ExtractedFieldLite =>
  ({ field: 'x', value: null, normalized_value: null, final_value: null, ...overrides }) as ExtractedFieldLite

describe('computeSplitFields', () => {
  it('produces series/number, place, and registry-office split fields, each tagged with provenance', () => {
    const extracted = [
      field({ field: 'certificate_series_number', final_value: 'II-БК № 530174' }),
      field({ field: 'place_of_birth_city', final_value: 'село Тростянець, Козятинського району, Вінницької області, УРСР' }),
      field({ field: 'issuing_authority', final_value: 'Козятинський районний відділ РАЦС, Вінницька область' }),
    ]
    const split = computeSplitFields(extracted)
    const byKey = new Map(split.map((s) => [s.runtimeKey, s]))

    expect(byKey.get('document_series')).toMatchObject({ value: 'II-БК', sourceMergedKey: 'certificate_series_number', review: false })
    expect(byKey.get('document_number')).toMatchObject({ value: '530174', review: false })
    expect(byKey.get('place_of_birth_settlement_type')).toMatchObject({ value: 'село', review: false })
    expect(byKey.get('place_of_birth_district')).toMatchObject({ value: 'Козятинського району', review: true })
    expect(byKey.get('place_of_birth_oblast')).toMatchObject({ value: 'Вінницької області', review: true })
    expect(byKey.get('place_of_birth_republic')).toMatchObject({ value: 'УРСР', review: true })
    expect(byKey.get('registry_office_oblast')).toMatchObject({ value: 'Вінницька область', review: true })
    // no district segment in that office string (single trailing oblast segment only)
    expect(byKey.has('registry_office_district')).toBe(false)
  })

  it('never fabricates a field when the source value is missing/empty', () => {
    expect(computeSplitFields([])).toEqual([])
    expect(computeSplitFields([field({ field: 'certificate_series_number', final_value: '' })])).toEqual([])
  })

  it('falls back through the TPS-path legacy alias city_of_birth when place_of_birth_city is absent', () => {
    const split = computeSplitFields([field({ field: 'city_of_birth', final_value: 'Київ' })])
    expect(split.find((s) => s.runtimeKey === 'place_of_birth_settlement_type')).toBeUndefined()
    // bare city, no district/oblast/republic segments to split
    expect(split).toEqual([])
  })
})

describe('splitMergedFields (flag gate)', () => {
  const extracted = [field({ field: 'certificate_series_number', final_value: 'II-БК № 530174' })]

  it('OFF by default → returns the identical array reference, unchanged', () => {
    expect(isUnifiedDocContractSplitEnabled({})).toBe(false)
    const out = splitMergedFields(extracted, {})
    expect(out).toBe(extracted)
  })

  it('ON → returns original fields untouched, PLUS the derived split fields appended', () => {
    const out = splitMergedFields(extracted, { UNIFIED_DOC_CONTRACT_SPLIT_ENABLED: '1' })
    expect(out).not.toBe(extracted)
    expect(out.slice(0, extracted.length)).toEqual(extracted)
    const added = out.slice(extracted.length)
    expect(added.some((f) => f.field === 'document_series' && f.value === 'II-БК')).toBe(true)
    expect(added.some((f) => f.field === 'document_number' && f.value === '530174')).toBe(true)
  })
})
