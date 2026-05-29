import { describe, it, expect } from 'vitest'
import { mapLinesToFields } from '../htr'
import { DOC_TYPES } from '../docTypes'

describe('mapLinesToFields — HTR lines → form fields', () => {
  it('maps marriage-cert lines to fields by Ukrainian label', () => {
    // lines as an HTR engine (Transkribus PAGE XML) would return them
    const lines = [
      'Свідоцтво про шлюб',
      'Прізвище Заставний',
      "Ім'я Андрій",
      'По батькові Іванович',
      'зареєстрували шлюб 25 лютого 2011 року',
      'актовий запис № 294',
      'Серія I-БК № 153243',
    ]
    const f = mapLinesToFields(lines, DOC_TYPES.ua_marriage_certificate)
    expect(f.husband_full_name.cyrillic).toContain('Заставний')
    expect(f.date_of_marriage.cyrillic).toContain('2011')
    expect(f.act_record_number.cyrillic).toContain('294')
  })

  it('label-only line → takes value from next line (label-above-value layout)', () => {
    const lines = ['Прізвище', 'Бородавка', 'По батькові', 'Титович']
    const f = mapLinesToFields(lines, DOC_TYPES.ua_birth_certificate)
    // child_full_name label 'Прізвище' has no inline value → next line 'Бородавка'
    expect(f.child_full_name.cyrillic).toBe('Бородавка')
  })

  it('missing field → can_read false (never invents)', () => {
    const f = mapLinesToFields(['Свідоцтво про шлюб'], DOC_TYPES.ua_marriage_certificate)
    expect(f.husband_full_name.can_read).toBe(false)
    expect(f.husband_full_name.cyrillic).toBe('')
  })
})
