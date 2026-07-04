/**
 * postExtractRulePack — ONE-BRAIN v2 PHASE 8 (normalization collapse), step 1 of 2.
 *
 * Target state (plan): TPS postExtractNormalize stops being an in-place WRITER and becomes
 * a rule-pack the KnowledgeEvaluator evaluates — SIGNALS into the Decision Engine, with the
 * engine/C3 as the only writers.
 *
 * This module is the EXTRACT-NOT-REBUILD form of that step: the rule-pack's implementation
 * IS the existing postExtractNormalize (zero logic drift by construction) — but run on a
 * DEEP CLONE, so the caller's fields are never mutated. The output is a per-field SIGNAL:
 *   suggestedValue  — what the rules would normalize the value to (null on reject)
 *   reject          — the rules would null the value + force review
 *   reviewRequired  — monotonic-up review signal
 * runNormalizeCollapseShadow() then diffs these signals against what the LIVE in-place
 * writer actually did — the keys-only [normalize_collapse_shadow] evidence that the flip
 * (route reads signals, engine writes) changes nothing. Flip itself is owner-gated.
 */
import type { TpsExtractedField } from '@/lib/tps/types'
import { postExtractNormalize } from './postExtractNormalize'

export interface PostExtractSignal {
  field: string
  status: 'normalized' | 'rejected' | 'passed'
  reason: string
  suggestedValue: string | null
  reviewRequired: boolean
}

/** Signal-only evaluation: NEVER mutates the input fields (deep-cloned before the run). */
export function evaluatePostExtractPack(fields: TpsExtractedField[]): PostExtractSignal[] {
  const clone = fields.map((f) => ({
    ...f,
    passes: [...f.passes],
    failures: [...f.failures],
  })) as TpsExtractedField[]
  const res = postExtractNormalize(clone)
  return res.diagnostics.map((d) => ({
    field: d.field,
    status: d.status,
    reason: d.reason,
    suggestedValue: d.output_normalized,
    reviewRequired: d.manual_required,
  }))
}

export interface NormalizeCollapseDiff {
  fields: number
  signals: number
  /** keys where the signal's suggestedValue ≠ the live writer's normalized_value */
  value_diff_keys: string[]
  /** keys the signal rejects but the live writer released (or vice versa) */
  reject_diff_keys: string[]
  match: boolean
}

export function isNormalizeCollapseShadowEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.NORMALIZE_COLLAPSE_SHADOW === '1'
}

/**
 * SHADOW differ: signals (computed on the PRE-normalization clone) vs the fields AFTER the
 * live in-place writer ran. Keys-only (PII-free). Zero diff on every doc = the rule-pack is
 * the live logic — the flip evidence.
 */
export function runNormalizeCollapseShadow(
  signals: PostExtractSignal[],
  liveFieldsAfter: TpsExtractedField[],
  liveRejected: string[],
): NormalizeCollapseDiff {
  const liveByKey = new Map(liveFieldsAfter.map((f) => [f.field, f]))
  const liveRejectedSet = new Set(liveRejected)
  const valueDiff: string[] = []
  const rejectDiff: string[] = []
  for (const s of signals) {
    const live = liveByKey.get(s.field)
    const signalRejects = s.status === 'rejected'
    const liveRejects = liveRejectedSet.has(s.field)
    if (signalRejects !== liveRejects) {
      rejectDiff.push(s.field)
      continue
    }
    if (signalRejects) continue // both reject — value comparison is moot (both null)
    const liveValue = live?.normalized_value ?? null
    if ((s.suggestedValue ?? null) !== liveValue) valueDiff.push(s.field)
  }
  return {
    fields: liveFieldsAfter.length,
    signals: signals.length,
    value_diff_keys: valueDiff,
    reject_diff_keys: rejectDiff,
    match: valueDiff.length === 0 && rejectDiff.length === 0,
  }
}
