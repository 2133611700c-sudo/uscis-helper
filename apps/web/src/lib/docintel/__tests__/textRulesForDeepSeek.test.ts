/**
 * textRulesForDeepSeek — L9: teach the TEXT-ONLY DeepSeek structurer from the SAME codex the
 * Gemini reader uses, with pixel-only guidance removed (Constitution L9 + L3).
 *
 * Proves: the Russian rule + spelled-out-date method + best-effort principle are KEPT, the
 * orientation/rotation + "[HANDWRITTEN cursive]" pixel markers are DROPPED, and every doc class
 * returns a non-throwing string.
 */
import { describe, it, expect } from 'vitest'

import {
  textRulesForDeepSeek,
  DOC_READING_RULES,
} from '@/lib/docintel/docReadingRules'

describe('textRulesForDeepSeek — KEEP text rules', () => {
  const block = textRulesForDeepSeek('ua_birth_certificate')

  it('KEEPS the Russian-script rule (transcribe RU as written, Тимофеевич, RU months→01-12)', () => {
    expect(block).toContain('RUSSIAN SOURCE')
    expect(block).toContain('Тимофеевич')
    // RU months mapping clause survives.
    expect(block).toMatch(/января\/февраля.*map to 01–12/)
  })

  it('KEEPS the spelled-out-date METHOD (anchor on the year-words, day-ordinal + month-word → YYYY-MM-DD)', () => {
    expect(block).toContain('пятнадцатого января')
    expect(block).toContain('FIRST anchor on the YEAR')
    expect(block).toContain('Assemble YYYY-MM-DD')
    // the adjacent-month confusion guidance (text-relevant) survives.
    expect(block).toContain('червня/июня = 06 June')
  })

  it('KEEPS the present-but-hard → best-effort / never-drop / never-invent principle', () => {
    expect(block).toContain('BEST-EFFORT')
    expect(block).toMatch(/never\s+DROP a field/)
    expect(block).toMatch(/never\s+INVENT a field/)
  })

  it('KEEPS the per-field examples (father/mother names, series/number)', () => {
    expect(block).toContain('FATHER full name')
    expect(block).toContain('II-БК № 530174')
  })
})

describe('textRulesForDeepSeek — DROP image-only guidance', () => {
  it('ua_birth_certificate: DROPS "read … letter by letter" pixel instruction', () => {
    const block = textRulesForDeepSeek('ua_birth_certificate')
    expect(block.toLowerCase()).not.toContain('letter by letter')
  })

  it('DROPS the "[HANDWRITTEN cursive]" pixel marker', () => {
    const block = textRulesForDeepSeek('ua_birth_certificate')
    expect(block).not.toContain('[HANDWRITTEN cursive]')
  })

  it('ua_military_id: DROPS the orientation/rotation bullet', () => {
    const block = textRulesForDeepSeek('ua_military_id')
    expect(block.toLowerCase()).not.toContain('rotated')
    expect(block.toLowerCase()).not.toContain('rotate upright')
    // but KEEPS the text-relevant series/number example.
    expect(block).toContain('НК 307258')
  })

  it('ua_internal_passport_booklet: DROPS "read names letter by letter", keeps the patronymic warning', () => {
    const block = textRulesForDeepSeek('ua_internal_passport_booklet')
    expect(block.toLowerCase()).not.toContain('letter by letter')
    expect(block).toContain('patronymic')
  })
})

describe('textRulesForDeepSeek — totality + safety', () => {
  it('every doc class returns a non-throwing, non-empty string', () => {
    for (const id of Object.keys(DOC_READING_RULES)) {
      let out = ''
      expect(() => {
        out = textRulesForDeepSeek(id)
      }).not.toThrow()
      expect(typeof out).toBe('string')
      expect(out.length).toBeGreaterThan(0)
    }
  })

  it('unknown class returns "" (never throws)', () => {
    expect(textRulesForDeepSeek('not_a_real_class')).toBe('')
    expect(textRulesForDeepSeek('')).toBe('')
  })

  it('no rule string in any class leaks a pixel-only marker after stripping', () => {
    for (const id of Object.keys(DOC_READING_RULES)) {
      const out = textRulesForDeepSeek(id).toLowerCase()
      expect(out).not.toContain('letter by letter')
      expect(out).not.toContain('photographed rotated')
      expect(out).not.toContain('[handwritten cursive]')
    }
  })
})
