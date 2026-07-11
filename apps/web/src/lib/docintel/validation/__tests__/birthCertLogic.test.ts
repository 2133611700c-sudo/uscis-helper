import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import {
  isBirthCertLogicEnabled,
  applyBirthCertLogic,
  type BirthCertLogicField,
} from '../birthCertLogic'

const DOC = 'ua_birth_certificate'

function f(field: string, value: string | null, extra: Partial<BirthCertLogicField> = {}): BirthCertLogicField {
  return { field, value, raw_cyrillic: null, review_required: false, review_reasons: [], ...extra }
}

/** Convenience: get the returned field by id. */
function get(fields: BirthCertLogicField[], id: string): BirthCertLogicField {
  const r = fields.find((x) => x.field === id)
  if (!r) throw new Error(`missing field ${id}`)
  return r
}

describe('isBirthCertLogicEnabled', () => {
  it('is OFF by default (empty env)', () => {
    expect(isBirthCertLogicEnabled({} as NodeJS.ProcessEnv)).toBe(false)
  })
  it('is ON only for "1"', () => {
    expect(isBirthCertLogicEnabled({ BIRTH_CERT_LOGIC_ENABLED: '1' } as unknown as NodeJS.ProcessEnv)).toBe(true)
    expect(isBirthCertLogicEnabled({ BIRTH_CERT_LOGIC_ENABLED: 'true' } as unknown as NodeJS.ProcessEnv)).toBe(false)
    expect(isBirthCertLogicEnabled({ BIRTH_CERT_LOGIC_ENABLED: '0' } as unknown as NodeJS.ProcessEnv)).toBe(false)
  })
})

describe('applyBirthCertLogic — doc type guard', () => {
  it('non-birthcert docType ⇒ applied:false, fields unchanged (same refs, no reasons)', () => {
    const fields = [f('dob', '1990-01-01'), f('father_full_name', 'X')]
    const out = applyBirthCertLogic(fields, 'ua_international_passport')
    expect(out.applied).toBe(false)
    expect(out.flags).toEqual([])
    expect(out.fields).toBe(fields)
    expect(out.fields[0]).toBe(fields[0])
    expect(out.fields[1]).toBe(fields[1])
  })

  it('applies to the Soviet variant docType', () => {
    const fields = [f('dob', '1990-01-01'), f('act_record_date', '1989-01-01')]
    const out = applyBirthCertLogic(fields, 'ua_birth_certificate_soviet')
    expect(out.applied).toBe(true)
    expect(out.flags).toContain('date_order_implausible')
  })
})

describe('date_order check', () => {
  it('act_record_date before dob ⇒ both flagged with date_order_implausible', () => {
    const fields = [f('dob', '1990-01-01'), f('act_record_date', '1989-01-01')]
    const out = applyBirthCertLogic(fields, DOC)
    const dob = get(out.fields, 'dob')
    const act = get(out.fields, 'act_record_date')
    expect(dob.review_required).toBe(true)
    expect(dob.review_reasons).toContain('date_order_implausible')
    expect(act.review_required).toBe(true)
    expect(act.review_reasons).toContain('date_order_implausible')
  })

  it('valid order dob<=act<=issue ⇒ NO review raised by this check', () => {
    const fields = [
      f('dob', '1990-01-01'),
      f('act_record_date', '1990-01-05'),
      f('date_of_issue', '1990-02-01'),
    ]
    const out = applyBirthCertLogic(fields, DOC)
    expect(out.flags).not.toContain('date_order_implausible')
    for (const id of ['dob', 'act_record_date', 'date_of_issue']) {
      const r = get(out.fields, id)
      expect(r.review_required).toBe(false)
      expect(r.review_reasons).toEqual([])
    }
  })

  it('equal dates are NOT a violation', () => {
    const fields = [
      f('dob', '1990-01-01'),
      f('act_record_date', '1990-01-01'),
      f('date_of_issue', '1990-01-01'),
    ]
    const out = applyBirthCertLogic(fields, DOC)
    expect(out.flags).not.toContain('date_order_implausible')
  })

  it('only compares when both dates parse (unparseable ⇒ skipped, no crash)', () => {
    const fields = [f('dob', '1990-01-01'), f('act_record_date', 'not a date')]
    const out = applyBirthCertLogic(fields, DOC)
    expect(out.flags).not.toContain('date_order_implausible')
    expect(get(out.fields, 'dob').review_required).toBe(false)
  })
})

describe('parents_identical check', () => {
  it('father==mother (normalized) ⇒ both flagged', () => {
    const fields = [
      f('father_full_name', 'Іван Петренко'),
      f('mother_full_name', '  іван   петренко '),
    ]
    const out = applyBirthCertLogic(fields, DOC)
    expect(get(out.fields, 'father_full_name').review_reasons).toContain('parents_identical')
    expect(get(out.fields, 'mother_full_name').review_reasons).toContain('parents_identical')
  })

  it('different parents ⇒ not flagged', () => {
    const fields = [
      f('father_full_name', 'Іван Петренко'),
      f('mother_full_name', 'Марія Петренко'),
    ]
    const out = applyBirthCertLogic(fields, DOC)
    expect(out.flags).not.toContain('parents_identical')
  })
})

describe('cert_vs_act_number check', () => {
  it('equal ⇒ both flagged', () => {
    const fields = [
      f('certificate_series_number', 'АБ-123'),
      f('act_record_number', 'АБ-123'),
    ]
    const out = applyBirthCertLogic(fields, DOC)
    expect(get(out.fields, 'certificate_series_number').review_reasons).toContain('certificate_number_equals_act_record')
    expect(get(out.fields, 'act_record_number').review_reasons).toContain('certificate_number_equals_act_record')
  })

  it('different ⇒ not flagged', () => {
    const fields = [
      f('certificate_series_number', 'АБ-123'),
      f('act_record_number', '42'),
    ]
    const out = applyBirthCertLogic(fields, DOC)
    expect(out.flags).not.toContain('certificate_number_equals_act_record')
  })
})

describe('child_surname_parent_match (SOFT) check', () => {
  it('child surname token absent from both parents ⇒ child flagged', () => {
    const fields = [
      f('child_family_name', 'Коваленко'),
      f('father_full_name', 'Іван Петренко'),
      f('mother_full_name', 'Марія Петренко'),
    ]
    const out = applyBirthCertLogic(fields, DOC)
    const child = get(out.fields, 'child_family_name')
    expect(child.review_reasons).toContain('child_surname_no_parent_match')
    // only the child field flagged by this check
    expect(get(out.fields, 'father_full_name').review_required).toBe(false)
    expect(get(out.fields, 'mother_full_name').review_required).toBe(false)
  })

  it('child surname present in a parent ⇒ not flagged', () => {
    const fields = [
      f('child_family_name', 'Петренко'),
      f('father_full_name', 'Іван Петренко'),
      f('mother_full_name', 'Марія Коваль'),
    ]
    const out = applyBirthCertLogic(fields, DOC)
    expect(out.flags).not.toContain('child_surname_no_parent_match')
  })

  it('empty child surname ⇒ check skipped', () => {
    const fields = [
      f('child_family_name', ''),
      f('father_full_name', 'Іван Петренко'),
    ]
    const out = applyBirthCertLogic(fields, DOC)
    expect(out.flags).not.toContain('child_surname_no_parent_match')
  })

  it('both parents empty ⇒ check skipped', () => {
    const fields = [
      f('child_family_name', 'Коваленко'),
      f('father_full_name', ''),
      f('mother_full_name', null),
    ]
    const out = applyBirthCertLogic(fields, DOC)
    expect(out.flags).not.toContain('child_surname_no_parent_match')
  })
})

describe('monotonicity + value immutability', () => {
  it('pre-existing review_required:true stays true and reasons are appended not replaced', () => {
    const fields = [
      f('dob', '1990-01-01', { review_required: true, review_reasons: ['pre_existing_reason'] }),
      f('act_record_date', '1989-01-01'),
    ]
    const out = applyBirthCertLogic(fields, DOC)
    const dob = get(out.fields, 'dob')
    expect(dob.review_required).toBe(true)
    expect(dob.review_reasons).toContain('pre_existing_reason')
    expect(dob.review_reasons).toContain('date_order_implausible')
  })

  it('a field not implicated keeps review_required=false and gets no reason', () => {
    const fields = [
      f('dob', '1990-01-01'),
      f('act_record_date', '1989-01-01'),
      f('place_of_birth_city', 'Київ'),
    ]
    const out = applyBirthCertLogic(fields, DOC)
    const city = get(out.fields, 'place_of_birth_city')
    expect(city.review_required).toBe(false)
    expect(city.review_reasons).toEqual([])
    // untouched field returned by reference
    expect(out.fields.find((x) => x.field === 'place_of_birth_city')).toBe(fields[2])
  })

  it('never mutates value or raw_cyrillic', () => {
    const fields = [
      f('dob', '1990-01-01', { raw_cyrillic: '1 січня 1990' }),
      f('act_record_date', '1989-01-01', { raw_cyrillic: '1 січня 1989' }),
    ]
    const out = applyBirthCertLogic(fields, DOC)
    expect(get(out.fields, 'dob').value).toBe('1990-01-01')
    expect(get(out.fields, 'dob').raw_cyrillic).toBe('1 січня 1990')
    // original objects untouched
    expect(fields[0].review_required).toBe(false)
    expect(fields[0].review_reasons).toEqual([])
  })

  it('never throws on malformed input', () => {
    const fields = [
      f('dob', null),
      f('act_record_date', null, { raw_cyrillic: null }),
      f('father_full_name', null),
    ]
    expect(() => applyBirthCertLogic(fields, DOC)).not.toThrow()
  })
})

describe('date parsing from raw_cyrillic words', () => {
  it('parses handwritten date words when value has no ISO', () => {
    const fields = [
      f('dob', null, { raw_cyrillic: '5 січня 1990' }),        // 1990-01-05
      f('act_record_date', null, { raw_cyrillic: '1 січня 1989' }), // 1989-01-01 (before dob)
    ]
    const out = applyBirthCertLogic(fields, DOC)
    expect(out.flags).toContain('date_order_implausible')
  })
})

describe('source guard — route.ts wiring', () => {
  const routePath = resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../../../../app/api/translation/vision-extract/route.ts',
  )
  const src = readFileSync(routePath, 'utf8')

  it('imports applyBirthCertLogic', () => {
    expect(src).toContain('applyBirthCertLogic')
    expect(src).toContain('isBirthCertLogicEnabled')
  })

  it('calls applyBirthCertLogic flag-gated AFTER runDateEnsemble (both paths)', () => {
    // Compare CALL sites, not the import line: `applyBirthCertLogic(` and
    // `runDateEnsemble(` (the import & the fn declaration have no `(fields`).
    const firstEnsembleCall = src.indexOf('runDateEnsemble(fields')
    const firstLogicCall = src.indexOf('applyBirthCertLogic(fields')
    expect(firstEnsembleCall).toBeGreaterThan(-1)
    expect(firstLogicCall).toBeGreaterThan(firstEnsembleCall)
    // gate present
    expect(src).toContain('isBirthCertLogicEnabled()')
  })
})
