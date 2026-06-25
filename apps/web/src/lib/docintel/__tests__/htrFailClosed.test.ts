import { describe, it, expect } from 'vitest'
import { applyHtrFieldRoute } from '../documentFieldReader'
import type { ExtractedDocField } from '../types'

const NAME = new Set(['family_name', 'given_name', 'patronymic'])
const HW = new Set(['family_name', 'given_name', 'patronymic'])

function field(f: string, value: string): ExtractedDocField {
  return { field: f, kind: 'text', raw_cyrillic: 'X', value, confidence: 0.9, review_required: false, source: 'vision', provider: 'gemini' }
}

describe('applyHtrFieldRoute — FAIL-CLOSED for critical handwritten fields (audit safety fix)', () => {
  const llm = [field('family_name', 'FabricatedSurname'), field('given_name', 'FabricatedGiven'), field('date_of_birth', '1990-01-01')]

  it('HTR read above the confidence floor → authoritative raw, LLM Latin cleared, ALWAYS review-gated', () => {
    const out = applyHtrFieldRoute(llm, [{ field: 'family_name', raw_htr_text: 'Куропятник', htr_confidence: 0.96, review_reason: 'handwritten_htr_read' }], NAME, HW)
    const fam = out.find((f) => f.field === 'family_name')!
    expect(fam.raw_cyrillic).toBe('Куропятник')
    expect(fam.value).toBe('') // LLM fabricated Latin cleared; canonical re-derived downstream
    expect(fam.review_required).toBe(true) // a confident HTR read can still be wrong → never auto-final
    expect(fam.review_reasons).toContain('handwritten_htr_read')
  })

  it('FAIL-CLOSED: HTR sidecar unavailable (no result) → critical field NULLED, never the LLM read', () => {
    const out = applyHtrFieldRoute(llm, [], NAME, HW) // sidecar down → empty
    const fam = out.find((f) => f.field === 'family_name')!
    const giv = out.find((f) => f.field === 'given_name')!
    for (const f of [fam, giv]) {
      expect(f.value).toBe('') // NOT 'Fabricated…' — the weaker LLM cursive read is not trusted
      expect(f.raw_cyrillic).toBe('')
      expect(f.confidence).toBe(0)
      expect(f.review_required).toBe(true)
      expect(f.review_reasons).toContain('htr_unavailable_fail_closed')
    }
  })

  it('FAIL-CLOSED: HTR read BELOW the confidence floor → nulled + review (low-confidence is not trusted)', () => {
    const out = applyHtrFieldRoute(llm, [{ field: 'family_name', raw_htr_text: 'мусор', htr_confidence: 0.3, review_reason: 'handwritten_htr_read' }], NAME, HW)
    const fam = out.find((f) => f.field === 'family_name')!
    expect(fam.value).toBe('')
    expect(fam.raw_cyrillic).toBe('')
    expect(fam.review_reasons).toContain('htr_unavailable_fail_closed')
  })

  it('non-name / non-handwritten fields are UNTOUCHED', () => {
    const out = applyHtrFieldRoute(llm, [], NAME, HW)
    const dob = out.find((f) => f.field === 'date_of_birth')!
    expect(dob.value).toBe('1990-01-01') // a printed/non-name field keeps its read
    expect(dob.review_required).toBe(false)
  })
})
