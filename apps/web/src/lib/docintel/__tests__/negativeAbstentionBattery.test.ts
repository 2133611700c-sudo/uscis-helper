/**
 * negativeAbstentionBattery.test.ts — Step 7-neg (owner 2026-06-27).
 * Proves the pipeline NEVER silently auto-fills an unsafe/borrowed read:
 *   - HTR unavailable / blank / low-confidence on a critical handwritten field → value nulled + review.
 *   - A field borrowed free-first from a sibling doc is ALWAYS review-gated, never silently delivered.
 *   - free-first fill only touches EMPTY fields, never overwrites a real read.
 *   - emptiness is decided on BOTH value AND raw_cyrillic.
 * Deterministic — no live Gemini, no real crops (mocks the read/HTR layer).
 */
import { describe, it, expect } from 'vitest'
import { applyHtrFieldRoute, applyKnownValues } from '../documentFieldReader'
import { isEmptyField } from '../ensemble/tileRegionRead'
import type { ExtractedDocField } from '../types'

const NAME = new Set(['family_name', 'given_name', 'patronymic'])
const HW = new Set(['family_name', 'given_name', 'patronymic'])
const mk = (field: string, value: string | null, raw: string | null = 'X'): ExtractedDocField => ({
  field, kind: 'name' as any, raw_cyrillic: raw, value, confidence: 0.9,
  review_required: false, source: 'vision', provider: 'gemini',
})
const htr = (field: string, text: string, conf: number) => ({ field, raw_htr_text: text, htr_confidence: conf, review_reason: 'handwritten_htr_read' })

describe('Step 7-neg: HTR fail-closed on critical handwritten fields', () => {
  it('HTR unavailable (empty) → critical name nulled + review (NOT the LLM read)', () => {
    const out = applyHtrFieldRoute([mk('family_name', 'FabricatedLatin')], [], NAME, HW)
    const f = out.find((x) => x.field === 'family_name')!
    expect(f.value).toBe('')
    expect(f.raw_cyrillic).toBe('')
    expect(f.review_required).toBe(true)
    expect(f.review_reasons).toContain('htr_unavailable_fail_closed')
  })

  it('HTR below confidence floor → rejected (fail-closed)', () => {
    const out = applyHtrFieldRoute([mk('given_name', 'Fab')], [htr('given_name', 'мусор', 0.3)], NAME, HW, 0.5)
    const f = out.find((x) => x.field === 'given_name')!
    expect(f.value).toBe('')
    expect(f.raw_cyrillic).toBe('')
    expect(f.review_reasons).toContain('htr_unavailable_fail_closed')
  })

  it('HTR blank / whitespace text → rejected', () => {
    for (const t of ['', '   \t']) {
      const out = applyHtrFieldRoute([mk('patronymic', 'Fab')], [htr('patronymic', t, 0.95)], NAME, HW)
      expect(out.find((x) => x.field === 'patronymic')!.raw_cyrillic).toBe('')
    }
  })

  it('HTR above floor → authoritative raw + LLM Latin cleared + ALWAYS review', () => {
    const out = applyHtrFieldRoute([mk('family_name', 'WrongLatin')], [htr('family_name', 'Солов’як', 0.96)], NAME, HW)
    const f = out.find((x) => x.field === 'family_name')!
    expect(f.raw_cyrillic).toBe('Солов’як')
    expect(f.value).toBe('')              // never silently presented as a final Latin value
    expect(f.review_required).toBe(true)
  })

  it('non-handwritten / non-name field is untouched by the HTR route', () => {
    const out = applyHtrFieldRoute([mk('date_of_birth', '1990-01-15', '1990-01-15')], [], NAME, HW)
    const f = out.find((x) => x.field === 'date_of_birth')!
    expect(f.value).toBe('1990-01-15')
    expect(f.review_required).toBe(false)
  })
})

describe('Step 7-neg: free-first sibling fill never silently auto-delivers', () => {
  it('a borrowed value fills only an EMPTY field and is ALWAYS review-gated', () => {
    const { fields, filled } = applyKnownValues([mk('passport_number', null, null)], { passport_number: 'MX481390' })
    expect(filled).toBe(1)
    const f = fields.find((x) => x.field === 'passport_number')!
    expect(f.raw_cyrillic).toBe('MX481390')
    expect(f.review_required).toBe(true)
    expect(f.review_reasons).toContain('known_from_sibling')
  })

  it('never overwrites a field that already has a real read', () => {
    const { fields, filled } = applyKnownValues([mk('family_name', 'AlreadyRead', 'Прочитано')], { family_name: 'Sibling' })
    expect(filled).toBe(0)
    expect(fields.find((x) => x.field === 'family_name')!.value).toBe('AlreadyRead')
  })
})

describe('Step 7-neg: emptiness decided on BOTH value and raw_cyrillic', () => {
  it.each([
    ['', '', true],
    [null, null, true],
    ['  ', ' \t', true],
    ['Smith', '', false],
    ['', 'Смит', false],
    ['Smith', 'Смит', false],
  ] as const)('value=%j raw=%j → empty=%s', (v, r, expected) => {
    expect(isEmptyField(mk('f', v, r))).toBe(expected)
  })
})
