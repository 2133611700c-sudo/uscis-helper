/**
 * Reader — the ONE reader interface for the One-Brain convergence
 * (docs/ocr/ONE_BRAIN_CONVERGENCE.md, Step A).
 *
 * Every recognition engine implements this SAME interface and emits a
 * ReaderResult (see ./ReaderResult.ts). A Reader only OBSERVES the image — it
 * never decides, never sets review_required, never writes a final value. The
 * single Decision Engine consumes ReaderResult[] and decides.
 *
 * `enabled` is resolved at module load from env (additive roster): a disabled
 * reader MUST short-circuit in read() and return unavailableResult() WITHOUT
 * any network call (fail-closed, never a blank-form "clean read").
 */
import type { ReaderFamily, ReaderResult } from './ReaderResult'

export interface Reader {
  readonly family: ReaderFamily
  readonly enabled: boolean
  read(image: Buffer, mimeType: string, opts?: Record<string, unknown>): Promise<ReaderResult>
}

/**
 * The canonical "this engine did not run" result. status:'unavailable' is a
 * fail-closed signal (NOT an empty success); abstained:true, no fields, ms:0,
 * and the reason carried in `error`.
 */
export function unavailableResult(family: ReaderFamily, reason: string): ReaderResult {
  return {
    readerFamily: family,
    model: null,
    status: 'unavailable',
    fields: [],
    abstained: true,
    ms: 0,
    error: reason,
  }
}
