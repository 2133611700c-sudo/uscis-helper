/**
 * birth-certificate.contract.test.ts — Field Contract + Canonical Mapping for the
 * birth certificate, built on the OFFICIAL КМУ №1025 structure (verified 2026-05-29).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { birthCertificateSchema } from '../birth-certificate.schema'
import { mapBirthCertificate, splitFullName } from '../../mappings/birthCertificate.mapping'

const field = (k: string) => birthCertificateSchema.fields.find((f) => f.key === k)

describe('Birth certificate — Field Contract (КМУ №1025)', () => {
  it('schema references a verified official source', () => {
    expect(birthCertificateSchema.sourceId).toBe('ua_kmu_1025_2010')
    expect(birthCertificateSchema.officialSource.act).toMatch(/1025/)
  })

  it('every field carries a sourceRule and canGuess=false (no field is invented)', () => {
    for (const f of birthCertificateSchema.fields) {
      expect(f.sourceRule, `${f.key} missing sourceRule`).toBeTruthy()
      expect(f.canGuess, `${f.key} must not allow guessing`).toBe(false)
    }
  })

  it('carries the official КМУ-1025 fields that were missing before', () => {
    expect(field('certificate_issuing_authority')).toBeTruthy() // separate from place_of_registration
    expect(field('unzr')).toBeTruthy()
    expect(field('rnokpp')).toBeTruthy()
    expect(field('head_of_authority')).toBeTruthy()
  })

  it('УНЗР/РНОКПП are era-dependent and NOT required (do not block legacy/Soviet blanks)', () => {
    expect(field('unzr')!.eraDependent).toBe(true)
    expect(field('unzr')!.required).toBe(false)
    expect(field('rnokpp')!.eraDependent).toBe(true)
    expect(field('rnokpp')!.required).toBe(false)
  })

  it('Patronymic is "Patronymic", NEVER "Middle Name"', () => {
    expect(field('child_patronymic')!.sourceLabelEn).toBe('Patronymic')
    for (const f of birthCertificateSchema.fields) {
      expect(f.sourceLabelEn.toLowerCase()).not.toContain('middle name')
    }
  })

  it('declares era variants incl. legacy Soviet bilingual (review-required)', () => {
    const ids = (birthCertificateSchema.variants ?? []).map((v) => v.id)
    expect(ids).toContain('legacy_soviet_bilingual')
    expect(ids).toContain('post_2019_unzr_rnokpp')
    const legacy = birthCertificateSchema.variants!.find((v) => v.id === 'legacy_soviet_bilingual')!
    expect(legacy.languageProfile).toBe('uk_ru_bilingual')
    expect(legacy.reviewRequired).toBe(true)
  })
})

describe('Birth certificate — Canonical Mapping (spike gap)', () => {
  it('splits a combined child_full_name into surname/given/patronymic, all review-required', () => {
    const m = mapBirthCertificate({ child_full_name: 'REDACTED_NAME Сергій Сергійович' })
    expect(m.child_surname.value).toBe('REDACTED_NAME')
    expect(m.child_given_name.value).toBe('Сергій')
    expect(m.child_patronymic.value).toBe('Сергійович')
    for (const k of ['child_surname', 'child_given_name', 'child_patronymic']) {
      expect(m[k].reviewRequired).toBe(true)
      expect(m[k].reason).toBe('split_from_full_name')
    }
  })

  it('passes through 1:1 fields and never invents missing ones', () => {
    const m = mapBirthCertificate({ place_of_birth: 'смт Тростянець', series_number: 'III-АМ 428069' })
    expect(m.place_of_birth.value).toBe('смт Тростянець')
    expect(m.series_number.value).toBe('III-АМ 428069')
    expect(m.father_full_name).toBeUndefined() // absent → not fabricated
  })

  it('splitFullName handles a missing patronymic', () => {
    expect(splitFullName('Іваненко Іван')).toEqual({ surname: 'Іваненко', given: 'Іван', patronymic: '' })
  })
})

describe('Birth certificate — official series table (КМУ №1025)', () => {
  it('series letter pair АМ maps to Вінницька oblast (verifies III-АМ № 428069)', () => {
    const ledger = JSON.parse(readFileSync(resolve(process.cwd(), '../../docs/official-forms/ukraine/source-ledger.json'), 'utf8'))
    const series = ledger.official_verification_2026_05_29.series_letters_by_oblast_kmu1025
    expect(series['АМ']).toBe('Вінницька')
  })
})
