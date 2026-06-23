/**
 * U-STAGE 2 — re-instated DeepSeek boundary guard (Constitution L3).
 * Proves: a DeepSeek-claimed final_value can never escape for an identity/date/
 * number field without the deterministic overwrite.
 */
import { describe, it, expect } from 'vitest'
import {
  findBoundaryViolations,
  assertDeepSeekBoundary,
  DEEPSEEK_FORBIDDEN_AUTHORITY_FIELDS,
  type BoundaryCheckField,
} from './deepseekBoundaryGuard'

describe('deepseekBoundaryGuard — L3 enforcement', () => {
  it('passes when the deterministic overwrite ran (hardened === source-derived)', () => {
    const fields: BoundaryCheckField[] = [
      // name: model claimed a transliteration; hardened is KMU-55 from source
      { field: 'family_name', source_value: 'Шевченко', claimed_final_value: 'Shevchenko', hardened_final_value: 'Shevchenko' },
      // dob: hardened equals source (date normalized later by validator)
      { field: 'dob', source_value: '13.07.1985', claimed_final_value: '07/13/1985', hardened_final_value: '13.07.1985' },
    ]
    expect(findBoundaryViolations(fields)).toEqual([])
  })

  it('flags a critical field where the model claim survived unchanged (no overwrite)', () => {
    const fields: BoundaryCheckField[] = [
      { field: 'passport_number', source_value: 'EK790396', claimed_final_value: 'FB0000000', hardened_final_value: 'FB0000000' },
    ]
    const v = findBoundaryViolations(fields)
    expect(v).toHaveLength(1)
    expect(v[0].field).toBe('passport_number')
  })

  it('flags a released name that still contains Cyrillic (KMU-55 missing)', () => {
    const fields: BoundaryCheckField[] = [
      { field: 'given_name', source_value: 'Тарас', claimed_final_value: 'Тарас', hardened_final_value: 'Тарас' },
    ]
    const v = findBoundaryViolations(fields)
    expect(v.some((x) => x.reason.includes('Cyrillic'))).toBe(true)
  })

  it('ignores non-authority fields entirely (prose may be authored by DeepSeek)', () => {
    const fields: BoundaryCheckField[] = [
      { field: 'us_address_street', source_value: '123 ANY ST', claimed_final_value: '123 Made Up Ave', hardened_final_value: '123 Made Up Ave' },
    ]
    expect(findBoundaryViolations(fields)).toEqual([])
  })

  it('assertDeepSeekBoundary throws on violation, is silent on clean input', () => {
    expect(() => assertDeepSeekBoundary([
      { field: 'dob', source_value: '13.07.1985', claimed_final_value: '', hardened_final_value: '13.07.1985' },
    ])).not.toThrow()
    expect(() => assertDeepSeekBoundary([
      { field: 'a_number', source_value: '123456789', claimed_final_value: '999999999', hardened_final_value: '999999999' },
    ])).toThrow(/L3 violation/)
  })

  it('forbidden-authority set covers identity, date and number fields', () => {
    for (const k of ['family_name', 'dob', 'passport_number', 'sex', 'a_number']) {
      expect(DEEPSEEK_FORBIDDEN_AUTHORITY_FIELDS.has(k)).toBe(true)
    }
  })
})
