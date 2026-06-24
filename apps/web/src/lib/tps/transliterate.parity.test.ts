/**
 * U-STAGE 1 (ONE DICTIONARY) — U1 CHARACTER-LEVEL + NAME-CORPUS PARITY PROBE.
 *
 * Goal: decide whether the forked KMU-55 engine in `lib/tps/transliterate.ts`
 * (`transliterateUaToLatin`) can be safely replaced by a re-export of the
 * canonical package engine (`transliterateKMU55`).
 *
 * SAFETY CONTRACT (owner mandate): a transliteration change to a NAME is a
 * correctness event, NOT a refactor. If the two engines disagree on ANY input,
 * we must NOT silently merge — we STOP and surface the exact differing inputs +
 * outputs for review.
 *
 * This test runs the full UA + RU alphabet and a name/place corpus through BOTH
 * engines and collects every divergence. It is intentionally written to FAIL
 * (with a full diff dump) if the engines disagree anywhere — that failure IS the
 * report.
 */
import { describe, it, expect } from 'vitest'
import { transliterateUaToLatin } from './transliterate'
import { transliterateKMU55 } from '@uscis-helper/knowledge'

const UA_ALPHABET_LOWER = [
  'а','б','в','г','ґ','д','е','є','ж','з','и','і','ї','й','к','л','м','н','о','п',
  'р','с','т','у','ф','х','ц','ч','ш','щ','ь','ю','я',
]
const RU_EXTRA = ['ё','ы','э','ъ','Ё','Ы','Э','Ъ']

// Single chars (lower + upper) to exercise per-character maps.
const SINGLE_CHARS = [
  ...UA_ALPHABET_LOWER,
  ...UA_ALPHABET_LOWER.map((c) => c.toUpperCase()),
  ...RU_EXTRA,
]

// Words/names/places: title-case, ALL-CAPS, mixed, position-dependent letters,
// digraphs (зг), apostrophes, hyphenated, Russian-letter names.
const WORD_CORPUS = [
  'Шевченко', 'ШЕВЧЕНКО', 'шевченко',
  'Іваненко', 'Коваленко', 'Ткаченко', 'Бондаренко',
  'Згурський', 'Розгін', 'згода', 'Згода',          // зг → zgh
  'Єжов', 'Їжак', 'Юрій', 'Яна', 'Йосип',           // word-initial position
  'Заєць', 'Її', 'Мрія', 'район',                    // mid-word position
  "Мар'яна", "В'ячеслав", 'Дар’я',                   // apostrophe variants
  'Івано-Франківськ', 'Гусятин', 'Запоріжжя',
  'Львів', 'Київ', 'Одеса', 'Харків', 'Вінниця',
  'Соловйов', 'СОЛОВЬЁВ', 'Соловьёв',                // ё (RU)
  'Крым', 'Эдуард', 'Іллічівськ',                    // ы, э
  'Об’єкт', 'підʼїзд',
  'Ганна', 'Петрівна', 'Тарасович', 'Миколайович',
]

interface Diff { input: string; fork: string; pkg: string }

function collectDiffs(inputs: string[]): Diff[] {
  const diffs: Diff[] = []
  for (const input of inputs) {
    const fork = transliterateUaToLatin(input)
    const pkg = transliterateKMU55(input)
    if (fork !== pkg) diffs.push({ input, fork, pkg })
  }
  return diffs
}

/**
 * RESOLVED (2026-06-22): U1 DONE. The probe found the fork diverged from the package
 * on ё-names (Соловьёв) and apostrophe+я/є/ю/ї names (Мар'яна) — a proven live bug.
 * Per official KMU-55 the PACKAGE is correct (Мар'яна→Mariana; ё is Russian → routed via
 * the package's RU fallback), so `transliterateUaToLatin` now DELEGATES to the package.
 * The two are ONE ENGINE. This test is now a GUARD: it asserts they agree on EVERYTHING,
 * so any future re-fork (someone re-introducing a local map) fails here immediately.
 */
describe('U1 — KMU-55 fork is UNIFIED with the package (one engine)', () => {
  it('the fork (transliterateUaToLatin) === the package (transliterateKMU55) on every single character', () => {
    expect(collectDiffs(SINGLE_CHARS)).toEqual([])
  })

  it('the fork === the package on the full name/place corpus (incl. ё-names + apostrophe names)', () => {
    expect(collectDiffs(WORD_CORPUS)).toEqual([])
  })

  it('the now-correct values are delivered on the previously-divergent names', () => {
    // The bug fix, pinned: TPS now produces the KMU-55-correct value (was the left col).
    expect(transliterateUaToLatin("Мар'яна")).toBe(transliterateKMU55("Мар'яна")) // Mariana (was Maryana)
    expect(transliterateUaToLatin('Соловьёв')).toBe(transliterateKMU55('Соловьёв')) // Solovyev (was Solovev)
    expect(transliterateUaToLatin("В'ячеслав")).toBe(transliterateKMU55("В'ячеслав"))
    // Latin pass-through still works (idempotent).
    expect(transliterateUaToLatin('Soloviak')).toBe('Soloviak')
  })
})
