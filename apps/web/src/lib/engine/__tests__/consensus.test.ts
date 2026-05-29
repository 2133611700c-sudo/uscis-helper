import { describe, it, expect } from 'vitest'
import { reconcileField, readingsAgree, type FieldRead } from '../consensus'

const r = (cyrillic: string, can_read = true, confidence = 0.9): FieldRead => ({ cyrillic, can_read, confidence })

describe('readingsAgree', () => {
  it('orthographic variants agree (Сергій / Сергей)', () => {
    expect(readingsAgree('Сергій', 'Сергей')).toBe(true)
  })
  it('one handwriting confusion still agrees (Тростянець / Простянець)', () => {
    expect(readingsAgree('Тростянець', 'Простянець')).toBe(true)
  })
  it('two different fabricated people DISAGREE', () => {
    expect(readingsAgree('Хроменчук Олег Васильович', 'Людмила Анатольевна')).toBe(false)
  })
  it('printed number variants agree (428069 / № 428069)', () => {
    expect(readingsAgree('428069', '№ 428069')).toBe(true)
  })
  it('empty never agrees', () => {
    expect(readingsAgree('', 'Сергій')).toBe(false)
  })
})

describe('reconcileField — hallucination guard', () => {
  it('two models AGREE → accept', () => {
    const f = reconcileField('child', [
      { model: 'gemini', read: r('REDACTED_NAME Сергій') },
      { model: 'openai', read: r('REDACTED_NAME Сергей') },
    ])
    expect(f.can_read).toBe(true)
    expect(f.confidence).toBe(0.9)
    expect(f.review_required).toBe(false)
    expect(f.reason).toMatch(/agree/)
  })

  it('two models DISAGREE → guard fires, value empty, human required (the real birth-cert case)', () => {
    const f = reconcileField('child', [
      { model: 'gemini', read: r('Хроменчук Олег Васильович') },
      { model: 'openai', read: r('Людмила Анатольевна') },
    ])
    expect(f.can_read).toBe(false)
    expect(f.value).toBe('')
    expect(f.review_required).toBe(true)
    expect(f.reason).toMatch(/HALLUCINATION GUARD/)
    // both fabrications preserved as hints for the human
    expect(f.candidates.map((c) => c.cyrillic)).toContain('Хроменчук Олег Васильович')
    expect(f.candidates.map((c) => c.cyrillic)).toContain('Людмила Анатольевна')
  })

  it('single read of HANDWRITTEN field → not trusted (needs human)', () => {
    const f = reconcileField('child', [
      { model: 'gemini', read: r('Сергій') },
      { model: 'openai', read: r('', false, 0) },
    ])
    expect(f.can_read).toBe(false)
    expect(f.review_required).toBe(true)
  })

  it('single read of PRINTED field → trusted (confirm)', () => {
    const f = reconcileField('series_number', [
      { model: 'gemini', read: r('III-АМ № 428069') },
      { model: 'openai', read: r('', false, 0) },
    ], { printedField: true })
    expect(f.can_read).toBe(true)
    expect(f.value).toMatch(/428069/)
    expect(f.review_required).toBe(true)
  })

  it('no model can read → empty + review', () => {
    const f = reconcileField('child', [
      { model: 'gemini', read: r('', false, 0) },
      { model: 'openai', read: r('', false, 0) },
    ])
    expect(f.can_read).toBe(false)
    expect(f.value).toBe('')
  })

  it('SYSTEMATIC-ERROR GUARD: models AGREE on an open-set name → still review (the Тимофевич case)', () => {
    const f = reconcileField('husband_given_name_patronymic', [
      { model: 'gemini', read: r('Архип Тимофевич') },
      { model: 'openai', read: r('Архип Тимофійович') }, // both wrong (truth: Титович), but agree-ish
    ], { openName: true })
    expect(f.can_read).toBe(true)          // value shown as a suggestion
    expect(f.value).toMatch(/Архип/)
    expect(f.review_required).toBe(true)   // ...but human MUST confirm
    expect(f.reason).toMatch(/open-set name/)
  })

  it('closed field (year) agree → auto-accept, no review', () => {
    const f = reconcileField('marriage_year', [
      { model: 'gemini', read: r('тисяча девятсот тридцять девятий') },
      { model: 'openai', read: r("тисяча дев'ятсот тридцять дев'ятий") },
    ]) // openName not set
    expect(f.can_read).toBe(true)
    expect(f.review_required).toBe(false)
  })

  it('3 models, 2 agree + 1 fabricates → majority wins', () => {
    const f = reconcileField('city', [
      { model: 'gemini', read: r('Тростянець') },
      { model: 'vertex', read: r('Простянець') }, // 1 confusion → agrees
      { model: 'openai', read: r('Кропивницьке') }, // fabrication → outvoted
    ])
    expect(f.can_read).toBe(true)
    expect(f.reason).toMatch(/2 models agree/)
  })
})
