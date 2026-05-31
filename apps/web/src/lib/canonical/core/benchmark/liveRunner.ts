/**
 * benchmark/liveRunner.ts — orchestrate the live reader benchmark.
 *
 * Pure orchestration: the REAL engine calls (Gemini docintel, MRZ, TPS, Core) are
 * INJECTED as callers, so this is unit-testable with fakes (no real document/key
 * needed for CI). The CLI `scripts/run-live-reader-benchmark.mjs` wires the real
 * callers + handles files/keys and writes reports.
 *
 * BLOCKED, never a false PASS: if no reader produced output, status='blocked'.
 */
import { runReaderBenchmark, summarizeBenchmark, type ReaderOutputs, type ReaderBenchmarkReport } from './runReaderBenchmark'
import type { FlatPassportTruth } from './passportTruth'
import type { DocintelField } from './mappers'
import type { Td3ParseResult } from '@/lib/translation/identity/mrzParser'
import type { TpsExtractedField } from '@/lib/tps/types'
import type { CanonicalField } from '../../types'

/** Each caller returns the reader's native output, or null if unavailable (skipped). */
export interface LiveReaderCallers {
  /** Gemini docintel = the Translation reader. */
  gemini?: () => Promise<DocintelField[] | null>
  mrz?: () => Promise<Td3ParseResult | null>
  tps?: () => Promise<TpsExtractedField[] | null>
  core?: () => Promise<CanonicalField[] | null>
}

export interface LiveBenchmarkResult {
  status: 'ok' | 'blocked'
  blockedReason?: string
  ranReaders: string[]
  report?: ReaderBenchmarkReport
  /** PII-free one-liner per reader (safe to commit/log). */
  summary?: string
}

export async function runLiveBenchmark(
  truth: FlatPassportTruth,
  callers: LiveReaderCallers,
): Promise<LiveBenchmarkResult> {
  const outputs: ReaderOutputs = {}
  const ran: string[] = []

  const tryRun = async <T>(name: string, caller: (() => Promise<T | null>) | undefined, assign: (o: T) => void) => {
    if (!caller) return
    try {
      const out = await caller()
      if (out != null) {
        assign(out)
        ran.push(name)
      }
    } catch {
      /* a failing reader is skipped, not fatal — never a false PASS */
    }
  }

  await tryRun('gemini', callers.gemini, (o) => { outputs.translation = o })
  await tryRun('mrz', callers.mrz, (o) => { outputs.mrz = o })
  await tryRun('tps', callers.tps, (o) => { outputs.tps = o })
  await tryRun('core', callers.core, (o) => { outputs.core = o })

  if (ran.length === 0) {
    return { status: 'blocked', blockedReason: 'no reader produced output (missing key / engine / document)', ranReaders: [] }
  }

  const report = runReaderBenchmark(outputs, truth)
  return { status: 'ok', ranReaders: ran, report, summary: summarizeBenchmark(report) }
}
