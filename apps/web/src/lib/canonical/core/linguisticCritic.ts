/**
 * linguisticCritic — the OWNER-DOCTRINE slot "Ukrainian linguistic critic" (2026-07-05),
 * implemented DETERMINISTIC-FIRST: the headline Ukrainian-document traps are dictionary
 * facts, not judgment calls, so no LLM is needed (or allowed) to flag them:
 *
 *   - language_variant_conflict: two reader candidates are the RU vs UA form of the same
 *     patronymic (Матвеевич vs Матвійович) — different WRITINGS, never silently merged.
 *   - script_mismatch: Latin lookalikes inside a Cyrillic candidate (І↔I, Е↔E, Р↔P...).
 *   - one_char_name_conflict: two plausible Cyrillic surname candidates differ by ~1 char
 *     (Кожемятник vs Кожематник) — cannot be auto-picked; review with both shown.
 *   - date_forms_agree: word-form date vs ISO date parse to the SAME instant — an
 *     agreement SIGNAL (handwritten stays review-gated regardless).
 *
 * SCOPE HONESTY (audit 2026-07-05): this is a NARROW deterministic rule-pack — an
 * extensible suffix/lookalike table, NOT a general linguistic model. Anything outside
 * the table falls through to the generic candidates_conflict. Asymmetric regimes
 * (one reader empty) are coverage facts classified by the ensemble differ, not here —
 * except the script trap, which critiqueSingle flags on lone candidates too.
 *
 * CONTRACT (owner law, typed in): the critic NEVER selects or rewrites a value —
 * `mayRewriteValue` is the literal type `false`. Output = signals/reasons for the
 * Decision Engine + prose hooks for the Review-Explainer. An optional LLM prose layer
 * (local Gemma / DeepSeek) may LATER wrap these signals — prose only, same contract.
 */
import { convertDateToUSCIS } from '@uscis-helper/knowledge'

/** RU↔UA patronymic suffix pairs (deterministic language-variant table). Both existing
 * validators are suffix-permissive (accept BOTH forms — probed 2026-07-05), so variant
 * detection must be its own rule: same root + paired suffixes = two WRITINGS of one name. */
const VARIANT_SUFFIX_PAIRS: ReadonlyArray<[ru: string, ua: string]> = [
  ['еевич', 'ійович'], ['еевич', 'ієвич'], ['евич', 'йович'], ['ьевич', 'ійович'],
  ['еевна', 'іївна'], ['евна', 'івна'], ['ьевна', 'іївна'], ['ович', 'ович'],
]

export interface LinguisticCandidate {
  field: string
  value: string | null
  source: string
}

export interface LinguisticCriticResult {
  field: string
  signal:
    | 'language_variant_conflict'
    | 'script_mismatch'
    | 'one_char_name_conflict'
    | 'date_forms_agree'
    | 'candidates_conflict'
  severity: 'info' | 'warning' | 'block'
  reviewReason: string
  /** owner law, enforced by the type system: the critic can never author a value */
  mayRewriteValue: false
}

const CYR = /[Ѐ-ӿ]/
const LATIN_LOOKALIKE = /[AaBCcEeHIiKMOoPpTXxYy]/
const fold = (s: string | null | undefined): string =>
  (s ?? '').toLowerCase().replace(/[^Ѐ-ӿa-z0-9']/gu, '')

function editDistance(a: string, b: string): number {
  let dp = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    let p = dp[0]; dp[0] = i
    for (let j = 1; j <= b.length; j++) {
      const c = dp[j]
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, p + (a[i - 1] !== b[j - 1] ? 1 : 0)); p = c
    }
  }
  return dp[b.length]
}

const res = (
  field: string,
  signal: LinguisticCriticResult['signal'],
  severity: LinguisticCriticResult['severity'],
  reviewReason: string,
): LinguisticCriticResult => ({ field, signal, severity, reviewReason, mayRewriteValue: false })

/** Script trap on a LONE candidate (Latin lookalikes inside Cyrillic) — the one linguistic
 * check that must not wait for a second reader. */
export function critiqueSingle(cand: LinguisticCandidate): LinguisticCriticResult[] {
  const v = (cand.value ?? '').trim()
  if (v && CYR.test(v) && LATIN_LOOKALIKE.test(v)) {
    return [res(cand.field, 'script_mismatch', 'block', 'critic:latin_in_cyrillic_candidate')]
  }
  return []
}

/**
 * Judge a PAIR of reader candidates for one field. Pure, deterministic, dictionary-backed.
 * Returns [] when there is nothing to flag (absence of a finding is never proof of truth).
 */
export function critiquePair(
  a: LinguisticCandidate,
  b: LinguisticCandidate,
  kind: 'name' | 'patronymic' | 'date' | 'text' = 'text',
): LinguisticCriticResult[] {
  const out: LinguisticCriticResult[] = []
  const av = (a.value ?? '').trim()
  const bv = (b.value ?? '').trim()
  if (!av || !bv) return out

  // script_mismatch — Latin lookalikes inside what should be a Cyrillic value
  for (const v of [av, bv]) {
    if (CYR.test(v) && LATIN_LOOKALIKE.test(v)) {
      out.push(res(a.field, 'script_mismatch', 'block', 'critic:latin_in_cyrillic_candidate'))
      break
    }
  }

  if (fold(av) === fold(bv)) return out // same read after folding — nothing linguistic to flag

  // date_forms_agree — word-form vs ISO parse to the same instant (agreement signal).
  // convertDateToUSCIS handles Cyrillic word-forms + dotted forms but NOT ISO (probed) —
  // fold ISO to MM/DD/YYYY ourselves before comparing.
  if (kind === 'date') {
    const toUscis = (v: string): string | null => {
      const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})$/)
      if (iso) return `${iso[2]}/${iso[3]}/${iso[1]}`
      return convertDateToUSCIS(v) || null
    }
    const da = toUscis(av)
    const db = toUscis(bv)
    if (da && db && da === db) {
      out.push(res(a.field, 'date_forms_agree', 'info', 'critic:date_forms_agree'))
      return out
    }
  }

  // language_variant_conflict — RU vs UA WRITING of the same patronymic (suffix-pair table;
  // the shared validators are suffix-permissive and cannot discriminate — probed).
  if (kind === 'patronymic') {
    const fa = fold(av), fb = fold(bv)
    for (const [ru, ua] of VARIANT_SUFFIX_PAIRS) {
      if (ru === ua) continue
      const pairs: Array<[string, string]> = [[ru, ua], [ua, ru]]
      for (const [sa, sb] of pairs) {
        if (fa.endsWith(sa) && fb.endsWith(sb)) {
          const rootA = fa.slice(0, -sa.length)
          const rootB = fb.slice(0, -sb.length)
          if (rootA && rootA === rootB) {
            out.push(res(a.field, 'language_variant_conflict', 'warning', 'critic:language_variant_conflict'))
            return out
          }
        }
      }
    }
  }

  // one_char_name_conflict — two plausible Cyrillic names a whisker apart: never auto-pick
  if ((kind === 'name' || kind === 'patronymic') && CYR.test(av) && CYR.test(bv)) {
    const d = editDistance(fold(av), fold(bv))
    if (d >= 1 && d <= 2) {
      out.push(res(a.field, 'one_char_name_conflict', 'warning', 'critic:one_char_name_conflict'))
      return out
    }
  }

  out.push(res(a.field, 'candidates_conflict', 'warning', 'critic:candidates_conflict'))
  return out
}
