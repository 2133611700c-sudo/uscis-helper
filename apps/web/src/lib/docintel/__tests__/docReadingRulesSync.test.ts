/**
 * docReadingRulesSync.test.ts — ONE SOURCE → BOTH MODELS guard (closes teaching GAP-3).
 *
 * The codex teaches Gemini (readingRulesPromptBlock) and DeepSeek (textRulesForDeepSeek) from the
 * SAME DOC_READING_RULES. This pins the invariant that NO non-image-only rule silently vanishes from
 * DeepSeek: every per-doc rule that is NOT purely about pixels (orientation/rotation) must survive
 * into the DeepSeek block. So when a future rule is added once, BOTH models learn it (or it's an
 * explicit image-only rule). Also verifies the cross-cutting Russian rules reach both models.
 */
import { describe, it, expect } from 'vitest'
import {
  DOC_READING_RULES,
  readingRulesPromptBlock,
  textRulesForDeepSeek,
  isImageOnlyRule,
} from '../docReadingRules'

const CLASSES = Object.keys(DOC_READING_RULES)

describe('Gemini↔DeepSeek rule sync (one source → both models)', () => {
  it('has doc classes to check', () => {
    expect(CLASSES.length).toBeGreaterThan(5)
  })

  for (const cls of CLASSES) {
    it(`${cls}: every non-image-only rule survives into the DeepSeek block`, () => {
      const gemini = readingRulesPromptBlock(cls)
      const deepseek = textRulesForDeepSeek(cls)
      expect(gemini).not.toBe('') // Gemini gets a block
      expect(deepseek).not.toBe('') // DeepSeek gets a block
      for (const rule of DOC_READING_RULES[cls].rules) {
        if (isImageOnlyRule(rule)) continue // pixel-only rules legitimately drop for the text model
        // a distinctive fragment of the rule must appear in the DeepSeek block (the rule was taught,
        // not silently dropped). Use a stable mid-rule slice that survives clause-stripping.
        const probe = rule.replace(/\[HANDWRITTEN cursive\]/gi, ' ').replace(/\s+/g, ' ').trim().slice(0, 24)
        expect(
          deepseek.includes(probe) || deepseek.includes(rule.slice(-24)),
          `rule silently dropped from DeepSeek for ${cls}: "${rule.slice(0, 50)}…"`,
        ).toBe(true)
      }
    })
  }
})

describe('cross-cutting Russian rules reach BOTH models from one source', () => {
  const RU_CLASSES = ['ua_birth_certificate', 'ua_marriage_certificate', 'ua_divorce_certificate', 'ua_death_certificate']
  for (const cls of RU_CLASSES.filter((c) => DOC_READING_RULES[c])) {
    it(`${cls}: RUSSIAN_SCRIPT_RULE + RUSSIAN_DOCUMENT_RULE in Gemini AND DeepSeek`, () => {
      for (const block of [readingRulesPromptBlock(cls), textRulesForDeepSeek(cls)]) {
        expect(block).toContain('Андрей') // RUSSIAN_SCRIPT_RULE marker (keep Russian forms)
        expect(block).toMatch(/Birth Certificate|СВИДЕТЕЛЬСТВО/) // RUSSIAN_DOCUMENT_RULE marker (RU→EN terms)
      }
    })
  }
})
