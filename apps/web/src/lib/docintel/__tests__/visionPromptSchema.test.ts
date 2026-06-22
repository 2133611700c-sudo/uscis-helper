/**
 * R1/R2 — vision prompt + response-schema construction (geminiVisionProvider).
 *
 * Guards the two cheap-but-high-impact OCR fixes:
 *  R1 — the per-field `handwritten` flag reaches the prompt, and a multi-date doc
 *       gets the date-distinctness rule (fixes the verified DOB==date-of-issue copy).
 *  R2 — a strict per-field responseSchema is built from the spec (kills JSON.parse
 *       failures + enforces the {cyrillic,can_read,confidence,...} shape).
 */
import { describe, it, expect } from 'vitest'
import { buildPrompt, buildResponseSchema } from '../providers/geminiVisionProvider'
import { getDocTypeSpec, DOCUMENT_TYPES } from '../documentRegistry'
import { readingRulesPromptBlock, DOC_READING_RULES } from '../docReadingRules'

const booklet = getDocTypeSpec('ua_internal_passport_booklet')!

describe('R1 — buildPrompt threads handwritten + date-distinctness', () => {
  it('the booklet spec exists with handwritten fields and >1 date field', () => {
    expect(booklet).toBeTruthy()
    expect(booklet.fields.some((f) => f.handwritten)).toBe(true)
    expect(booklet.fields.filter((f) => f.kind === 'date').length).toBeGreaterThan(1)
  })

  it('marks handwritten fields in the field list', () => {
    const p = buildPrompt(booklet)
    expect(p).toContain('[HANDWRITTEN cursive')
    // a known handwritten field label appears with the marker nearby
    expect(p).toMatch(/family_name[^\n]*HANDWRITTEN/)
  })

  it('adds the date-distinctness rule for a multi-date doc (no date copying)', () => {
    const p = buildPrompt(booklet)
    expect(p).toMatch(/SEPARATE date fields/i)
    expect(p).toMatch(/NEVER copy one date into another/i)
    expect(p).toMatch(/date of birth is NOT the date of issue/i)
  })

  it('adds the handwriting digit-confusable guidance when handwritten fields exist', () => {
    const p = buildPrompt(booklet)
    expect(p).toMatch(/HANDWRITING/)
    expect(p).toMatch(/read each digit/i)
  })

  it('still forbids self-transliteration and inventing values', () => {
    const p = buildPrompt(booklet)
    expect(p).toMatch(/Do NOT transliterate to Latin yourself/)
    expect(p).toMatch(/NEVER invent/)
  })
})

describe('STAGE 1 — per-document reading rules (teach the brain)', () => {
  it('birth-cert rules teach the cursive-month-word + RU/UA + spelled-out date', () => {
    const block = readingRulesPromptBlock('ua_birth_certificate')
    expect(block).toMatch(/червня\/июня = 06 June/)
    expect(block).toMatch(/NOT.*июля = 07 July/)
    expect(block).toMatch(/SPELLED OUT in cursive WORDS/)
    expect(block).toMatch(/do NOT Ukrainianize/i)
  })

  it('international-passport rules teach controlling Latin + MRZ anchor', () => {
    const block = readingRulesPromptBlock('ua_international_passport')
    expect(block).toMatch(/CONTROLLING/)
    expect(block).toMatch(/SERGII/)
    expect(block).toMatch(/MRZ/)
  })

  it('every rule set has language + at least one rule', () => {
    for (const [id, r] of Object.entries(DOC_READING_RULES)) {
      expect(r.language, id).toBeTruthy()
      expect(r.rules.length, id).toBeGreaterThan(0)
    }
  })

  it('COMPLETENESS — EVERY document class in the registry has reading rules', () => {
    // Owner rule: every document must have its own rules with examples. This guard
    // fails if a new doc type is added to the registry without a reading-rules block.
    const allIds = Object.keys(DOCUMENT_TYPES)
    const missing = allIds.filter((id) => !DOC_READING_RULES[id])
    expect(missing, `doc classes WITHOUT reading rules: ${missing.join(', ')}`).toEqual([])
  })

  it('flag is DEFAULT ON: present when unset, absent only when =0', () => {
    const booklet = getDocTypeSpec('ua_birth_certificate')!
    const prev = process.env.DOC_READING_RULES_ENABLED
    try {
      delete process.env.DOC_READING_RULES_ENABLED // default
      expect(buildPrompt(booklet)).toMatch(/DOCUMENT-SPECIFIC READING RULES/)
      process.env.DOC_READING_RULES_ENABLED = '0' // explicit rollback
      expect(buildPrompt(booklet)).not.toMatch(/DOCUMENT-SPECIFIC READING RULES/)
    } finally {
      if (prev === undefined) delete process.env.DOC_READING_RULES_ENABLED
      else process.env.DOC_READING_RULES_ENABLED = prev
    }
  })
})

describe('R2 — buildResponseSchema is a strict per-field object schema', () => {
  it('produces an object schema with one property per spec field', () => {
    const s = buildResponseSchema(booklet) as any
    expect(s.type).toBe('object')
    for (const f of booklet.fields) {
      expect(s.properties[f.field]).toBeTruthy()
      expect(s.properties[f.field].type).toBe('object')
      expect(s.properties[f.field].required).toEqual(
        expect.arrayContaining(['cyrillic', 'can_read', 'confidence']),
      )
    }
  })

  it('includes iso_date only on date fields', () => {
    const s = buildResponseSchema(booklet) as any
    const dateField = booklet.fields.find((f) => f.kind === 'date')!
    const nonDate = booklet.fields.find((f) => f.kind !== 'date')!
    expect(s.properties[dateField.field].properties.iso_date).toBeTruthy()
    expect(s.properties[nonDate.field].properties.iso_date).toBeUndefined()
  })
})
