import { describe, it, expect } from 'vitest'
import {
  HAS_CYRILLIC,
  VALID_DATE,
  sharedContentAudit,
  isSharedFormGateEnabled,
  EAD_READINESS_SPEC,
  REPAROLE_READINESS_SPEC,
  type SharedReadinessSpec,
} from '../sharedReadiness'

const SPEC: SharedReadinessSpec = {
  latinFields: ['family_name', 'us_address_street'],
  dateFields: ['dob'],
  aNumberField: 'a_number',
}

describe('sharedReadiness — regex constants (TPS parity)', () => {
  it('HAS_CYRILLIC matches the U+0400–U+04FF block', () => {
    expect(HAS_CYRILLIC.test('Іван')).toBe(true)
    expect(HAS_CYRILLIC.test('Ivan')).toBe(false)
  })

  it('VALID_DATE accepts MM/DD/YYYY and YYYY-MM-DD only', () => {
    expect(VALID_DATE.test('01/02/1990')).toBe(true)
    expect(VALID_DATE.test('1990-01-02')).toBe(true)
    expect(VALID_DATE.test('1990/01/02')).toBe(false)
    expect(VALID_DATE.test('Jan 2 1990')).toBe(false)
  })
})

describe('sharedContentAudit — Cyrillic leak', () => {
  it('flags Cyrillic in a Latin-required field', () => {
    const issues = sharedContentAudit({ family_name: 'Іванов' }, SPEC)
    expect(issues).toEqual([{ field: 'family_name', reason: 'cyrillic_in_pdf_bound_field' }])
  })

  it('passes clean Latin', () => {
    expect(sharedContentAudit({ family_name: 'Ivanov' }, SPEC)).toEqual([])
  })

  it('ignores empty / non-string values', () => {
    expect(sharedContentAudit({ family_name: '', us_address_street: undefined }, SPEC)).toEqual([])
    expect(sharedContentAudit({ family_name: 123 as unknown as string }, SPEC)).toEqual([])
  })
})

describe('sharedContentAudit — date format', () => {
  it('flags a non-canonical date', () => {
    const issues = sharedContentAudit({ dob: '2 Jan 1990' }, SPEC)
    expect(issues).toEqual([{ field: 'dob', reason: 'date_not_mm_dd_yyyy_or_iso' }])
  })

  it('accepts both canonical shapes', () => {
    expect(sharedContentAudit({ dob: '01/02/1990' }, SPEC)).toEqual([])
    expect(sharedContentAudit({ dob: '1990-01-02' }, SPEC)).toEqual([])
  })
})

describe('sharedContentAudit — A-Number', () => {
  it('flags dashes/letters', () => {
    expect(sharedContentAudit({ a_number: '123-456-789' }, SPEC)).toEqual([
      { field: 'a_number', reason: 'a_number_must_be_digits_only' },
    ])
  })

  it('flags out-of-range digit count', () => {
    expect(sharedContentAudit({ a_number: '123456' }, SPEC)).toEqual([
      { field: 'a_number', reason: 'a_number_digit_count_out_of_range' },
    ])
    expect(sharedContentAudit({ a_number: '1234567890' }, SPEC)).toEqual([
      { field: 'a_number', reason: 'a_number_digit_count_out_of_range' },
    ])
  })

  it('accepts 7–9 digits', () => {
    expect(sharedContentAudit({ a_number: '1234567' }, SPEC)).toEqual([])
    expect(sharedContentAudit({ a_number: '123456789' }, SPEC)).toEqual([])
  })

  it('skips the A-Number check when the product has none', () => {
    const spec: SharedReadinessSpec = { ...SPEC, aNumberField: null }
    expect(sharedContentAudit({ a_number: '123-456-789' }, spec)).toEqual([])
  })
})

describe('sharedContentAudit — order + multiplicity (TPS parity)', () => {
  it('emits latin → date → a_number in that order', () => {
    const issues = sharedContentAudit(
      { family_name: 'Іванов', dob: 'bad', a_number: 'X1' },
      SPEC,
    )
    expect(issues.map((i) => i.reason)).toEqual([
      'cyrillic_in_pdf_bound_field',
      'date_not_mm_dd_yyyy_or_iso',
      'a_number_must_be_digits_only',
    ])
  })
})

describe('product specs', () => {
  it('EAD spec uses camelCase EadFieldData keys', () => {
    expect(EAD_READINESS_SPEC.aNumberField).toBe('alienNumber')
    expect(EAD_READINESS_SPEC.latinFields).toContain('firstName')
    expect(EAD_READINESS_SPEC.dateFields).toEqual(['dob'])
  })

  it('Re-Parole spec matches the existing route preflight list', () => {
    expect(REPAROLE_READINESS_SPEC.aNumberField).toBe('a_number')
    expect(REPAROLE_READINESS_SPEC.latinFields).toContain('mailing_street')
    expect(REPAROLE_READINESS_SPEC.latinFields).toContain('physical_zip')
  })
})

describe('isSharedFormGateEnabled — default OFF', () => {
  it('is OFF when unset', () => {
    expect(isSharedFormGateEnabled({} as NodeJS.ProcessEnv)).toBe(false)
  })

  it('is OFF for falsey strings', () => {
    expect(isSharedFormGateEnabled({ SHARED_FORM_GATE_ENABLED: 'off' } as unknown as NodeJS.ProcessEnv)).toBe(false)
    expect(isSharedFormGateEnabled({ SHARED_FORM_GATE_ENABLED: '0' } as unknown as NodeJS.ProcessEnv)).toBe(false)
    expect(isSharedFormGateEnabled({ SHARED_FORM_GATE_ENABLED: '' } as unknown as NodeJS.ProcessEnv)).toBe(false)
  })

  it('is ON for on/1/true', () => {
    expect(isSharedFormGateEnabled({ SHARED_FORM_GATE_ENABLED: 'on' } as unknown as NodeJS.ProcessEnv)).toBe(true)
    expect(isSharedFormGateEnabled({ SHARED_FORM_GATE_ENABLED: '1' } as unknown as NodeJS.ProcessEnv)).toBe(true)
    expect(isSharedFormGateEnabled({ SHARED_FORM_GATE_ENABLED: 'TRUE' } as unknown as NodeJS.ProcessEnv)).toBe(true)
  })
})
