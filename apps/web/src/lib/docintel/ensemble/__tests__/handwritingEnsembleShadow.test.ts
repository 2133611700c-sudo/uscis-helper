/**
 * handwritingEnsembleShadow — week-plan #3 shadow differ. FICTIONAL data only.
 * Pins: keys-only output; the four regimes (agree/disagree/llm-only/htr-only) classify
 * correctly; strict flag. Architectural basis (owner law): handwriting is solved by
 * candidate ARBITRATION + gates + mandatory review — never by "the best model".
 */
import { describe, it, expect } from 'vitest'
import {
  diffHandwritingReaders,
  isHandwritingEnsembleShadowEnabled,
} from '../handwritingEnsembleShadow'

const NAMES = new Set(['family_name', 'given_name', 'patronymic'])

describe('isHandwritingEnsembleShadowEnabled — strict', () => {
  it("only '1' enables", () => {
    expect(isHandwritingEnsembleShadowEnabled({})).toBe(false)
    expect(isHandwritingEnsembleShadowEnabled({ HANDWRITING_ENSEMBLE_SHADOW: 'true' })).toBe(false)
    expect(isHandwritingEnsembleShadowEnabled({ HANDWRITING_ENSEMBLE_SHADOW: '1' })).toBe(true)
  })
})

describe('diffHandwritingReaders', () => {
  it('classifies the four regimes (the measured hand-A/hand-B complementarity shapes)', () => {
    const llm = [
      { field: 'family_name', raw_cyrillic: 'Тестенко' },   // both agree exactly
      { field: 'given_name', raw_cyrillic: 'Іван' },         // readers disagree
      { field: 'patronymic', raw_cyrillic: 'Петрович' },     // LLM-only (hand B shape)
      { field: 'dob', raw_cyrillic: '1990' },                // not a name field — ignored
    ]
    const htr = [
      { field: 'family_name', text: 'Тестенко', confidence: 0.97 },
      { field: 'given_name', text: 'Инан', confidence: 0.6 },
    ]
    const d = diffHandwritingReaders(llm, htr, NAMES)
    expect(d.fields_compared).toBe(3)
    expect(d.agree_exact).toEqual(['family_name'])
    expect(d.disagree).toEqual(['given_name'])
    expect(d.llm_only).toEqual(['patronymic'])
    expect(d.htr_only).toEqual([])
  })

  it('htr-only + fold-agreement (case/punct differences are the same read)', () => {
    const d = diffHandwritingReaders(
      [{ field: 'family_name', raw_cyrillic: 'ТЕСТЕНКО.' }],
      [
        { field: 'family_name', text: 'Тестенко', confidence: 0.9 },
        { field: 'given_name', text: 'Іван', confidence: 0.9 },
      ],
      NAMES,
    )
    expect(d.agree_fold).toEqual(['family_name'])
    expect(d.htr_only).toEqual(['given_name'])
  })

  it('output is keys-only — no read text ever leaks (PII-free)', () => {
    const d = diffHandwritingReaders(
      [{ field: 'family_name', raw_cyrillic: 'Вигаданенко' }],
      [{ field: 'family_name', text: 'Інше', confidence: 0.5 }],
      NAMES,
    )
    const json = JSON.stringify(d)
    expect(json).not.toContain('Вигаданенко')
    expect(json).not.toContain('Інше')
  })
})

describe('child_* namespace fold (live-caught 2026-07-05)', () => {
  it('birth-cert child_family_name сравнивается с HTR family_name как ОДНО поле', () => {
    const d = diffHandwritingReaders(
      [{ field: 'child_family_name', raw_cyrillic: 'Тестенко' }],
      [{ field: 'family_name', text: 'Тестенко', confidence: 0.95 }],
      NAMES,
    )
    expect(d.agree_exact).toEqual(['family_name'])
    expect(d.htr_only).toEqual([])
  })
})

describe('placeholder collision (live-caught 2026-07-05)', () => {
  it('пустой bare-key placeholder НЕ затирает непустой child_* при фолдинге', () => {
    const d = diffHandwritingReaders(
      [
        { field: 'child_family_name', raw_cyrillic: 'Тестенко' },
        { field: 'family_name', raw_cyrillic: null, value: null }, // placeholder из HTR-этапа
      ],
      [{ field: 'family_name', text: 'Тестенко', confidence: 0.95 }],
      NAMES,
    )
    expect(d.agree_exact).toEqual(['family_name'])
    expect(d.htr_only).toEqual([])
  })
})
