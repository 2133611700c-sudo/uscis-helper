/**
 * handwritingEnsembleShadow — WEEK-PLAN #3, shadow form. MEASURED BASIS (2026-07-05,
 * three-signature law): the two handwriting readers are COMPLEMENTARY BY HAND —
 * hand B (military, UA cursive): full-page LLM EXACT ×6 runs while HTR crops 0/3;
 * hand A (birth cert): HTR crops 9/9 EXACT while the full-page LLM is weak. So neither
 * reader may replace the other; the target architecture is BOTH as candidates in the one
 * arbitration. This differ produces the flip evidence for that target with ZERO extra
 * paid calls: it compares the observations that runHtrFieldStage already holds
 * (full-page LLM fields vs HTR crop reads) and logs a keys-only marker.
 *
 * SHADOW CONTRACT: strict HANDWRITING_ENSEMBLE_SHADOW==='1'; no behavior change; the
 * fail-closed HTR merge stays exactly as it is. PII-free by construction (keys/counts).
 */

export interface EnsembleLlmSide {
  field: string
  raw_cyrillic?: string | null
  value?: string | null
}
export interface EnsembleHtrSide {
  field: string
  text: string
  confidence: number
}

export interface HandwritingEnsembleDiff {
  fields_compared: number
  agree_exact: string[]
  /** same letters after folding (case/punct) — likely the same read */
  agree_fold: string[]
  disagree: string[]
  llm_only: string[]
  htr_only: string[]
  both_empty: string[]
}

export function isHandwritingEnsembleShadowEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.HANDWRITING_ENSEMBLE_SHADOW === '1'
}

const fold = (s: string | null | undefined): string =>
  (s ?? '').toLowerCase().replace(/[^а-яёіїєґa-z0-9']/gu, '')

/** Pure keys-only differ over the two readers' observations for the given name fields. */
export function diffHandwritingReaders(
  llmFields: EnsembleLlmSide[],
  htrReads: EnsembleHtrSide[],
  nameFields: ReadonlySet<string>,
): HandwritingEnsembleDiff {
  const llmByKey = new Map(llmFields.filter((f) => nameFields.has(f.field)).map((f) => [f.field, f]))
  const htrByKey = new Map(htrReads.filter((h) => nameFields.has(h.field)).map((h) => [h.field, h]))
  const keys = new Set<string>([...llmByKey.keys(), ...htrByKey.keys()])
  const d: HandwritingEnsembleDiff = {
    fields_compared: 0, agree_exact: [], agree_fold: [], disagree: [], llm_only: [], htr_only: [], both_empty: [],
  }
  for (const key of keys) {
    d.fields_compared++
    const llmRaw = llmByKey.get(key)?.raw_cyrillic ?? llmByKey.get(key)?.value ?? ''
    const htrRaw = htrByKey.get(key)?.text ?? ''
    const l = fold(llmRaw), h = fold(htrRaw)
    if (!l && !h) d.both_empty.push(key)
    else if (l && !h) d.llm_only.push(key)
    else if (!l && h) d.htr_only.push(key)
    else if ((llmRaw ?? '').trim() === htrRaw.trim()) d.agree_exact.push(key)
    else if (l === h) d.agree_fold.push(key)
    else d.disagree.push(key)
  }
  return d
}
