/**
 * benchmark/runFixtureBenchmark — the L2 runner. Loads owner GT fixtures, runs each
 * document through an INJECTED predict function (the live readDocument pipeline at
 * runtime; a stub in tests), scores it, and produces a per-class verdict.
 *
 * The predict function is injected so the whole runner is unit-testable WITHOUT live
 * API keys or real documents. The real run wires predict = (the live pipeline on the
 * fixture's document image) and needs the owner's keys + docs.
 */
import { scoreFixture, type GroundTruthFixture } from './groundTruthFixture'
import { evaluateClassBenchmark, type ClassVerdict } from './classVerdict'
import type { ProducedField, BenchmarkScore } from '../benchmark'

/** Produce reader output for one fixture's document. Live: run the pipeline on its image. */
export type PredictFn = (fixture: GroundTruthFixture) => Promise<ProducedField[]> | ProducedField[]

export interface ClassBenchmarkReport extends ClassVerdict {
  /** per-document critical_wrong, for triage of which docs failed (PII-free: ids only) */
  perDoc: Array<{ docId: string; criticalWrong: number; criticalCorrect: number; criticalTotal: number }>
}

/** Run every fixture of one class through predict → score → class verdict. */
export async function runClassBenchmark(
  documentClass: string,
  fixtures: GroundTruthFixture[],
  predict: PredictFn,
  opts: { minN?: number } = {},
): Promise<ClassBenchmarkReport> {
  const scores: BenchmarkScore[] = []
  const perDoc: ClassBenchmarkReport['perDoc'] = []
  for (const f of fixtures) {
    const produced = await predict(f)
    const s = scoreFixture(f, produced)
    scores.push(s)
    perDoc.push({ docId: f.docId, criticalWrong: s.critical_wrong_count, criticalCorrect: s.critical_correct, criticalTotal: s.critical_total })
  }
  const verdict = evaluateClassBenchmark(documentClass, scores, opts)
  return { ...verdict, perDoc }
}

/** Group fixtures by documentClass and run each class. */
export async function runAllClasses(
  fixtures: GroundTruthFixture[],
  predict: PredictFn,
  opts: { minN?: number } = {},
): Promise<ClassBenchmarkReport[]> {
  const byClass = new Map<string, GroundTruthFixture[]>()
  for (const f of fixtures) {
    const arr = byClass.get(f.documentClass) ?? []
    arr.push(f)
    byClass.set(f.documentClass, arr)
  }
  const reports: ClassBenchmarkReport[] = []
  for (const [cls, fx] of byClass) reports.push(await runClassBenchmark(cls, fx, predict, opts))
  return reports
}

/** PII-free one-line summary per class (verdict + counts only, never values). */
export function summarizeReports(reports: ClassBenchmarkReport[]): string {
  return reports
    .map((r) => `${r.documentClass}: ${r.verdict} n=${r.n} acc=${r.accuracy == null ? 'n/a' : (r.accuracy * 100).toFixed(1) + '%'} critical_wrong=${r.criticalWrong} (threshold ${(r.threshold * 100).toFixed(0)}%)`)
    .join('\n')
}
