import { describe, it, expect } from 'vitest'
import { marriageCertificateSchema as s } from '../marriage-certificate.schema'

describe('official form schema — marriage (KMU 1025)', () => {
  it('carries an official source URL (no template without source)', () => {
    expect(s.officialSource.url).toMatch(/zakon\.rada\.gov\.ua/)
    expect(s.officialSource.act).toMatch(/1025/)
  })
  it('every field has a translation rule + evidence requirement', () => {
    for (const f of s.fields) {
      expect(f.translationRule, f.key).toBeTruthy()
      expect(typeof f.evidenceRequired, f.key).toBe('boolean')
    }
  })
  it('NAME fields use KMU-55 transliteration, never prose translation', () => {
    const names = s.fields.filter((f) => /surname|given_name|patronymic/.test(f.key))
    expect(names.length).toBeGreaterThan(4)
    for (const n of names) {
      expect(n.translationRule, n.key).toBe('transliterate_kmu55')
      expect(n.lockedEntity, n.key).toBe(true)
    }
  })
  it('numbers/series/act-record are locked verbatim (never reformatted)', () => {
    for (const k of ['act_record_number', 'series_number']) {
      const f = s.fields.find((x) => x.key === k)!
      expect(f.translationRule, k).toBe('locked_verbatim')
      expect(f.lockedEntity).toBe(true)
    }
  })
  it('has official layout sections, not a flat list', () => {
    expect(s.layoutSections).toContain('header')
    expect(s.layoutSections).toContain('certification')
    expect(s.layoutSections).toContain('seals')
  })
})
