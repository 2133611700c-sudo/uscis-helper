/**
 * fieldConsistencyCritic — the deterministic VERIFY node. FICTIONAL data only.
 * Pins: each check fires on a real contradiction, stays silent on clean/unparseable input,
 * findings are keys-only (PII-free), and the critic never proposes values.
 */
import { describe, it, expect } from 'vitest'
import { runConsistencyCritic, type CriticInputField } from '../fieldConsistencyCritic'

const NOW = new Date('2026-07-04T00:00:00Z')
const f = (key: string, value: string | null, rawCyrillic?: string | null): CriticInputField =>
  ({ key, value, rawCyrillic })

describe('runConsistencyCritic', () => {
  it('clean consistent document → zero findings', () => {
    const out = runConsistencyCritic([
      f('dob', '1990-01-01'),
      f('issue_date', '2015-06-01'),
      f('expiry_date', '2025-06-01'),
      f('sex', 'M'),
      f('patronymic', 'Petrovych', 'Петрович'),
      f('passport_number', 'AB123456'),
      f('place_of_birth_city', null, 'Київ'),
    ], NOW)
    expect(out).toEqual([])
  })

  it('C1: dob after issue + issue after expiry → two date_order findings', () => {
    const out = runConsistencyCritic([
      f('dob', '2016-01-01'),
      f('issue_date', '2015-06-01'),
      f('expiry_date', '2010-06-01'),
    ], NOW)
    const checks = out.map((x) => x.reviewReason)
    expect(checks).toContain('critic:dob_not_before_issue')
    expect(checks).toContain('critic:issue_not_before_expiry')
  })

  it('C2: dob in the future / age > 120', () => {
    expect(runConsistencyCritic([f('dob', '2030-01-01')], NOW).map((x) => x.reviewReason))
      .toContain('critic:dob_in_future')
    expect(runConsistencyCritic([f('dob', '1890-01-01')], NOW).map((x) => x.reviewReason))
      .toContain('critic:age_over_120')
  })

  it('C3: female sex + male patronymic suffix → conflict (via rawCyrillic too)', () => {
    const out = runConsistencyCritic([
      f('sex', 'F'),
      f('patronymic', null, 'Петрович'),
    ], NOW)
    expect(out.map((x) => x.check)).toContain('sex_patronymic_conflict')
    // consistent pair stays silent
    expect(runConsistencyCritic([f('sex', 'F'), f('patronymic', null, 'Петрівна')], NOW)).toEqual([])
  })

  it('C4: unknown Cyrillic place → SOFT place_unverified; known place silent', () => {
    const unknown = runConsistencyCritic([f('place_of_birth_city', null, 'Вигаданське')], NOW)
    expect(unknown.map((x) => x.check)).toContain('place_unverified')
    expect(runConsistencyCritic([f('place_of_birth_city', null, 'Київ')], NOW)).toEqual([])
    // Latin value → not judged (script-gated)
    expect(runConsistencyCritic([f('place_of_birth_city', 'Kyiv', null)], NOW)).toEqual([])
  })

  it('C5: invalid passport number format → doc_number_invalid', () => {
    const out = runConsistencyCritic([f('passport_number', '??')], NOW)
    expect(out.map((x) => x.check)).toContain('doc_number_invalid')
  })

  it('unparseable dates yield NO findings (fail-open, absence ≠ correctness)', () => {
    expect(runConsistencyCritic([f('dob', 'не читається'), f('issue_date', '???')], NOW)).toEqual([])
  })

  it('findings are keys-only (PII-free) and never carry values', () => {
    const out = runConsistencyCritic([f('dob', '2030-01-01'), f('sex', 'F'), f('patronymic', null, 'Петрович')], NOW)
    const json = JSON.stringify(out)
    expect(json).not.toContain('2030-01-01')
    expect(json).not.toContain('Петрович')
  })
})
