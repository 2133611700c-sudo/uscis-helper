import { describe, it, expect } from 'vitest'
import { parseMrz, checkDigit } from '../mrz'

describe('MRZ TD3 parser (controlling Latin)', () => {
  // Real passport from the bench (Ivanenko Ivan, FA000000, DOB 1990-01-01)
  const text = `УКРАЇНА / UKRAINE\nP<UKRIVANENKO<<IVAN<<<<<<<<<<<<<<<<<<<<<<<<<\nFA000000<5UKR9001011M3001019<<<<<<<<<<<<<<06`

  it('reads the controlling Latin name from MRZ (not re-transliterated)', () => {
    const r = parseMrz(text)
    expect(r.ok).toBe(true)
    expect(r.surname).toBe('IVANENKO')
    expect(r.given_names).toBe('IVAN')
  })

  it('reads passport number, DOB, sex, nationality', () => {
    const r = parseMrz(text)
    expect(r.passport_no).toBe('FA000000')
    expect(r.nationality).toBe('UKR')
    expect(r.date_of_birth).toBe('1990-01-01')
    expect(r.sex).toBe('M')
  })

  it('check digit algorithm (ICAO 7-3-1)', () => {
    expect(checkDigit('900101')).toBe(1) // matches the DOB check digit in the line above
  })

  it('no MRZ in text → not ok, review required', () => {
    const r = parseMrz('just some plain text, no machine zone here')
    expect(r.ok).toBe(false)
    expect(r.review_required).toBe(true)
  })
})
