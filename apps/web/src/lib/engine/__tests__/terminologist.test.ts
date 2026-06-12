import { describe, it, expect } from 'vitest'
import { formatDateEn, translateAuthority } from '../terminologist'

describe('formatDateEn', () => {
  it('Ukrainian textual', () => expect(formatDateEn('25 лютого 2011 року')).toBe('25 February 2011'))
  it('Russian textual', () => expect(formatDateEn('26 июня 1965')).toBe('26 June 1965'))
  it('numeric DD.MM.YYYY', () => expect(formatDateEn('01.01.1990')).toBe('1 January 1990'))
  it('ISO', () => expect(formatDateEn('1990-01-01')).toBe('1 January 1990'))
  it('unparseable → null (no guess)', () => expect(formatDateEn('хтозна коли')).toBeNull())
})

describe('translateAuthority — glossary with historical locks', () => {
  it('Міліція → Militsiya (NOT Police)', () => {
    const r = translateAuthority('Міліція Ленінського району')
    expect(r).toBe('Militsiya')
    expect(r).not.toMatch(/Police/i)
  })
  it('civil registry ЗАГС → Civil status authority', () => {
    expect(translateAuthority('Вінницький районний відділ ЗАГС')).toMatch(/civil/i)
  })
  it('unknown text → null (goes to LLM translator)', () => {
    expect(translateAuthority('просто якийсь текст')).toBeNull()
  })
})
