import { describe, it, expect } from 'vitest'
import { parseMrz, checkDigit } from '../mrz'

describe('MRZ TD3 parser (controlling Latin)', () => {
  // Real passport from the bench (Kuropiatnyk Sergii, FU262473, DOB 1986-06-25)
  const text = `УКРАЇНА / UKRAINE\nP<UKRKUROPIATNYK<<SERGII<<<<<<<<<<<<<<<<<<<<\nFU262473<7UKR8606257M2902223<<<<<<<<<<<<<<04`

  it('reads the controlling Latin name from MRZ (not re-transliterated)', () => {
    const r = parseMrz(text)
    expect(r.ok).toBe(true)
    expect(r.surname).toBe('KUROPIATNYK')
    expect(r.given_names).toBe('SERGII')
  })

  it('reads passport number, DOB, sex, nationality', () => {
    const r = parseMrz(text)
    expect(r.passport_no).toBe('FU262473')
    expect(r.nationality).toBe('UKR')
    expect(r.date_of_birth).toBe('1986-06-25')
    expect(r.sex).toBe('M')
  })

  it('check digit algorithm (ICAO 7-3-1)', () => {
    expect(checkDigit('860625')).toBe(7) // matches the DOB check digit in the line above
  })

  it('no MRZ in text → not ok, review required', () => {
    const r = parseMrz('just some plain text, no machine zone here')
    expect(r.ok).toBe(false)
    expect(r.review_required).toBe(true)
  })
})
