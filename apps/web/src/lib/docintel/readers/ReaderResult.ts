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
import type { EvidenceRegion } from '../evidence/EvidenceRegion'

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
  /**
   * TRUTH-PLAN step 4 (dormant→live seam): the reader's FORMAT-canonical value (KMU-55 Latin
   * for names/places, ISO for dates) as the reading layer produced it. Still an OBSERVATION —
   * deterministic format canon is the reader's output, not a decision; arbitration/C3 decide.
   * Optional: provider-level observations (raw vision) leave it absent.
   */
  canonicalValue?: string | null
  /** Reader-level review signals, carried verbatim (observation, never a decision). */
  reviewRequired?: boolean
  reviewReasons?: string[]
  consensusReliable?: boolean
  /**
   * DEPRECATED (kept for back-compat): a SINGLE legacy region. New code emits the
   * canonical `evidenceRegions` array below. A reader may set either; consumers should
   * prefer `evidenceRegions` and fall back to `[evidenceRegion]`.
   */
  evidenceRegion?: ReaderEvidenceRegion | null
  /**
   * VISUAL evidence — canonical multi-region geometry (§6). This is the forward path
   * that maps 1:1 onto ExtractedDocField.evidenceRegions → FieldCandidate.visualEvidence
   * → CanonicalField.visualEvidence. A field's value can span several regions (combined
   * tokens / multi-line / multi-page), so this is an ARRAY. Absent → no geometry.
   * (ReaderResult is currently dormant; this keeps the reader contract aligned with the
   * live carriage so activating a localizing reader needs no further contract change.)
   */
  evidenceRegions?: EvidenceRegion[]
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
/**
 * TRUTH-PLAN step 4 — the LIVE seam adapter (dormant→consumed). Maps the reading layer's
 * ExtractedDocField[] (post format-canon) into ReaderResult observations WITHOUT losing any
 * candidate-relevant fact. Together with `observationToCandidate` below this lets
 * recognizeDocument convert candidates THROUGH ReaderResult behind READER_RESULT_SEAM='1',
 * with byte-parity to the direct docintelToCandidate path (readerResultSeam.parity test).
 */
export function readerResultFromExtracted(
  fields: ReadonlyArray<{
    field: string
    raw_cyrillic: string | null
    value: string | null
    confidence: number
    review_required: boolean
    review_reasons?: string[]
    consensus_reliable?: boolean
    evidenceRegions?: EvidenceRegion[]
  }>,
  model: string | null,
  ms = 0,
): ReaderResult {
  const obs: ReaderFieldObservation[] = fields.map((f) => ({
    field: f.field,
    rawCyrillic: f.raw_cyrillic,
    confidence: typeof f.confidence === 'number' ? f.confidence : 0,
    abstained: (f.value ?? '') === '' && (f.raw_cyrillic ?? '') === '',
    canonicalValue: f.value,
    reviewRequired: f.review_required === true,
    reviewReasons: f.review_reasons ? [...f.review_reasons] : undefined,
    consensusReliable: f.consensus_reliable,
    evidenceRegions: f.evidenceRegions,
  }))
  const allAbstained = obs.length === 0 || obs.every((o) => o.abstained)
  return {
    readerFamily: 'gemini',
    model,
    status: allAbstained ? 'abstained' : 'ok',
    fields: obs,
    abstained: allAbstained,
    ms,
  }
}

/**
 * Observation → FieldCandidate, FIELD-FOR-FIELD identical to
 * canonical/core/translationAdapter.docintelToCandidate (the parity test freezes this).
 * Keeping the mapping here makes ReaderResult the real seam, not a bystander.
 */
export function observationToCandidate(
  o: ReaderFieldObservation,
  page: number,
  providerName: string,
): {
  key: string
  value: string
  rawCyrillic?: string
  source: 'ai_vision'
  confidence: number | null
  provider: string
  reviewRequired?: boolean
  reviewReasons?: string[]
  consensus_reliable?: boolean
  visualEvidence?: EvidenceRegion[]
} {
  return {
    key: o.field,
    value: o.canonicalValue ?? '',
    rawCyrillic: o.rawCyrillic ?? undefined,
    source: 'ai_vision',
    confidence: o.confidence,
    provider: `docintel:${providerName}:page${page}`,
    reviewRequired: o.reviewRequired,
    reviewReasons: o.reviewReasons?.length
      ? [...o.reviewReasons]
      : o.reviewRequired ? ['reader_flagged'] : [],
    consensus_reliable: o.consensusReliable,
    visualEvidence: o.evidenceRegions,
  }
}

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
