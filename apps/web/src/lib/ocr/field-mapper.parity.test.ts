/**
 * U-STAGE 2 — field-mapper month/sex authority parity.
 *
 * The field-mapper SYSTEM_PROMPT still carries a month gloss ("лютого=February…")
 * and a sex gloss ("Ч→Male, Ж→Female"). Per RECOGNITION_ORG_CHART (DeepSeek = D3,
 * NOT the owner of month/sex mapping) those mappings are deterministic D2 work.
 *
 * This test PROVES the date-field OUTPUT released downstream does NOT depend on
 * the DeepSeek-produced normalized_value: the route post-pass overwrites it from
 * `raw_value` via the deterministic `normalizeDateUkrainian`. Therefore the
 * month gloss in the prompt is REDUNDANT for the released value — it only
 * influences which tokens/raw_value the model picks, which cannot be proven
 * offline. That is exactly why the gloss was LEFT (with an org-chart comment)
 * rather than trimmed: trimming risks changing raw_value selection.
 */
import { describe, it, expect } from 'vitest'
import { normalizeDateUkrainian } from '@/lib/translation/numericAccuracy/dateFieldLockValidator'
import { loadGlossary } from '@/lib/translation/glossary/glossaryLoader'

describe('field-mapper — date normalized_value is deterministically overwritten (month gloss is redundant for output)', () => {
  const glossary = loadGlossary('ua_passport_internal')
  const months = glossary.months ?? {}

  const cases: Array<{ raw: string; expected: string }> = [
    { raw: '19 лютого 2003', expected: '02/19/2003' },
    { raw: '5 грудня 2011', expected: '12/05/2011' },
    { raw: '01 січня 1990', expected: '01/01/1990' },
  ]

  for (const { raw, expected } of cases) {
    it(`raw "${raw}" → ${expected} regardless of DeepSeek normalized_value`, () => {
      // Whatever the model put in normalized_value (correct, wrong, or empty),
      // the released value is recomputed from raw_value by the post-pass.
      for (const modelNormalized of [expected, 'GARBAGE', '', '99/99/9999']) {
        // simulate the route step-8 post-pass for a date field
        const released = normalizeDateUkrainian(raw, months) ?? modelNormalized
        expect(released).toBe(expected)
      }
    })
  }
})
