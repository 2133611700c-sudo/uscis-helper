/**
 * linguisticCritic — the owner's doctrine examples, verbatim (2026-07-05). FICTIONAL data.
 * Pins: the critic NEVER authors a value (mayRewriteValue is type-level false); the four
 * headline Ukrainian-document traps classify deterministically.
 */
import { describe, it, expect } from 'vitest'
import { critiquePair } from '../linguisticCritic'

const c = (field: string, value: string, source = 'htr') => ({ field, value, source })

describe('critiquePair — owner doctrine examples', () => {
  it('фамилия: Куропятник vs Куропатник → one_char_name_conflict, never auto-pick', () => {
    const out = critiquePair(c('family_name', 'Куропятник'), c('family_name', 'Куропатник', 'gemini_full_page'), 'name')
    expect(out.map((r) => r.signal)).toEqual(['one_char_name_conflict'])
    expect(out[0].mayRewriteValue).toBe(false)
  })

  it('отчество: Сергеевич (RU) vs Сергійович (UA) → language_variant_conflict', () => {
    const out = critiquePair(c('patronymic', 'Сергеевич'), c('patronymic', 'Сергійович', 'gemini_full_page'), 'patronymic')
    expect(out.map((r) => r.signal)).toEqual(['language_variant_conflict'])
  })

  it('дата: «25 червня 1986» vs «1986-06-25» → date_forms_agree (info, review остаётся законом рукописи)', () => {
    const out = critiquePair(c('dob', '25 червня 1986'), c('dob', '1986-06-25', 'gemini_full_page'), 'date')
    expect(out.map((r) => r.signal)).toEqual(['date_forms_agree'])
    expect(out[0].severity).toBe('info')
  })

  it('латинские двойники внутри кириллицы (І↔I) → script_mismatch (block)', () => {
    const out = critiquePair(c('given_name', 'Iван'), c('given_name', 'Іван', 'gemini_full_page'), 'name')
    expect(out.some((r) => r.signal === 'script_mismatch' && r.severity === 'block')).toBe(true)
  })

  it('одинаковое чтение после фолдинга → пусто (нечего флагать)', () => {
    expect(critiquePair(c('family_name', 'ТЕСТЕНКО'), c('family_name', 'Тестенко'), 'name')).toEqual([])
  })

  it('совсем разные кандидаты → generic candidates_conflict', () => {
    const out = critiquePair(c('family_name', 'Тестенко'), c('family_name', 'Вигаданський', 'gemini_full_page'), 'name')
    expect(out.map((r) => r.signal)).toEqual(['candidates_conflict'])
  })

  it('вывод не несёт значений (keys/signals only — PII-free)', () => {
    const out = critiquePair(c('family_name', 'Куропятник'), c('family_name', 'Куропатник'), 'name')
    expect(JSON.stringify(out)).not.toContain('Куроп')
  })
})
