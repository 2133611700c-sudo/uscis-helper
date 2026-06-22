/**
 * autocorrect.ts — D2 CONSTRAINED-VOCABULARY auto-correction.
 *
 * GOAL: maximize automatic field-fill. For fields whose dictionary is a CLOSED
 * set (oblast = 24, sex, civil_status, country, month), the valid vocabulary is
 * KNOWN. A near-miss read is therefore very likely a misread OF a known value —
 * and because the set is closed, snapping it to the UNIQUE nearest entry is safe
 * auto-fill, not a guess into the open world.
 *
 * SAFETY (ADR-017 — "never SILENTLY overwrite a genuine conflict"):
 *   - Auto-correct ONLY when there is a SINGLE entry within a tight threshold.
 *   - If TWO+ entries are (near-)equally close → AMBIGUOUS → no correction
 *     (the caller keeps its suggest/review behaviour; we never pick a side).
 *   - Names (given/surname/patronymic stems) are OPEN vocabulary and are NEVER
 *     routed here.
 *
 * Pure: no I/O, no env, no flags. The flag (DICTIONARY_AUTOCORRECT_ENABLED) is
 * read by the caller (knowledgeNormalize). These functions just compute matches.
 *
 * Threshold rationale (TIGHT, see AUTOCORRECT_THRESHOLD):
 *   normalized distance = editDistance / max(len) ≤ 0.20, OR a single edit on a
 *   short (≤6 char) token. 0.20 ≈ one substitution in a 5-letter word
 *   ("Вінницка"→"Вінницька" is 1 insertion / 9 = 0.11; "чол"→"чоловіча" handled
 *   by the exact SEX_MAP, not here). This is HALF of the gazetteer's fuzzy
 *   *suggest* ratio (0.34) — auto-correct demands more confidence than a
 *   suggestion. The runner-up must be clearly worse (AMBIGUITY_MARGIN) or we
 *   refuse.
 */

import { confusionDistance } from './gazetteer'
import { OBLAST_GENITIVE_TO_NOMINATIVE, SEX_MAP, CIVIL_STATUS, COUNTRIES } from './dictionary'

/** Tight normalized-distance ceiling for a closed-set auto-correction. */
export const AUTOCORRECT_THRESHOLD = 0.20
/**
 * Oblast-specific (looser) ceiling. The oblast set is only 24 entries and the
 * names are long + highly distinctive, so the RIVAL margin (not the ratio) is the
 * real safety. A RU-spelled UA oblast ("Винницкой" → Вінницька) costs ~0.24
 * normalized — a genuine, unambiguous correction. 0.30 admits it; the rival-margin
 * guard still refuses any read that is near-equally close to a DIFFERENT oblast.
 */
export const OBLAST_AUTOCORRECT_THRESHOLD = 0.30
/** A short token (≤ this length) may auto-correct on a single edit even if the ratio exceeds the threshold. */
const SHORT_TOKEN_LEN = 6
/**
 * Minimum gap between the best and the SECOND-best candidate distance. If two
 * entries are within this margin the read is AMBIGUOUS → refuse (no silent pick).
 */
const AMBIGUITY_MARGIN = 1.0

export interface AutoCorrectMatch {
  /** The unique closed-set entry the read snaps to (the KEY/canonical Cyrillic form). */
  value: string
  /** Raw weighted edit distance to that entry (0 = exact). */
  distance: number
  /** Normalized distance = distance / max(len). */
  normalized: number
  /** True only when a SINGLE entry is within threshold AND clearly beats the runner-up. */
  unique: boolean
  reason: 'exact' | 'unique_autocorrect' | 'ambiguous' | 'no_match'
}

function lower(s: string): string {
  return (s ?? '').trim().toLocaleLowerCase('uk')
}

/**
 * Core closed-set matcher. Given a read and a list of candidate keys (lowercase),
 * find the nearest by confusion-weighted edit distance and decide if it is a
 * UNIQUE high-confidence correction.
 *
 * `resolve` maps a key → its OUTPUT value. Ambiguity is judged on OUTPUTS, not
 * keys: if the runner-up is near-equally close BUT resolves to the SAME output as
 * the winner (e.g. "чоловіча"/"чоловік" both → Male, "росія"/"россия" both →
 * Russia), it is NOT a genuine conflict — we still auto-correct. Only a near-equal
 * entry that resolves to a DIFFERENT output makes the read ambiguous (no silent pick).
 */
function matchClosedSet(
  read: string,
  keys: string[],
  resolve: (key: string) => string,
  threshold: number = AUTOCORRECT_THRESHOLD,
): AutoCorrectMatch {
  const r = lower(read)
  if (!r) return { value: '', distance: Infinity, normalized: Infinity, unique: false, reason: 'no_match' }

  // Exact membership short-circuit.
  const exactIdx = keys.indexOf(r)
  if (exactIdx >= 0) {
    return { value: keys[exactIdx], distance: 0, normalized: 0, unique: true, reason: 'exact' }
  }

  let best = Infinity
  let bestIdx = -1
  // Best distance among entries whose output DIFFERS from the winner's (genuine rival).
  let rivalBest = Infinity
  const dists: number[] = new Array(keys.length)
  for (let i = 0; i < keys.length; i++) {
    const d = confusionDistance(r, keys[i])
    dists[i] = d
    if (d < best) { best = d; bestIdx = i }
  }
  if (bestIdx < 0) return { value: '', distance: Infinity, normalized: Infinity, unique: false, reason: 'no_match' }

  const winnerOut = resolve(keys[bestIdx])
  for (let i = 0; i < keys.length; i++) {
    if (i === bestIdx) continue
    if (resolve(keys[i]) === winnerOut) continue // same output → not a rival
    if (dists[i] < rivalBest) rivalBest = dists[i]
  }

  const norm = best / Math.max(r.length, keys[bestIdx].length || 1)
  const withinThreshold = norm <= threshold || (best <= 1 && r.length <= SHORT_TOKEN_LEN)
  if (!withinThreshold) {
    return { value: keys[bestIdx], distance: best, normalized: norm, unique: false, reason: 'no_match' }
  }
  // Ambiguity guard: a GENUINE rival (different output) within the margin ⇒ refuse.
  const ambiguous = rivalBest - best < AMBIGUITY_MARGIN
  if (ambiguous) {
    return { value: keys[bestIdx], distance: best, normalized: norm, unique: false, reason: 'ambiguous' }
  }
  return { value: keys[bestIdx], distance: best, normalized: norm, unique: true, reason: 'unique_autocorrect' }
}

/**
 * OBLAST (closed set of 24 + Kyiv-city handled elsewhere). Returns the matched
 * NOMINATIVE-form Cyrillic key (e.g. "вінницька") on a unique near-miss. The
 * caller routes that through normalizeOblastToNominative for the DMS English.
 *
 * We build the key list from BOTH the genitive map keys and their nominative
 * forms so a garbled genitive ("вінницкої") and a garbled nominative
 * ("вінницка") both snap. The returned `value` is always a canonical genitive
 * key (a valid input to normalizeOblastToNominative).
 */
const OBLAST_KEYS: Array<{ match: string; canonical: string }> = (() => {
  const out: Array<{ match: string; canonical: string }> = []
  for (const genitive of Object.keys(OBLAST_GENITIVE_TO_NOMINATIVE)) {
    out.push({ match: genitive, canonical: genitive })
    // nominative form: -ської → -ська (вінницької → вінницька)
    const nom = genitive.replace(/(сь|ць)?к(ої|ій|ою|у|а)$/u, (m) =>
      m.startsWith('сь') ? 'ська' : m.startsWith('ць') ? 'цька' : 'ка',
    )
    if (nom !== genitive) out.push({ match: nom, canonical: genitive })
  }
  return out
})()

export function autoCorrectOblast(read: string): AutoCorrectMatch & { canonical?: string } {
  // Strip a trailing "область / обл." (UA + RU forms: область/області/области/
  // областей/обл.) so we match the bare adjective.
  const bare = lower(read).replace(/\s*(област[ьіи]|областей|обл\.?)\s*/giu, '').trim()
  const keys = OBLAST_KEYS.map((k) => k.match)
  // Resolve a key to its canonical genitive so the two spellings of one oblast
  // (genitive + nominative; UA + RU) count as the SAME output, not rivals.
  const resolve = (key: string): string => OBLAST_KEYS.find((x) => x.match === key)?.canonical ?? key
  const m = matchClosedSet(bare, keys, resolve, OBLAST_AUTOCORRECT_THRESHOLD)
  if (m.unique) {
    const found = OBLAST_KEYS.find((k) => k.match === m.value)
    return { ...m, value: found?.canonical ?? m.value, canonical: found?.canonical ?? m.value }
  }
  return m
}

/** SEX — closed set via SEX_MAP keys (returns the English "Male"/"Female"). */
export function autoCorrectSex(read: string): AutoCorrectMatch {
  const lkeys = Object.keys(SEX_MAP).map((k) => k.toLocaleLowerCase('uk'))
  const resolveSex = (lk: string): string => {
    const orig = Object.keys(SEX_MAP).find((k) => k.toLocaleLowerCase('uk') === lk)
    return orig ? SEX_MAP[orig] : lk
  }
  const m = matchClosedSet(read, lkeys, resolveSex)
  if (m.reason === 'exact' || m.unique) {
    return { ...m, value: resolveSex(m.value) }
  }
  return m
}

/** CIVIL STATUS — closed set via CIVIL_STATUS keys (returns the English rendering). */
export function autoCorrectCivilStatus(read: string): AutoCorrectMatch {
  const lkeys = Object.keys(CIVIL_STATUS).map((k) => k.toLocaleLowerCase('uk'))
  const resolveCs = (lk: string): string => {
    const orig = Object.keys(CIVIL_STATUS).find((k) => k.toLocaleLowerCase('uk') === lk)
    return orig ? CIVIL_STATUS[orig] : lk
  }
  const m = matchClosedSet(read, lkeys, resolveCs)
  if (m.reason === 'exact' || m.unique) {
    return { ...m, value: resolveCs(m.value) }
  }
  return m
}

/** COUNTRY — closed set via COUNTRIES keys (returns the English country name). */
export function autoCorrectCountry(read: string): AutoCorrectMatch {
  const lkeys = Object.keys(COUNTRIES).map((k) => k.toLocaleLowerCase('uk'))
  const resolveCo = (lk: string): string => {
    const orig = Object.keys(COUNTRIES).find((k) => k.toLocaleLowerCase('uk') === lk)
    return orig ? COUNTRIES[orig] : lk
  }
  const m = matchClosedSet(read, lkeys, resolveCo)
  if (m.reason === 'exact' || m.unique) {
    return { ...m, value: resolveCo(m.value) }
  }
  return m
}

/**
 * DATE PLAUSIBILITY — given a parsed day/month, return the UNIQUE valid
 * reinterpretation if exactly one exists, else null (review). Does NOT invent
 * missing digits; only re-reads digits already present.
 *
 * Cases handled:
 *   - month > 12 but day ≤ 12  → swap (the fields were transposed).
 *   - month > 12 AND day > 12  → impossible, no valid reinterpretation → null.
 *   - both ≤ 12 → AMBIGUOUS which is day vs month → null (do not pick).
 *   - in-range, normal → returned unchanged (caller handles).
 */
export interface DateParts { day: number; month: number; year: number }

export function autoCorrectDateParts(p: DateParts): { day: number; month: number; year: number; corrected: boolean } | null {
  const { day, month, year } = p
  if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) return null
  const dayOk = day >= 1 && day <= 31
  const monthOk = month >= 1 && month <= 12

  if (dayOk && monthOk) {
    // Already plausible as-is — not our job to second-guess a valid date.
    return { day, month, year, corrected: false }
  }
  // month out of range, day could BE the month (transposition) → unique swap.
  if (!monthOk && month >= 1 && month <= 31 && dayOk && day <= 12) {
    return { day: month, month: day, year, corrected: true }
  }
  // No single valid reinterpretation (both > 12, or zero/garbage) → review.
  return null
}
