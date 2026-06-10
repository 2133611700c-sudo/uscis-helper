/**
 * benchmark/classVerdict — L2 class-level verdict over N per-document BenchmarkScores.
 * The per-doc scoring already exists (scoreAgainstTruth → BenchmarkScore); this is the
 * missing aggregation that turns N docs into a rollout DECISION:
 *
 *   N < 30                          → INSUFFICIENT_N  (never PASS — a number, not a guess)
 *   any critical field wrong (≥1)   → FAIL            (silent wrong-critical = 0 tolerance)
 *   per-critical-field accuracy ≥ T → PASS  else FAIL (T = LOCKED per-class threshold)
 *
 * Thresholds are LOCKED in docs/architecture/GT_BENCHMARK_EXIT_CRITERIA.md (owner may
 * tighten, never invented here). Pure + deterministic (now injected) → fully testable.
 */
import type { BenchmarkScore } from '../benchmark'

export type BenchmarkVerdict = 'PASS' | 'FAIL' | 'INSUFFICIENT_N'

/** Tier-1 minimum sample size for a rollout decision (EXIT_CRITERIA). */
export const MIN_DECISION_N = 30

/**
 * LOCKED per-class min per-critical-field accuracy (GT_BENCHMARK_EXIT_CRITERIA v1).
 * Keyed by canonical document_class (documentClassPolicy). Unmapped → strict default.
 */
export const CLASS_THRESHOLDS: Record<string, number> = {
  internal_passport_booklet: 0.99, // controlling Latin (MRZ) must win
  military_id: 0.98,
  birth_certificate_handwritten: 0.97, // OR every uncertain field review_required
  birth_certificate_soviet_bilingual: 0.97, // zero forced rewrite of as-written names
  marriage_apostille: 0.97,
  unknown_document: 0.99, // strict: an unknown class must clear the highest bar
}
const DEFAULT_THRESHOLD = 0.99 // never under-set an unmapped class

export function thresholdForClass(documentClass: string): number {
  return CLASS_THRESHOLDS[documentClass] ?? DEFAULT_THRESHOLD
}

export interface ClassVerdict {
  documentClass: string
  verdict: BenchmarkVerdict
  n: number
  /** sum(critical_correct) / sum(critical_total); null when no critical fields scored */
  accuracy: number | null
  criticalWrong: number
  threshold: number
  reasons: string[]
}

/**
 * Aggregate per-document scores into a class verdict. `scores` = one BenchmarkScore per
 * ground-truth document of this class.
 */
export function evaluateClassBenchmark(
  documentClass: string,
  scores: BenchmarkScore[],
  opts: { minN?: number } = {},
): ClassVerdict {
  const minN = opts.minN ?? MIN_DECISION_N
  const threshold = thresholdForClass(documentClass)
  const n = scores.length
  const reasons: string[] = []

  const criticalWrong = scores.reduce((a, s) => a + s.critical_wrong_count, 0)
  const criticalCorrect = scores.reduce((a, s) => a + s.critical_correct, 0)
  const criticalTotal = scores.reduce((a, s) => a + s.critical_total, 0)
  const accuracy = criticalTotal > 0 ? criticalCorrect / criticalTotal : null

  // N gate FIRST — an underpowered sample can never PASS (or FAIL); it is undecidable.
  if (n < minN) {
    reasons.push(`n_${n}_below_${minN}`)
    return { documentClass, verdict: 'INSUFFICIENT_N', n, accuracy, criticalWrong, threshold, reasons }
  }
  // Zero-tolerance: ANY silently-wrong critical field fails the class regardless of accuracy.
  if (criticalWrong > 0) {
    reasons.push(`silent_wrong_critical_${criticalWrong}`)
    return { documentClass, verdict: 'FAIL', n, accuracy, criticalWrong, threshold, reasons }
  }
  if (accuracy === null) {
    reasons.push('no_critical_fields_scored')
    return { documentClass, verdict: 'FAIL', n, accuracy, criticalWrong, threshold, reasons }
  }
  if (accuracy + 1e-9 >= threshold) {
    return { documentClass, verdict: 'PASS', n, accuracy, criticalWrong, threshold, reasons }
  }
  reasons.push(`accuracy_${accuracy.toFixed(4)}_below_${threshold}`)
  return { documentClass, verdict: 'FAIL', n, accuracy, criticalWrong, threshold, reasons }
}

// ── Canary-permission gate: deploy requires a FRESH PASS ──────────────────────
export const CANARY_MAX_PASS_AGE_DAYS = 7

/**
 * Whether a canary/prod rollout is permitted: there must be a PASS verdict no older than
 * maxAgeDays. `lastPassAtMs` = timestamp of the latest PASS (null ⇒ never passed ⇒ blocked).
 * Pure — `nowMs` injected.
 */
export function canaryDeployAllowed(
  lastPassAtMs: number | null,
  nowMs: number,
  maxAgeDays: number = CANARY_MAX_PASS_AGE_DAYS,
): boolean {
  if (lastPassAtMs == null) return false
  const ageDays = (nowMs - lastPassAtMs) / (24 * 60 * 60 * 1000)
  return ageDays >= 0 && ageDays <= maxAgeDays
}
