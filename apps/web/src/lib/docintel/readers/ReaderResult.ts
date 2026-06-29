/**
 * ReaderResult — the ONE reader contract for the One-Brain convergence
 * (docs/ocr/ONE_BRAIN_CONVERGENCE.md, Step A).
 *
 * Every recognition engine (Gemini, Google Vision, Document AI, HTR sidecar,
 * legacy rule module, DeepSeek mapper) emits this SAME shape. A Reader only
 * OBSERVES — it never sets review_required, never sets a final/confirmed value,
 * never decides. The single Decision Engine consumes ReaderResult[] and decides.
 *
 * INVARIANTS (enforced by tests):
 *  - A Reader emits observations only: no `finalValue`, no `confirmed`, no `review_required`.
 *  - `status:'unavailable'` (403/429/5xx/timeout) is NOT an empty success — the
 *    orchestrator must fail closed, never present a blank form as a clean read.
 *  - `abstained:true` is an honest "couldn't read" (≠ low confidence).
 *  - A DEPENDENT reader (e.g. DeepSeek mapping already-OCR'd text) carries
 *    `dependent:true` so consensus/self-consistency logic never counts it as an
 *    independent observation of the image. Re-reading with the same engine is the
 *    SAME observation, never a second vote.
 *
 * This module is pure types + one pure adapter. It changes NO runtime behaviour
 * and is consumed by nothing yet (adapter-first; cut over after parity is green).
 */
import type { VisionReadResult } from '../types'

export type ReaderFamily =
  | 'gemini'
  | 'google_vision'
  | 'document_ai'
  | 'htr'
  | 'legacy_rule'
  | 'deepseek_mapper'

/** ok = read returned; unavailable = 403/429/5xx/timeout (fail-closed, NOT empty success). */
export type ReaderStatus = 'ok' | 'unavailable' | 'abstained' | 'partial'

export interface ReaderEvidenceRegion {
  page?: number
  /** normalized [x0,y0,x1,y1] in 0..1; absent when the engine yields no geometry. */
  bbox?: [number, number, number, number]
}

export interface ReaderFieldObservation {
  field: string
  /** Exact script the engine saw. NEVER transliterated here. */
  rawCyrillic: string | null
  isoDate?: string | null
  /** engine-reported, 0..1 */
  confidence: number
  /** the engine declined this field (≠ low confidence). */
  abstained: boolean
  evidenceRegion?: ReaderEvidenceRegion | null
  reason?: string | null
}

export interface ReaderResult {
  readerFamily: ReaderFamily
  model: string | null
  status: ReaderStatus
  fields: ReaderFieldObservation[]
  /** whole-read abstention (no readable fields). */
  abstained: boolean
  ms: number
  errorStatus?: number | null
  errorTimeout?: boolean
  error?: string | null
  /** true when this read depends on another reader's output (e.g. DeepSeek over OCR text). */
  dependent?: true
}

/**
 * BYTE-IDENTICAL adapter: map the live Gemini provider's VisionReadResult into a
 * ReaderResult WITHOUT touching geminiVisionProvider. A `!ok` read (timeout/429/
 * 403/5xx) becomes `status:'unavailable'` (fail-closed), carrying the original
 * errorStatus/errorTimeout. `can_read===false` per field → `abstained:true`.
 * No value is invented; `cyrillic` maps straight to `rawCyrillic`.
 */
export function readerResultFromVision(vr: VisionReadResult, ms = 0): ReaderResult {
  if (!vr.ok) {
    return {
      readerFamily: 'gemini',
      model: vr.model ?? null,
      status: 'unavailable',
      fields: [],
      abstained: true,
      ms,
      errorStatus: vr.errorStatus ?? null,
      errorTimeout: vr.errorTimeout ?? false,
      error: vr.error ?? null,
    }
  }
  const fields: ReaderFieldObservation[] = vr.fields.map((f) => ({
    field: f.field,
    rawCyrillic: f.cyrillic ?? null,
    isoDate: f.iso_date ?? null,
    confidence: typeof f.confidence === 'number' ? f.confidence : 0,
    abstained: f.can_read === false,
    reason: f.reason ?? null,
  }))
  const allAbstained = fields.length === 0 || fields.every((f) => f.abstained)
  return {
    readerFamily: 'gemini',
    model: vr.model ?? null,
    status: allAbstained ? 'abstained' : 'ok',
    fields,
    abstained: allAbstained,
    ms,
  }
}
