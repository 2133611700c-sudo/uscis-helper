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
  stripImageOnlyClauses,
} from '../docReadingRules'

const CLASSES = Object.keys(DOC_READING_RULES)

// ── Token-coverage guard (hardens the old head/tail probe: catches MID-rule loss) ───────────────
// English glue words that carry no rule meaning; dropping them avoids false-fails on common words.
const STOPWORDS = new Set([
  'the','a','an','and','or','of','to','in','on','is','are','be','it','its','as','at','by','for',
  'from','with','that','this','not','no','do','does','if','so','than','then','each','any','all',
  'your','you','may','can','still','etc','vs','into','over','only','but','per','via',
])
const norm = (s: string): string => s.toLowerCase().replace(/\s+/g, ' ').trim()
// Content-bearing tokens: letter/digit runs, length ≥ 3, minus stopwords. Deduped.
function contentTokens(s: string): string[] {
  const raw = s.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []
  return [...new Set(raw.filter((t) => t.length >= 3 && !STOPWORDS.has(t)))]
}
// Every content token of the rule (AFTER the SAME legitimate image-only clause strip the codex
// applies Gemini→DeepSeek) must appear in the DeepSeek block. Catches silent mid-rule deletion.
function tokensMissingFromBlock(rule: string, block: string): string[] {
  const blockLower = block.toLowerCase()
  return contentTokens(stripImageOnlyClauses(rule)).filter((t) => !blockLower.includes(t))
}

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
      const normBlock = norm(deepseek)
      for (const rule of DOC_READING_RULES[cls].rules) {
        if (isImageOnlyRule(rule)) continue // pixel-only rules legitimately drop for the text model
        // PRIMARY (verbatim presence): the WHOLE rule, after the legitimate image-only clause strip,
        // must appear in the DeepSeek block. This is the strong guarantee — it catches whole-rule
        // deletion EVEN when every token of the rule also appears in other rules (the cross-rule
        // token-overlap hole that pure token coverage cannot see). Verified 0/49 rules are non-verbatim.
        expect(
          normBlock.includes(norm(stripImageOnlyClauses(rule))),
          `rule body missing from DeepSeek for ${cls}: "${rule.slice(0, 60)}…"`,
        ).toBe(true)
        // SECONDARY (token diagnostics): pinpoints WHICH tokens were lost on a partial mid-rule edit.
        const missing = tokensMissingFromBlock(rule, deepseek)
        expect(
          missing,
          `rule content lost from DeepSeek for ${cls}: tokens ${JSON.stringify(missing)} from "${rule.slice(0, 50)}…"`,
        ).toEqual([])
      }
    })
  }
})

describe('SELF-TEST: token-coverage guard catches mid-rule loss (do not weaken)', () => {
  // Head + tail survive but the MIDDLE is deleted — exactly what the old probe was blind to.
  const fullRule =
    'CATEGORY is a code, NOT free text — e.g. "C08", "C09", "A12", "C19" (C19/A12 = TPS); read it ' +
    'EXACTLY (letter+digits), do not interpret it.'
  const guttedMiddle = 'CATEGORY is a code, NOT free text — read it EXACTLY (letter+digits), do not interpret it.'
  it('PASSES when the full rule is present', () => {
    expect(tokensMissingFromBlock(fullRule, '- ' + fullRule)).toEqual([])
  })
  it('FAILS (reports lost tokens) when the rule MIDDLE is gutted', () => {
    const missing = tokensMissingFromBlock(fullRule, '- ' + guttedMiddle)
    expect(missing).toContain('c08')
    expect(missing).toContain('c19')
    expect(missing).toContain('tps')
  })
  it('proves the OLD head/tail probe was BLIND to this loss', () => {
    const probe = fullRule.replace(/\s+/g, ' ').trim().slice(0, 24)
    const oldProbePasses = ('- ' + guttedMiddle).includes(probe) || ('- ' + guttedMiddle).includes(fullRule.slice(-24))
    expect(oldProbePasses).toBe(true) // old guard fooled → justifies the hardening
  })
  // The cross-rule-token-overlap hole the final audit found: a whole rule whose EVERY token also
  // appears in a sibling rule. Token coverage alone would NOT catch its deletion; the verbatim
  // presence check MUST.
  it('verbatim check catches whole-rule deletion even when all tokens are shared elsewhere', () => {
    const ruleA = 'settlement oblast region name marker alpha'
    // ruleB carries every content token of A but in a different order → A's verbatim phrase is NOT present.
    const ruleB = 'alpha marker name region oblast settlement listed separately'
    const blockWithoutA = norm('- ' + ruleB) // A deleted; all A tokens still present via B
    expect(tokensMissingFromBlock(ruleA, blockWithoutA)).toEqual([]) // token coverage is FOOLED
    expect(blockWithoutA.includes(norm(ruleA))).toBe(false)          // verbatim check CATCHES it
  })
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
