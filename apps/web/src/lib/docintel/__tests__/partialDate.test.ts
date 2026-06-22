/**
 * partialDate.test.ts — real defect: Gemini returns "1939-00-00" (year-only / illegible
 * month-day) on old certificates; the old ISO regex accepted it and D2 produced a fake
 * "00/00/1939". Now: full legal dates pass, year-only keeps the year, garbage → null.
 */
import { describe, it, expect } from 'vitest'
import { toCanonicalValue } from '@/lib/docintel/transliterationPolicy'
const dt = (iso: string | null) => ({ field: 'dob', cyrillic: '', can_read: true, confidence: 0.9, reason: '', iso_date: iso })

describe('partial / invalid ISO date handling', () => {
  it('passes a full legal date', () => {
    expect(toCanonicalValue(dt('1986-06-25') as never, 'date')).toBe('1986-06-25')
  })
  it('year-only "1939-00-00" → keeps the year, not a fake day/month', () => {
    expect(toCanonicalValue(dt('1939-00-00') as never, 'date')).toBe('1939')
  })
  it('illegal month/day → null (never a nonsensical date)', () => {
    expect(toCanonicalValue(dt('1986-13-45') as never, 'date')).toBeNull()
    expect(toCanonicalValue(dt('1986-00-10') as never, 'date')).toBeNull()
    expect(toCanonicalValue(dt('0000-00-00') as never, 'date')).toBeNull()
  })
  it('non-ISO / missing → null', () => {
    expect(toCanonicalValue(dt(null) as never, 'date')).toBeNull()
    expect(toCanonicalValue(dt('25.06.1986') as never, 'date')).toBeNull()
  })
})
