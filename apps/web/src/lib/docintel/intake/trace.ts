/**
 * intake/trace.ts — PHASE 2: OneBrainTrace (OpenTelemetry-style spans) for explainability.
 *
 * Every intake/recognition stage emits a span so a document's processing is reconstructable
 * WITHOUT exposing PII. A span is a unit of work with a name, status, timing, provider, decision
 * summary, and reason codes — evidence is IDs/hashes only, never raw document text.
 *
 * Pure + deterministic: no wall-clock reads inside constructors (timestamps are passed in, so the
 * model is testable and replay-safe). No I/O. Design mirrors OTel span semantics.
 */
export type SpanName =
  | 'intake' | 'preflight' | 'orientation' | 'language' | 'country' | 'family' | 'type'
  | 'page_side' | 'reader_route' | 'recognition' | 'candidate_pool' | 'arbitration'
  | 'review_policy' | 'c3_writer' | 'service_output'

export type SpanStatus = 'ok' | 'failed' | 'skipped' | 'unavailable' | 'unset'

export interface OneBrainSpan {
  name: SpanName
  status: SpanStatus
  startMs: number
  endMs: number | null
  provider: string | null
  /** PII-free decision summary (e.g. "type=ua_birth_certificate_soviet conf=1.0"). */
  decision: string | null
  reasonCodes: string[]
  /** Evidence IDs/hashes only — NEVER raw values. */
  evidenceIds: string[]
}

export interface OneBrainTrace {
  traceId: string
  spans: OneBrainSpan[]
}

/** Start a trace (traceId supplied by caller — deterministic/testable). */
export function startTrace(traceId: string): OneBrainTrace {
  return { traceId, spans: [] }
}

/** Append a completed span. Enforces PII-safety structurally: only the typed fields are stored,
 *  and evidenceIds must look like ids/hashes (no spaces → not free text). */
export function addSpan(trace: OneBrainTrace, span: Omit<OneBrainSpan, 'evidenceIds'> & { evidenceIds?: string[] }): OneBrainTrace {
  const evidenceIds = (span.evidenceIds ?? []).filter((id) => typeof id === 'string' && !/\s/.test(id))
  return { ...trace, spans: [...trace.spans, { ...span, evidenceIds }] }
}

/** True iff every span has a resolved (non-'unset') status and a non-null end — a complete trace. */
export function isTraceComplete(trace: OneBrainTrace): boolean {
  return trace.spans.length > 0 && trace.spans.every((s) => s.status !== 'unset' && s.endMs !== null)
}

/** A PII-free one-line-per-span summary for the evidence report / owner debugging. */
export function summarizeTrace(trace: OneBrainTrace): string[] {
  return trace.spans.map((s) => {
    const dur = s.endMs != null ? `${s.endMs - s.startMs}ms` : '—'
    return `${s.name}: ${s.status} ${dur}${s.provider ? ` [${s.provider}]` : ''}${s.decision ? ` ${s.decision}` : ''}${s.reasonCodes.length ? ` reasons=${s.reasonCodes.join(',')}` : ''}`
  })
}
