/**
 * confirmedValueGuard.test.ts — Phase 3.1 (ADR-017 C3) server-side release-value sanitation.
 *
 * Pins the deterministic guard that every value about to enter a CERTIFIED
 * English translation PDF must pass. No AI, no I/O. Release values are Latin
 * post-KMU-55; Cyrillic / control chars / over-length / malformed dates are
 * defects that must never reach a legal document.
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { validateConfirmedValue } from '../confirmedValueGuard'

describe('validateConfirmedValue — hard sanitation', () => {
  it('rejects Cyrillic in a release value', () => {
    const v = validateConfirmedValue('family_name', 'Кузьменко')
    expect(v.ok).toBe(false)
    expect(v.reason).toBe('cyrillic_in_release_value')
  })

  it('accepts a clean Latin name', () => {
    expect(validateConfirmedValue('family_name', 'Kuzmenko').ok).toBe(true)
  })

  it('rejects an over-length value (>200)', () => {
    const v = validateConfirmedValue('given_name', 'A'.repeat(201))
    expect(v.ok).toBe(false)
    expect(v.reason).toBe('too_long')
  })

  it('rejects control / non-printable characters', () => {
    const v = validateConfirmedValue('given_name', 'Ivan')
    expect(v.ok).toBe(false)
    expect(v.reason).toBe('invalid_chars')
  })
})

describe('validateConfirmedValue — critical empties', () => {
  it('rejects empty value on a critical field', () => {
    const v = validateConfirmedValue('family_name', '')
    expect(v.ok).toBe(false)
    expect(v.reason).toBe('empty_critical')
  })

  it('rejects whitespace-only value on a critical field', () => {
    expect(validateConfirmedValue('dob', '   ').ok).toBe(false)
  })

  it('accepts empty value on a non-critical field (nothing dangerous to release)', () => {
    expect(validateConfirmedValue('us_address', '').ok).toBe(true)
  })
})

describe('validateConfirmedValue — date format', () => {
  it('accepts MM/DD/YYYY', () => {
    expect(validateConfirmedValue('date_of_birth', '06/25/1986').ok).toBe(true)
  })

  it('accepts ISO YYYY-MM-DD (the canonical pipeline date format)', () => {
    expect(validateConfirmedValue('date_of_birth', '1986-06-25').ok).toBe(true)
  })

  it('rejects a European-style dotted date', () => {
    const v = validateConfirmedValue('date_of_birth', '25.06.1986')
    expect(v.ok).toBe(false)
    expect(v.reason).toBe('invalid_date_format')
  })

  it('rejects an impossible month', () => {
    expect(validateConfirmedValue('issue_date', '13/01/2020').ok).toBe(false)
  })
})

describe('generate-pdf route — guard is wired and PII-safe', () => {
  const ROUTE = path.resolve(
    __dirname,
    '../../../app/api/translation/generate-pdf/route.ts',
  )
  const src = fs.readFileSync(ROUTE, 'utf-8')

  it('route imports and calls validateConfirmedValue', () => {
    expect(src).toContain('validateConfirmedValue')
    expect(src).toContain('confirmed_value_guard')
  })

  it('route runs the guard UNCONDITIONALLY (not behind the OCR_FIELD_SAFETY flag)', () => {
    // The confirmed-value loop must appear BEFORE the isOcrFieldSafetyEnabled() block.
    const guardIdx = src.indexOf('validateConfirmedValue(f.field')
    const flagIdx = src.indexOf('if (isOcrFieldSafetyEnabled())')
    expect(guardIdx).toBeGreaterThan(-1)
    expect(flagIdx).toBeGreaterThan(-1)
    expect(guardIdx).toBeLessThan(flagIdx)
  })

  it('route never echoes the rejected value (PII rule — field name only)', () => {
    // The 403 response object for the guard must carry `field:` but not the value.
    expect(src).toContain('gate: \'confirmed_value_guard\', field: f.field')
  })
})
