/**
 * cyrillicAcceptanceTaxonomy — pure error-taxonomy classifier for One-Brain Step I.
 *
 * WHY THIS EXISTS: cyrillicAcceptanceMetrics scores HOW MUCH we got right
 * (EXACT/WRONG/EMPTY/FABRICATED). It does NOT say WHY a non-exact field failed.
 * Without a "why" axis you cannot tell an OCR near-miss (1 char) from a swapped
 * field, a UA/RU letter confusion, a fabricated value, or a transliteration error —
 * and so you cannot prioritise fixes. This module classifies a single field's
 * (got, truth) into ONE deterministic taxonomy code.
 *
 * PII-FREE BY CONSTRUCTION: the ONLY thing this module emits is the CODE
 * (a TaxonomyCode string). It NEVER returns, logs, or stores any field value.
 * It is ADDITIVE and pure — no I/O, no mutation, no dependency on the metrics module.
 *
 * Style matches cyrillicAcceptanceMetrics.ts (levenshtein, characterErrorRate, norm).
 */

export type TaxonomyCode =
  | 'OCR_NEAR'        // same script, CER ≤ 0.15 — a near-miss OCR error
  | 'HOMOGLYPH'       // cyrillic↔latin look-alike letters (а/o, е/e, р/p, …)
  | 'UA_RU_CONFUSION' // UA↔RU letter swaps (і↔и, ї↔й, є↔е, ґ↔г) or ё/э/ы leaking
  | 'WRONG_FIELD'     // the value belongs to a DIFFERENT field key
  | 'MERGED'          // two+ tokens collapsed into one (token-count too low)
  | 'SPLIT'           // one token broken into many (token-count too high)
  | 'NORMALIZATION'   // case/space/diacritic-only difference (semantically equal)
  | 'TRANSLIT'        // latin produced where cyrillic truth expected (or vice-versa)
  | 'PATRONYMIC'      // patronymic field with a suffix mismatch (-ович/-овна …)
  | 'GEOGRAPHY'       // place / oblast / settlement field error
  | 'AUTHORITY'       // issuing-authority field error
  | 'DATE'            // date field with digit edits
  | 'DOCNUM'          // document-number / series field error
  | 'FABRICATION'     // truth empty but we emitted a value (invented)
  | 'MISSING'         // truth present but we emitted nothing (empty read)
  | 'WRONG_EVIDENCE'  // value sourced from the wrong supporting evidence/region
  | 'QUALITY'         // unreadable-image-class garbage (very high CER, no structure)
  | 'TEMPLATE'        // boilerplate/template text returned instead of the value
  | 'PROVIDER'        // provider sentinel (refusal / error marker) returned
  | 'OCR_OTHER'       // a real OCR error not captured by the above

export interface ClassifyErrorInput {
  fieldKey: string
  fieldKind?: string
  got: string | null
  truth: string | null
  rawCyrillic?: string | null
  /** Other fields' truth values, keyed by their field key (for WRONG_FIELD detection). */
  otherFieldValues?: Record<string, string>
}

/** Field-kind / key heuristics — mirror the metrics module's key regexes. */
const DATE_KEY = /date|dob|born|issue|expiry|expir/i
const DOCNUM_KEY = /num|number|series|serial|record|act|registration|reg_no/i
const PATRONYMIC_KEY = /patronymic/i
const PLACE_KEY = /place|city|town|village|settlement|oblast|raion|district|region|birthplace|locality/i
const AUTHORITY_KEY = /authority|issuer|issued_by|department|office|registry|registr|органом?/i
const NAME_KEY = /name|surname|given|family|spouse|father|mother|child|deceased/i

/** UA-distinct letters vs their RU counterparts (and RU-only letters). */
const UA_RU_PAIRS: ReadonlyArray<[string, string]> = [
  ['і', 'и'], ['ї', 'й'], ['є', 'е'], ['ґ', 'г'],
]
const RU_ONLY = /[ёэыъ]/i
const UA_ONLY = /[іїєґ]/i

/** Cyrillic↔Latin homoglyph classes. */
const HOMOGLYPH_PAIRS: ReadonlyArray<[string, string]> = [
  ['а', 'a'], ['о', 'o'], ['е', 'e'], ['р', 'p'], ['с', 'c'], ['х', 'x'], ['і', 'i'],
]

const CYRILLIC = /[Ѐ-ӿ]/
const LATIN = /[A-Za-z]/

/** Provider sentinels / refusal markers a reader might leak as a "value". */
const PROVIDER_SENTINEL = /^(null|n\/a|na|none|error|unavailable|refus|cannot|i'?m sorry|unable|\[.*\])$/i
/** Template/boilerplate placeholders. */
const TEMPLATE_MARKER = /(lorem ipsum|xxx+|placeholder|sample|example|<.*>|\{\{.*\}\}|фамилия|прізвище|surname here)/i

function norm(s: string | null | undefined): string {
  return (s ?? '').normalize('NFC').replace(/\s+/g, '').toLocaleLowerCase()
}

/** NFD then strip combining marks — for diacritic-only comparisons. */
function stripDiacritics(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function tokens(s: string): string[] {
  return s.trim().split(/\s+/).filter(Boolean)
}

/** Levenshtein distance — identical to cyrillicAcceptanceMetrics for consistency. */
export function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  if (m === 0) return n
  if (n === 0) return m
  let prev = Array.from({ length: n + 1 }, (_, i) => i)
  let cur = new Array(n + 1).fill(0)
  for (let i = 1; i <= m; i++) {
    cur[0] = i
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost)
    }
    ;[prev, cur] = [cur, prev]
  }
  return prev[n]
}

/** CER = edit distance / max(len). 0 = perfect, 1 = fully wrong. */
export function characterErrorRate(got: string, truth: string): number {
  const g = got.normalize('NFC'), t = truth.normalize('NFC')
  const denom = Math.max(g.length, t.length)
  return denom === 0 ? 0 : levenshtein(g, t) / denom
}

function scriptOf(s: string): 'cyrillic' | 'latin' | 'mixed' | 'other' {
  const c = CYRILLIC.test(s), l = LATIN.test(s)
  if (c && l) return 'mixed'
  if (c) return 'cyrillic'
  if (l) return 'latin'
  return 'other'
}

/** True if the ONLY differences between got and truth are UA↔RU letter swaps. */
function isUaRuConfusion(got: string, truth: string): boolean {
  // RU-only letters where the truth is UA (or vice-versa) is a strong signal.
  if ((RU_ONLY.test(got) && UA_ONLY.test(truth)) || (RU_ONLY.test(truth) && UA_ONLY.test(got))) {
    return true
  }
  // Fold the UA/RU pairs in BOTH strings to a canonical char; if they then match,
  // every difference was a UA↔RU swap.
  const fold = (s: string): string => {
    let out = s.normalize('NFC').toLocaleLowerCase()
    for (const [ua, ru] of UA_RU_PAIRS) {
      out = out.split(ua).join(ru) // map UA letter → RU letter
    }
    // RU-only letters that pair to UA equivalents phonetically
    out = out.split('ё').join('е').split('э').join('е').split('ы').join('и').split('ъ').join('')
    return out
  }
  const g = fold(got), t = fold(truth)
  if (g !== t) return false
  // Require that an actual UA/RU letter was involved (else it's just NORMALIZATION).
  return UA_ONLY.test(got) || UA_ONLY.test(truth) || RU_ONLY.test(got) || RU_ONLY.test(truth)
}

/** True if differences are explainable as cyrillic↔latin homoglyph substitutions. */
function isHomoglyph(got: string, truth: string): boolean {
  if (got.length !== truth.length) return false
  const g = got.normalize('NFC').toLocaleLowerCase()
  const t = truth.normalize('NFC').toLocaleLowerCase()
  let sawHomoglyphSwap = false
  for (let i = 0; i < g.length; i++) {
    if (g[i] === t[i]) continue
    const pair = HOMOGLYPH_PAIRS.find(
      ([cy, la]) => (g[i] === cy && t[i] === la) || (g[i] === la && t[i] === cy),
    )
    if (!pair) return false // a non-homoglyph difference disqualifies
    sawHomoglyphSwap = true
  }
  return sawHomoglyphSwap
}

/** True if got matches a DIFFERENT field's truth strictly better than its own truth. */
function landedInWrongField(
  got: string, ownTruth: string | null, others: Record<string, string> | undefined,
): boolean {
  if (!others) return false
  const ownCer = ownTruth ? characterErrorRate(norm(got), norm(ownTruth)) : 1
  if (ownCer === 0) return false // it actually matches its own truth — not misplaced
  for (const other of Object.values(others)) {
    if (!other || !other.trim()) continue
    if (norm(got) === norm(other) && ownCer > 0) return true
    const otherCer = characterErrorRate(norm(got), norm(other))
    if (otherCer < ownCer && otherCer <= 0.15) return true
  }
  return false
}

/**
 * Classify ONE field's error into a single TaxonomyCode. Deterministic and PII-free:
 * only the CODE is ever returned — never a value. Precedence is intentional
 * (structural/absence cases first, then linguistic, then key-domain, then generic).
 */
export function classifyError(input: ClassifyErrorInput): TaxonomyCode {
  const { fieldKey, got, truth, otherFieldValues } = input
  const gotVal = got != null && got.trim() !== '' ? got : null
  const truthVal = truth != null && truth.trim() !== '' ? truth : null

  // 1. Absence axis — fabrication / missing take precedence over everything.
  if (!truthVal && gotVal) return 'FABRICATION'
  if (truthVal && !gotVal) return 'MISSING'
  if (!truthVal && !gotVal) return 'OCR_OTHER' // nothing to compare — neutral bucket

  // From here both are non-null. Exact match is not an error → caller should not
  // call us, but classify it as the most benign near bucket if they do.
  const g = gotVal as string
  const t = truthVal as string
  if (norm(g) === norm(t)) return 'OCR_NEAR'

  // 2. Provider sentinels / template boilerplate masquerading as a value.
  if (PROVIDER_SENTINEL.test(g.trim())) return 'PROVIDER'
  if (TEMPLATE_MARKER.test(g)) return 'TEMPLATE'

  // 3. Wrong field — the value belongs to a different key.
  if (landedInWrongField(g, t, otherFieldValues)) return 'WRONG_FIELD'

  // 4. Normalization — equal once case/space/diacritics are folded.
  if (norm(stripDiacritics(g)) === norm(stripDiacritics(t))) return 'NORMALIZATION'

  // 5. UA↔RU confusion (check before homoglyph: і appears in both pair sets).
  if (isUaRuConfusion(g, t)) return 'UA_RU_CONFUSION'

  // 6. Cyrillic↔Latin homoglyph classes.
  if (isHomoglyph(g, t)) return 'HOMOGLYPH'

  // 7. Cross-script transliteration (latin where cyrillic expected, or vice-versa).
  const sg = scriptOf(g), st = scriptOf(t)
  if ((sg === 'latin' && st === 'cyrillic') || (sg === 'cyrillic' && st === 'latin')) {
    return 'TRANSLIT'
  }

  // 8. Key-domain specific errors.
  if (PATRONYMIC_KEY.test(fieldKey)) {
    // Suffix mismatch on a patronymic (e.g. -ович vs -евич, -овна vs -ївна).
    const gt = g.toLocaleLowerCase(), tt = t.toLocaleLowerCase()
    const gSuf = gt.slice(-4), tSuf = tt.slice(-4)
    if (gSuf !== tSuf) return 'PATRONYMIC'
  }
  if (DATE_KEY.test(fieldKey) && /\d/.test(g) && /\d/.test(t)) return 'DATE'
  if (DOCNUM_KEY.test(fieldKey)) return 'DOCNUM'
  if (PLACE_KEY.test(fieldKey)) return 'GEOGRAPHY'
  if (AUTHORITY_KEY.test(fieldKey)) return 'AUTHORITY'

  // 9. Token-count delta — merged vs split.
  const gTok = tokens(g).length, tTok = tokens(t).length
  if (gTok < tTok) return 'MERGED'
  if (gTok > tTok) return 'SPLIT'

  // 10. CER-based: near-miss vs quality-garbage (same script only).
  const cer = characterErrorRate(g, t)
  const sameScript = sg === st && sg !== 'mixed'
  if (sameScript && cer <= 0.15) return 'OCR_NEAR'
  if (cer >= 0.8) return 'QUALITY'

  // 11. Fallback — a real OCR error not otherwise captured.
  return 'OCR_OTHER'
}
