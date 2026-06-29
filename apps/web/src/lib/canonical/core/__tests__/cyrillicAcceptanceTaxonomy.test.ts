import { describe, it, expect } from 'vitest'
import {
  classifyError,
  levenshtein,
  characterErrorRate,
  type TaxonomyCode,
} from '../cyrillicAcceptanceTaxonomy'

// ALL data below is FICTIONAL (e.g. Соловьяк / Соловʼяк) — NO real PII.

const c = (input: Parameters<typeof classifyError>[0]): TaxonomyCode => classifyError(input)

describe('classifyError — one fictional case per taxonomy code', () => {
  it('FABRICATION — truth empty, value emitted', () => {
    expect(c({ fieldKey: 'patronymic', got: 'Петрович', truth: '' })).toBe('FABRICATION')
  })

  it('MISSING — truth present, nothing emitted', () => {
    expect(c({ fieldKey: 'family_name', got: null, truth: 'Соловʼяк' })).toBe('MISSING')
  })

  it('WRONG_FIELD — value matches a different key better than its own', () => {
    expect(c({
      fieldKey: 'given_name', got: 'Соловʼяк', truth: 'Олег',
      otherFieldValues: { family_name: 'Соловʼяк' },
    })).toBe('WRONG_FIELD')
  })

  it('PROVIDER — refusal sentinel leaked as a value', () => {
    expect(c({ fieldKey: 'given_name', got: 'unavailable', truth: 'Олег' })).toBe('PROVIDER')
  })

  it('TEMPLATE — boilerplate placeholder returned', () => {
    expect(c({ fieldKey: 'given_name', got: 'placeholder', truth: 'Олег' })).toBe('TEMPLATE')
  })

  it('NORMALIZATION — diacritic-only difference (survives norm, folds under stripDiacritics)', () => {
    // got carries a combining acute on е; truth does not. norm() keeps the mark,
    // so this is NOT EXACT, but stripDiacritics folds them equal → NORMALIZATION.
    expect(c({ fieldKey: 'given_name', got: 'Оле́г', truth: 'Олег' })).toBe('NORMALIZATION')
  })

  it('UA_RU_CONFUSION — і↔и swap', () => {
    // UA "Сидір" read as RU-flavoured "Сидир" (і→и).
    expect(c({ fieldKey: 'given_name', got: 'Сидир', truth: 'Сидір' })).toBe('UA_RU_CONFUSION')
  })

  it('UA_RU_CONFUSION — RU-only letter leaks where UA expected', () => {
    // RU "эра" read where UA "ера" expected — э is RU-only, folds to е.
    expect(c({ fieldKey: 'given_name', got: 'эра', truth: 'ера' })).toBe('UA_RU_CONFUSION')
  })

  it('HOMOGLYPH — cyrillic/latin look-alikes', () => {
    const cyr = 'орест'                          // all cyrillic (truth)
    const mixed = 'o' + 'р' + 'e' + 'с' + 'т'    // latin o + latin e, rest cyrillic
    expect(c({ fieldKey: 'given_name', got: mixed, truth: cyr })).toBe('HOMOGLYPH')
  })

  it('TRANSLIT — latin produced where cyrillic expected', () => {
    expect(c({ fieldKey: 'family_name', got: 'Solovyak', truth: 'Соловʼяк' })).toBe('TRANSLIT')
  })

  it('PATRONYMIC — suffix mismatch on a patronymic key', () => {
    expect(c({ fieldKey: 'patronymic', got: 'Сидоревич', truth: 'Сидорович' })).toBe('PATRONYMIC')
  })

  it('DATE — digit edits on a date key', () => {
    expect(c({ fieldKey: 'date_of_birth', got: '1991-03-15', truth: '1991-08-15' })).toBe('DATE')
  })

  it('DOCNUM — document number key error', () => {
    expect(c({ fieldKey: 'document_number', got: 'СН445566', truth: 'СН445567' })).toBe('DOCNUM')
  })

  it('GEOGRAPHY — place key error', () => {
    expect(c({ fieldKey: 'birth_place', got: 'Бахмацький', truth: 'Бахмутський' })).toBe('GEOGRAPHY')
  })

  it('AUTHORITY — issuing authority key error', () => {
    expect(c({ fieldKey: 'issuing_authority', got: 'Сосницьким РВ', truth: 'Сосницьким РАЦС' })).toBe('AUTHORITY')
  })

  it('MERGED — two tokens collapsed into one (with a real char diff too)', () => {
    // got = one token, truth = two tokens; also a letter differs so it is not pure NORMALIZATION.
    expect(c({ fieldKey: 'full_name', got: 'ОлехСоловʼяк', truth: 'Олег Соловʼяк' })).toBe('MERGED')
  })

  it('SPLIT — one token broken into many (with a real char diff too)', () => {
    expect(c({ fieldKey: 'full_name', got: 'Олег Соло вʼяк', truth: 'Олег Соловʼях' })).toBe('SPLIT')
  })

  it('OCR_NEAR — same script, tiny CER', () => {
    // "Соловʼяк" vs "Соловʼак" — 1 char in 8, CER ≈ 0.125 ≤ 0.15, no special key.
    expect(c({ fieldKey: 'spouse_name', got: 'Соловʼак', truth: 'Соловʼяк' })).toBe('OCR_NEAR')
  })

  it('QUALITY — garbage with very high CER', () => {
    expect(c({ fieldKey: 'spouse_name', got: 'ЖЭЪЪ', truth: 'Олена' })).toBe('QUALITY')
  })

  it('OCR_OTHER — real OCR error not otherwise captured', () => {
    // Same script, moderate CER (~0.4), no key domain, equal token counts.
    expect(c({ fieldKey: 'spouse_name', got: 'Микита', truth: 'Микола' })).toBe('OCR_OTHER')
  })

  it('WRONG_EVIDENCE code exists in the union (reserved)', () => {
    // No deterministic single-field rule emits WRONG_EVIDENCE (it needs evidence-region
    // context the caller supplies); assert the code is assignable to TaxonomyCode.
    const code: TaxonomyCode = 'WRONG_EVIDENCE'
    expect(code).toBe('WRONG_EVIDENCE')
  })
})

describe('exported helpers match the metrics module semantics', () => {
  it('levenshtein / CER', () => {
    expect(levenshtein('абв', 'абв')).toBe(0)
    expect(characterErrorRate('Соловʼяк', 'Соловʼяк')).toBe(0)
    expect(characterErrorRate('абв', 'абг')).toBeCloseTo(1 / 3, 5)
  })
})
