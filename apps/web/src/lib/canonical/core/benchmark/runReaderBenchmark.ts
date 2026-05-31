/**
 * benchmark/runReaderBenchmark.ts — score every reader against ONE hand-filled
 * ground truth and produce a side-by-side comparison.
 *
 * Pure: it scores PROVIDED reader outputs. Producing those outputs on a real
 * document (the live Gemini/MRZ/TPS calls) is a separate step that needs a real
 * document + keys — this is the eval instrument, ready for that moment.
 */
import { scoreAgainstTruth, type BenchmarkScore } from '../benchmark'
import { passportTruthToGroundTruth, type FlatPassportTruth } from './passportTruth'
import { mapMrz, mapTranslation, mapTps, mapCore, type DocintelField } from './mappers'
import type { Td3ParseResult } from '@/lib/translation/identity/mrzParser'
import type { TpsExtractedField } from '@/lib/tps/types'
import type { CanonicalField } from '../../types'

export type ReaderName = 'mrz' | 'translation' | 'tps' | 'core'

export interface ReaderOutputs {
  mrz?: Td3ParseResult
  translation?: DocintelField[]
  tps?: TpsExtractedField[]
  core?: CanonicalField[]
}

export interface ReaderBenchmarkReport {
  document_id: string
  rows: Array<{ reader: ReaderName; score: BenchmarkScore }>
  /** The locked metric, per reader. Goal: Core == 0. */
  critical_wrong: Record<string, number>
  coverage: Record<string, number>
}

export function runReaderBenchmark(outputs: ReaderOutputs, flatTruth: FlatPassportTruth): ReaderBenchmarkReport {
  const truth = passportTruthToGroundTruth(flatTruth)
  const rows: ReaderBenchmarkReport['rows'] = []
  if (outputs.mrz) rows.push({ reader: 'mrz', score: scoreAgainstTruth(mapMrz(outputs.mrz), truth) })
  if (outputs.translation) rows.push({ reader: 'translation', score: scoreAgainstTruth(mapTranslation(outputs.translation), truth) })
  if (outputs.tps) rows.push({ reader: 'tps', score: scoreAgainstTruth(mapTps(outputs.tps), truth) })
  if (outputs.core) rows.push({ reader: 'core', score: scoreAgainstTruth(mapCore(outputs.core), truth) })

  return {
    document_id: truth.document_id,
    rows,
    critical_wrong: Object.fromEntries(rows.map((r) => [r.reader, r.score.critical_wrong_count])),
    coverage: Object.fromEntries(rows.map((r) => [r.reader, r.score.coverage])),
  }
}

/** PII-free one-line-per-reader summary (counts + rates only, never values). */
export function summarizeBenchmark(report: ReaderBenchmarkReport): string {
  return report.rows
    .map((r) => {
      const s = r.score
      return (
        `${r.reader}: critical_wrong=${s.critical_wrong_count} ` +
        `critical_correct=${s.critical_correct}/${s.critical_total} ` +
        `coverage=${(s.coverage * 100).toFixed(0)}% review_rate=${(s.review_rate * 100).toFixed(0)}%`
      )
    })
    .join('\n')
}
