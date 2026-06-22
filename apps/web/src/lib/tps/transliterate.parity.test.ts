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
 * RESULT (2026-06-22): the two engines DO NOT AGREE. U1 therefore DID NOT
 * replace the fork — per the owner mandate a transliteration change to a name is
 * a correctness event, not a refactor, so the fork stays until these diffs are
 * resolved for review. This test LOCKS the known divergence set: the suite stays
 * green, but any change to fork↔package agreement (drift in either engine) will
 * fail here and resurface the divergence.
 *
 * The material divergences (on NAMES) are:
 *   - Russian ё:  fork → 'e'  vs package → 'ye'   (Соловьёв: Solovev vs Solovyev)
 *   - apostrophe + word-initial я/є/ю/ї: the fork strips the apostrophe and
 *     treats the next letter as WORD-INITIAL (Мар'яна→Maryana), while the package
 *     drops the apostrophe but treats the letter as MID-WORD (→Mariana). Same for
 *     В'ячеслав (Vyacheslav vs Viacheslav), Об'єкт (Obyekt vs Ob’yekt — the
 *     package also retains the ’ here), підʼїзд (pidyizd vs pidizd), Дар’я
 *     (Darya vs Dar’ya).
 *   - the package preserves the literal apostrophe ’ in some positions; the fork
 *     always strips it.
 * The single-character UPPERCASE rows (Є→Ye vs YE, Ж→Zh vs ZH, …) are a probe
 * artifact: a lone capital letter reads as ALL-CAPS to the package's all-caps
 * detector and is uppercased, whereas the fork title-cases. These do not occur in
 * real multi-letter name input, but are pinned here for completeness.
 */
const KNOWN_CHAR_DIVERGENCES: Diff[] = [
  { input: 'Є', fork: 'Ye', pkg: 'YE' },
  { input: 'Ж', fork: 'Zh', pkg: 'ZH' },
  { input: 'Ї', fork: 'Yi', pkg: 'YI' },
  { input: 'Х', fork: 'Kh', pkg: 'KH' },
  { input: 'Ц', fork: 'Ts', pkg: 'TS' },
  { input: 'Ч', fork: 'Ch', pkg: 'CH' },
  { input: 'Ш', fork: 'Sh', pkg: 'SH' },
  { input: 'Щ', fork: 'Shch', pkg: 'SHCH' },
  { input: 'Ю', fork: 'Yu', pkg: 'YU' },
  { input: 'Я', fork: 'Ya', pkg: 'YA' },
  { input: 'ё', fork: 'e', pkg: 'ye' },
  { input: 'Ё', fork: 'E', pkg: 'YE' },
]

const KNOWN_NAME_DIVERGENCES: Diff[] = [
  { input: "Мар'яна", fork: 'Maryana', pkg: 'Mariana' },
  { input: "В'ячеслав", fork: 'Vyacheslav', pkg: 'Viacheslav' },
  { input: 'Дар’я', fork: 'Darya', pkg: 'Dar’ya' },
  { input: 'СОЛОВЬЁВ', fork: 'SOLOVEV', pkg: 'SOLOVYEV' },
  { input: 'Соловьёв', fork: 'Solovev', pkg: 'Solovyev' },
  { input: 'Об’єкт', fork: 'Obyekt', pkg: 'Ob’yekt' },
  { input: 'підʼїзд', fork: 'pidyizd', pkg: 'pidizd' },
]

describe('U1 — KMU-55 fork vs package parity (DIVERGENT — fork NOT replaced)', () => {
  it('single-character agreement is locked to the known divergence set', () => {
    expect(collectDiffs(SINGLE_CHARS)).toEqual(KNOWN_CHAR_DIVERGENCES)
  })

  it('name/place agreement is locked to the known divergence set', () => {
    expect(collectDiffs(WORD_CORPUS)).toEqual(KNOWN_NAME_DIVERGENCES)
  })

  it('the engines AGREE on the common Title-Case Ukrainian name core (no diff)', () => {
    // The everyday surname/given-name path (Title-Case, no apostrophe, no ё)
    // is byte-identical between the two engines — this is what makes the diffs
    // above the precise, reviewable surface rather than a wholesale mismatch.
    const agreeing = [
      'Шевченко', 'Іваненко', 'Коваленко', 'Ткаченко', 'Бондаренко',
      'Згурський', 'Львів', 'Київ', 'Одеса', 'Харків', 'Вінниця',
      'Юрій', 'Яна', 'Ганна', 'Петрівна', 'Тарасович', 'Миколайович',
    ]
    expect(collectDiffs(agreeing)).toEqual([])
  })
})
