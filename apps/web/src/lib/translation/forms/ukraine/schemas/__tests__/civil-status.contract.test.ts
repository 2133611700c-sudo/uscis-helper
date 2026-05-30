/**
 * civil-status.contract.test.ts — the Field Contract holds for ALL five civil-status
 * schemas (КМУ №1025): birth, marriage, divorce, death, name-change.
 */
import { describe, it, expect } from 'vitest'
import { birthCertificateSchema } from '../birth-certificate.schema'
import { marriageCertificateSchema } from '../marriage-certificate.schema'
import { divorceCertificateSchema } from '../divorce-certificate.schema'
import { deathCertificateSchema } from '../death-certificate.schema'
import { nameChangeCertificateSchema } from '../name-change-certificate.schema'

const ALL = [
  ['birth', birthCertificateSchema], ['marriage', marriageCertificateSchema],
  ['divorce', divorceCertificateSchema], ['death', deathCertificateSchema],
  ['name-change', nameChangeCertificateSchema],
] as const

describe('Civil-status Field Contract (КМУ №1025) — all 5 certificates', () => {
  for (const [n, s] of ALL) {
    it(`${n}: every field has sourceRule + canGuess=false`, () => {
      for (const f of s.fields) {
        expect(f.sourceRule, `${n}/${f.key}`).toBeTruthy()
        expect(f.canGuess, `${n}/${f.key}`).toBe(false)
      }
    })
    it(`${n}: references source КМУ-1025 + has era variants incl. legacy bilingual`, () => {
      expect(s.sourceId).toBe('ua_kmu_1025_2010')
      const ids = (s.variants ?? []).map((v) => v.id)
      expect(ids).toContain('legacy_soviet_bilingual')
    })
    it(`${n}: has the official issuing-authority + head-of-authority fields`, () => {
      const keys = s.fields.map((f) => f.key)
      expect(keys.some((k) => k === 'issuing_authority' || k === 'certificate_issuing_authority')).toBe(true)
      expect(keys).toContain('head_of_authority')
    })
    it(`${n}: Patronymic is never labeled "Middle Name"`, () => {
      for (const f of s.fields) expect(f.sourceLabelEn.toLowerCase()).not.toContain('middle name')
    })
  }
})
