/**
 * benchmark.test.ts — reader-benchmark mappers + runner (synthetic; no real docs).
 */
import { describe, it, expect } from 'vitest'
import { passportTruthToGroundTruth } from '../benchmark/passportTruth'
import { mapMrz, mapTranslation, mapTps, mapCore, type DocintelField } from '../benchmark/mappers'
import { runReaderBenchmark, summarizeBenchmark } from '../benchmark/runReaderBenchmark'
import type { Td3ParseResult } from '@/lib/translation/identity/mrzParser'
import type { TpsExtractedField } from '@/lib/tps/types'
import type { CanonicalField } from '../../types'
import { buildConfidence } from '../../policy'

const TRUTH = {
  document_id: 'd1',
  document_type: 'international_passport',
  family_name_latin: 'Kovalenko',
  given_name_latin: 'Ivan',
  family_name_cyrillic: 'Коваленко',
  patronymic_cyrillic: 'Іванович',
  patronymic_latin: 'Ivanovych',
  dob: '1985-07-12',
  sex: 'M',
  passport_number: 'EK123456',
  expiry_date: '2030-04-01',
  citizenship: 'Ukraine',
  place_of_birth_english: 'Lviv',
  place_of_birth_raw: 'Львів',
}

const mrzValid: Td3ParseResult = {
  checkDigitsValid: true,
  reviewRequired: false,
  documentType: 'P',
  issuingState: 'UKR',
  surname: 'KOVALENKO',
  givenNames: 'IVAN',
  documentNumber: 'EK123456',
  nationality: 'UKR',
  dateOfBirth: '12 July 1985',
  sex: 'Male',
  dateOfExpiry: '1 April 2030',
  personalNumber: null,
  checkResults: [
    { field: 'document_number', valid: true },
    { field: 'date_of_birth', valid: true },
    { field: 'date_of_expiry', valid: true },
    { field: 'composite', valid: true },
  ],
  errors: [],
  format: 'TD3',
}

describe('passportTruthToGroundTruth', () => {
  it('excludes empty fields, applies criticality', () => {
    const gt = passportTruthToGroundTruth({ ...TRUTH, given_name_cyrillic: '' })
    expect(gt.fields.given_name_cyrillic).toBeUndefined() // empty excluded
    expect(gt.fields.family_name_latin.critical).toBe(true)
    expect(gt.fields.expiry_date.critical).toBe(false)
  })
})

describe('mapMrz', () => {
  it('emits latin identity + passport fields; valid MRZ → no review; date → ISO', () => {
    const p = mapMrz(mrzValid)
    const by = Object.fromEntries(p.map((f) => [f.key, f]))
    expect(by.family_name_latin.value).toBe('KOVALENKO')
    expect(by.family_name_latin.reviewRequired).toBe(false)
    expect(by.passport_number.value).toBe('EK123456')
    expect(by.dob.value).toBe('1985-07-12')
    expect(by.expiry_date.value).toBe('2030-04-01')
    expect(by.sex.value).toBe('M')
    // MRZ has no Cyrillic / patronymic / place
    expect(by.family_name_cyrillic).toBeUndefined()
    expect(by.patronymic_cyrillic).toBeUndefined()
  })

  it('invalid check digit → that field review_required', () => {
    const bad: Td3ParseResult = { ...mrzValid, checkDigitsValid: false, checkResults: [{ field: 'document_number', valid: false }] }
    const by = Object.fromEntries(mapMrz(bad).map((f) => [f.key, f]))
    expect(by.passport_number.reviewRequired).toBe(true)
  })
})

describe('mapTranslation (docintel)', () => {
  it('emits both latin (value) and cyrillic (raw) for names + place', () => {
    const fields: DocintelField[] = [
      { field: 'surname', raw_cyrillic: 'Коваленко', value: 'Kovalenko', review_required: false },
      { field: 'patronymic', raw_cyrillic: 'Іванович', value: 'Ivanovych', review_required: true },
      { field: 'place_of_birth', raw_cyrillic: 'Львів', value: 'Lviv', review_required: false },
    ]
    const by = Object.fromEntries(mapTranslation(fields).map((f) => [f.key, f]))
    expect(by.family_name_latin.value).toBe('Kovalenko')
    expect(by.family_name_cyrillic.value).toBe('Коваленко')
    expect(by.patronymic_latin.value).toBe('Ivanovych')
    expect(by.patronymic_cyrillic.reviewRequired).toBe(true)
    expect(by.place_of_birth_english.value).toBe('Lviv')
    expect(by.place_of_birth_raw.value).toBe('Львів')
  })
})

function tps(p: Partial<TpsExtractedField> & { field: string; normalized_value: string }): TpsExtractedField {
  return {
    field: p.field, raw_value: p.normalized_value, normalized_value: p.normalized_value,
    extraction_source: 'ocr_mrz', source_document_id: 'd', source_zone: 'z', bbox: null,
    language_layer: 'latin', confidence: 0.9, review_required: p.review_required ?? false,
    ocr_word_ids: [], passes: [], failures: [], user_corrected: false,
  }
}

describe('mapTps + mapCore', () => {
  it('TPS family_name → family_name_latin', () => {
    const by = Object.fromEntries(mapTps([tps({ field: 'family_name', normalized_value: 'Kovalenko' })]).map((f) => [f.key, f]))
    expect(by.family_name_latin.value).toBe('Kovalenko')
  })
  it('Core canonical key → GT latin key', () => {
    const f: CanonicalField = {
      key: 'passport_number', rawValue: 'EK123456', normalizedValue: 'EK123456', criticality: 'critical',
      confidence: buildConfidence({ ocr: 0.99, field_match: null, normalization: null, source_match: null }),
      source: 'mrz', reviewRequired: false, reviewReasons: [], evidence: [],
    }
    const by = Object.fromEntries(mapCore([f]).map((x) => [x.key, x]))
    expect(by.passport_number.value).toBe('EK123456')
  })
})

describe('runReaderBenchmark', () => {
  it('scores each reader; MRZ has 0 critical_wrong but misses Cyrillic; summary is PII-free', () => {
    const report = runReaderBenchmark(
      {
        mrz: mrzValid,
        translation: [
          { field: 'surname', raw_cyrillic: 'Коваленко', value: 'Kovalenko', review_required: false },
          { field: 'given_names', raw_cyrillic: 'Іван', value: 'Ivan', review_required: false },
          { field: 'patronymic', raw_cyrillic: 'Іванович', value: 'Ivanovych', review_required: false },
        ],
      },
      TRUTH,
    )
    expect(report.critical_wrong.mrz).toBe(0)
    expect(report.critical_wrong.translation).toBe(0)
    // MRZ misses family_name_cyrillic / patronymic (no coverage)
    const mrzRow = report.rows.find((r) => r.reader === 'mrz')!
    expect(mrzRow.score.critical_missing).toBeGreaterThan(0)
    const s = summarizeBenchmark(report)
    expect(s).toContain('mrz: critical_wrong=0')
    expect(s).not.toContain('Kovalenko') // PII-free
  })
})
