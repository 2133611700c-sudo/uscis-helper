/**
 * patronymic.ts — D2 Validator: Ukrainian patronymic (по батькові) engine.
 *
 * WHY THIS EXISTS
 * Handwritten Cyrillic OCR routinely returns a SUFFIX FRAGMENT for the
 * patronymic ("ович", "Yovych") instead of the full word, or a garbled stem.
 * A patronymic is NOT free text — in Ukrainian it is DERIVED deterministically
 * from the father's given name + the child's sex. So instead of trusting a
 * shaky read, the Chief Engineer (Central Brain) can:
 *   1. VALIDATE a read (is it a complete, well-formed patronymic?), and
 *   2. RECONSTRUCT it from the given name + sex when the read is a fragment.
 *
 * This module NEVER guesses silently. When it cannot derive a value with
 * confidence, it returns review_required=true and an empty/candidate value —
 * the human confirms. (v5 §7: model "what seems likely" is never source of
 * truth; D2 only emits values it can derive from closed rules.)
 *
 * Cyrillic only. KMU-55 transliteration happens downstream (Transliterator).
 */

export type Sex = 'M' | 'F'

export interface PatronymicResult {
  /** Canonical Cyrillic patronymic, or '' when not derivable. */
  value: string
  /** How we got it. */
  source: 'read_valid' | 'generated_regular' | 'generated_exception' | 'unresolved'
  /** Human must confirm before this becomes final. */
  review_required: boolean
  /** Short machine-readable reason for the audit log. */
  reason: string
}

const MALE_SUFFIXES = ['ович', 'йович', 'ьович', 'ич'] as const
const FEMALE_SUFFIXES = ['івна', 'ївна', 'инічна', 'ічна'] as const

/**
 * Irregular / non-productive given names whose patronymic cannot be produced
 * by the regular rules. Seeded from real Ukrainian usage + the documents in
 * the project's ground-truth set. Extend as the gazetteer of names grows.
 * Key = given name in nominative (lowercase Cyrillic).
 */
const EXCEPTIONS: Record<string, { M: string; F: string }> = {
  // -о / -а stems that take an inserted -й- or an irregular stem
  'микола':   { M: 'Миколайович',  F: 'Миколаївна' },
  'петро':    { M: 'Петрович',     F: 'Петрівна' },
  'павло':    { M: 'Павлович',     F: 'Павлівна' },
  'дмитро':   { M: 'Дмитрович',    F: 'Дмитрівна' },
  'григорій': { M: 'Григорович',   F: 'Григорівна' },
  'ілля':     { M: 'Ілліч',        F: 'Іллівна' },
  'лука':     { M: 'Лукич',        F: 'Луківна' },
  'кузьма':   { M: 'Кузьмич',      F: 'Кузьмівна' },
  'хома':     { M: 'Хомич',        F: 'Хомівна' },
  'сава':     { M: 'Савич',        F: 'Савівна' },
  'микита':   { M: 'Микитович',    F: 'Микитівна' },
  'яків':     { M: 'Якович',       F: 'Яківна' },
  'лев':      { M: 'Львович',      F: 'Львівна' },
}

/** Normalize a Cyrillic name token for lookup/derivation. */
function norm(s: string): string {
  return (s ?? '').trim().replace(/\s+/g, ' ')
}

/** Title-case a Cyrillic word (first letter upper, rest as-is lower). */
function titleCase(s: string): string {
  if (!s) return s
  return s[0].toLocaleUpperCase('uk') + s.slice(1).toLocaleLowerCase('uk')
}

/**
 * Is `value` a complete, well-formed patronymic for the given sex?
 * Rejects suffix fragments ("ович" alone), digits, and too-short tokens.
 */
export function isValidPatronymic(value: string, sex?: Sex): boolean {
  const v = norm(value).toLocaleLowerCase('uk')
  if (!v || /[0-9]/.test(v)) return false
  if (v.length < 6) return false // "ович"(4)/"йович"(5) fragments rejected; shortest real ≈ "Ілліч"(5)→allow? no: require root
  const suffixes = sex === 'F' ? FEMALE_SUFFIXES : sex === 'M' ? MALE_SUFFIXES : [...MALE_SUFFIXES, ...FEMALE_SUFFIXES]
  const endsOk = suffixes.some((suf) => v.endsWith(suf))
  if (!endsOk) return false
  // Must have a real root before the suffix (reject bare suffix fragments).
  const matched = suffixes.find((suf) => v.endsWith(suf))!
  const root = v.slice(0, v.length - matched.length)
  return root.length >= 2
}

/**
 * Derive the patronymic from a father's given name + sex using the regular
 * Ukrainian rules, falling back to the exceptions table. Returns '' when the
 * name shape is not covered (caller must send to human review).
 */
export function generatePatronymic(givenName: string, sex: Sex): { value: string; source: PatronymicResult['source'] } {
  const name = norm(givenName).toLocaleLowerCase('uk')
  if (!name || name.length < 2) return { value: '', source: 'unresolved' }

  const ex = EXCEPTIONS[name]
  if (ex) return { value: ex[sex], source: 'generated_exception' }

  const last = name[name.length - 1]

  // -ій / -їй ending (Тарас, Андрій, Валерій, Юрій): +ович / replace й→ївна
  if (name.endsWith('ій') || name.endsWith('їй')) {
    if (sex === 'M') return { value: titleCase(name + 'ович'), source: 'generated_regular' } // Тарас→Тарасович
    return { value: titleCase(name.slice(0, -1) + 'ївна'), source: 'generated_regular' }      // Тарас→Сергіївна
  }

  // other -й ending (rare): drop й, +йович / +ївна
  if (last === 'й') {
    const stem = name.slice(0, -1)
    if (sex === 'M') return { value: titleCase(stem + 'йович'), source: 'generated_regular' }
    return { value: titleCase(stem + 'ївна'), source: 'generated_regular' }
  }

  // consonant ending (Іван, Олександр, Володимир, Степан, Тит, Андрон):
  // +ович / +івна. This is the productive regular pattern.
  const vowels = 'аеиіїоуюяєё'
  if (!vowels.includes(last)) {
    if (sex === 'M') return { value: titleCase(name + 'ович'), source: 'generated_regular' }
    return { value: titleCase(name + 'івна'), source: 'generated_regular' }
  }

  // -о / -а / -я endings not in the exceptions table: NOT safely derivable.
  return { value: '', source: 'unresolved' }
}

/**
 * The Chief Engineer's entry point. Given whatever the Reader saw (possibly a
 * fragment) plus the known given name + sex, return the canonical patronymic
 * with provenance + review flag.
 *
 * Priority:
 *   1. A read that is already a complete, well-formed patronymic → keep it
 *      (the document is the source of truth, v5 §7).
 *   2. Otherwise derive from given name + sex (regular or exception).
 *   3. Otherwise unresolved → empty + review_required (never guess).
 */
export function reconcilePatronymic(
  read: string | null | undefined,
  givenName: string | null | undefined,
  sex: Sex,
): PatronymicResult {
  const r = norm(read ?? '')
  if (r && isValidPatronymic(r, sex)) {
    return { value: titleCase(r), source: 'read_valid', review_required: false, reason: 'read is complete and well-formed' }
  }

  const gen = generatePatronymic(givenName ?? '', sex)
  if (gen.value) {
    // Generated values still want a light human glance (the given name itself
    // came from handwriting), but they are high-confidence.
    return {
      value: gen.value,
      source: gen.source,
      review_required: gen.source === 'generated_exception' ? false : true,
      reason: r ? `read "${r}" was a fragment/garbled; reconstructed from given name` : 'no read; reconstructed from given name',
    }
  }

  return { value: '', source: 'unresolved', review_required: true, reason: 'could not validate read nor derive from given name' }
}

/* ======================================================================== *
 * RUSSIAN patronymic (отчество) engine.
 *
 * WHY: Soviet-era / Russian-context documents (e.g. a 1986 Soviet birth
 * certificate) carry the parents' names in RUSSIAN (Сергей Леонидович,
 * Наталия Степановна). The Ukrainian engine above cannot reconcile these,
 * forcing every such doc to manual review. Russian отчество is, like the
 * Ukrainian one, DERIVED deterministically from the father's given name +
 * the child's sex — so the same validate / reconstruct discipline applies.
 *
 * Same contract as the Ukrainian engine: never guess silently; when a value
 * is not derivable, return review_required=true with an empty/candidate value.
 * Cyrillic only; KMU-55 / GOST transliteration happens downstream.
 * ======================================================================== */

const MALE_SUFFIXES_RU = ['ович', 'евич', 'ич'] as const
const FEMALE_SUFFIXES_RU = ['овна', 'евна', 'ична', 'инична'] as const

/**
 * Irregular Russian given names whose отчество is not produced by the regular
 * rules (special stem, inserted consonant, or non-productive -ич/-ична form).
 * Key = given name in nominative (lowercase Cyrillic). Only names verified as
 * standard Russian usage are included — a wrong patronymic on a legal document
 * is harmful, so anything uncertain is OMITTED (falls through to review).
 */
const EXCEPTIONS_RU: Record<string, { M: string; F: string }> = {
  'сергей': { M: 'Сергеевич', F: 'Сергеевна' }, // -ей stem keeps -еевич (not Сергейевич)
  'лев':    { M: 'Львович',   F: 'Львовна' },    // fleeting vowel: Лев→Льв-
  'пётр':   { M: 'Петрович',  F: 'Петровна' },   // fleeting ё→е
  'петр':   { M: 'Петрович',  F: 'Петровна' },   // spelling variant without ё
  'никита': { M: 'Никитич',   F: 'Никитична' },  // -а name, non-productive -ич
  'фёдор':  { M: 'Фёдорович', F: 'Фёдоровна' },
  'федор':  { M: 'Фёдорович', F: 'Фёдоровна' },  // spelling variant without ё
  'илья':   { M: 'Ильич',     F: 'Ильинична' },
  'кузьма': { M: 'Кузьмич',   F: 'Кузьминична' },
  'фома':   { M: 'Фомич',     F: 'Фоминична' },
  'лука':   { M: 'Лукич',     F: 'Лукинична' },
  'яков':   { M: 'Яковлевич', F: 'Яковлевна' },  // inserted -л-
}

/** Title-case a Russian word. */
function titleCaseRu(s: string): string {
  if (!s) return s
  return s[0].toLocaleUpperCase('ru') + s.slice(1).toLocaleLowerCase('ru')
}

/**
 * Is `value` a complete, well-formed Russian отчество for the given sex?
 * Rejects suffix fragments ("евич"/"овна" alone), digits, and too-short tokens.
 */
export function isValidPatronymicRu(value: string, sex?: Sex): boolean {
  const v = norm(value).toLocaleLowerCase('ru')
  if (!v || /[0-9]/.test(v)) return false
  if (v.length < 6) return false // "евич"(4)/"овна"(4)/"ович"(4) fragments rejected; shortest real "Ильич"(5) handled via exception read below
  const suffixes = sex === 'F' ? FEMALE_SUFFIXES_RU : sex === 'M' ? MALE_SUFFIXES_RU : [...MALE_SUFFIXES_RU, ...FEMALE_SUFFIXES_RU]
  // Prefer the longest matching suffix so the root check is honest
  // (e.g. "инична" before "ична", "евич" before "ич").
  const matched = [...suffixes]
    .sort((a, b) => b.length - a.length)
    .find((suf) => v.endsWith(suf))
  if (!matched) return false
  const root = v.slice(0, v.length - matched.length)
  return root.length >= 2 // real root before the suffix (reject bare fragments)
}

/**
 * Derive the Russian отчество from a father's given name + sex using the
 * regular rules, falling back to EXCEPTIONS_RU. Returns null when the name
 * shape is not safely covered (caller must send to human review).
 */
export function generatePatronymicRu(givenName: string, sex: Sex): string | null {
  const name = norm(givenName).toLocaleLowerCase('ru')
  if (!name || name.length < 2) return null

  const ex = EXCEPTIONS_RU[name]
  if (ex) return ex[sex]

  const last = name[name.length - 1]

  // -й ending (Андрей, Алексей, Геннадий): drop -й, add -евич / -евна.
  if (last === 'й') {
    const stem = name.slice(0, -1)
    return titleCaseRu(stem + (sex === 'M' ? 'евич' : 'евна'))
  }

  // -ь ending (Игорь): drop -ь, add -евич / -евна.
  if (last === 'ь') {
    const stem = name.slice(0, -1)
    return titleCaseRu(stem + (sex === 'M' ? 'евич' : 'евна'))
  }

  // consonant ending (Иван, Александр, Владимир): +ович / +овна. Productive.
  const vowels = 'аеиоуыэюяёй'
  if (!vowels.includes(last)) {
    return titleCaseRu(name + (sex === 'M' ? 'ович' : 'овна'))
  }

  // -а / -я / other vowel endings not in EXCEPTIONS_RU: NOT safely derivable.
  return null
}

/**
 * Russian counterpart to reconcilePatronymic. Given the Reader's value
 * (possibly a fragment) plus the known given name + sex, return the canonical
 * отчество with a review flag.
 *
 * Priority:
 *   1. A read that is already complete & well-formed → keep it (doc is truth).
 *   2. Otherwise derive from given name + sex (regular or exception).
 *   3. Otherwise → empty + review_required (never guess).
 */
export function reconcilePatronymicRu(
  read: string | null | undefined,
  givenName: string | null | undefined,
  sex: Sex,
): { value: string; review_required: boolean } {
  const r = norm(read ?? '')
  if (r && isValidPatronymicRu(r, sex)) {
    return { value: titleCaseRu(r), review_required: false }
  }

  const gen = generatePatronymicRu(givenName ?? '', sex)
  if (gen) {
    // Generated from a (handwriting-derived) given name → keep a light review
    // flag, same posture as the Ukrainian engine's regular generations.
    return { value: gen, review_required: true }
  }

  return { value: '', review_required: true }
}

// ── SEX FROM PATRONYMIC (deterministic, FREE — derive sex when the doc omits it) ──────────────
//
// Real birth certs + military IDs often do not state «пол/стать» explicitly, yet the patronymic
// encodes it unambiguously: a male patronymic ends -ович/-евич/-ич (UA/RU), a female one ends
// -овна/-евна/-івна/-ївна/-ична/-инична (UA/RU). This recovers `sex` for $0 instead of a MISS — the
// cost-efficiency principle (do it deterministically, never spend an LLM call for what a suffix tells us).
// Female suffixes are checked FIRST (they are longer/more specific, so «-ична» wins over «-ич»).
const FEMALE_PATRONYMIC_SUFFIXES = [...FEMALE_SUFFIXES, ...FEMALE_SUFFIXES_RU] as const
const MALE_PATRONYMIC_SUFFIXES = [...MALE_SUFFIXES, ...MALE_SUFFIXES_RU] as const

/**
 * Derive Sex from a patronymic (по батькові / отчество). Returns 'M' | 'F', or null when the value
 * is not a recognizable patronymic (so the caller leaves sex for review — never guesses). Pure.
 */
export function sexFromPatronymic(patronymic: string | null | undefined): Sex | null {
  const v = (patronymic ?? '').toString().trim().toLowerCase().replace(/['’ʼ`]/g, '')
  if (v.length < 5) return null // too short to be a real patronymic suffix
  if (FEMALE_PATRONYMIC_SUFFIXES.some((s) => v.endsWith(s))) return 'F'
  if (MALE_PATRONYMIC_SUFFIXES.some((s) => v.endsWith(s))) return 'M'
  return null
}
