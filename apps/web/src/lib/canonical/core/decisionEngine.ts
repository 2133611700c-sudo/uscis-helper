/**
 * decisionEngine — THE ONE Decision Engine (One-Brain v2, Phase 1).
 *
 * A field's release decision (finalValue / review / manual) is computed in exactly one
 * pure function. Extract-not-rebuild: `decideField` is a mechanical lift of the LIVE
 * per-field logic in `documentSafety/applyOcrFieldSafety.ts` (criticality classification →
 * `protectOcrField` → the accept/reject mapping that writes finalValue), NOT the parked
 * ADR-016 `oneBrain/decideField.ts` scaffold (placeholder thresholds — stays parked).
 *
 * Contract:
 *  - PURE: no env reads, no I/O, input fields are never mutated.
 *  - C3 remains the single WRITER of `finalValue` (Constitution L5): this engine COMPUTES
 *    the decision; `applyFieldDecision` materializes it, and byte-parity with
 *    `applyOcrFieldSafety` is enforced by decisionEngine.parity.test.ts. The legacy C3
 *    wrapper keeps running in prod until the ONE_BRAIN_DECISION flip; the shadow flag
 *    (`ONE_BRAIN_DECISION_SHADOW === '1'`) lets routes diff engine-vs-legacy on live
 *    traffic with zero behavior change.
 *  - Knowledge is a SIGNAL: a KnowledgeDecision may accompany a field (evaluateKnowledge),
 *    but the engine never re-runs dictionaries and never lets a signal LOWER review
 *    (review-monotonic-up; the R6 soft-clear stays where it is, flag-gated).
 *
 * Imports are one-directional (engine → documentSafety) to avoid module cycles;
 * applyOcrFieldSafety delegates to this engine only at the Phase-8 collapse, not before.
 */
import {
  classifyCriticality,
  type SafetyContext,
  type SafeField,
} from '@/lib/documentSafety/applyOcrFieldSafety'
import { protectOcrField, type OcrSafetyReason } from '@/lib/documentSafety/ocrFieldSafetyGate'

/** The one decision shape every gate reads (reviewGate/finalPdfGate become readers of this). */
export interface FieldDecision {
  field: string
  /** 'accept' → finalValue is the release value; 'reject' → finalValue null, candidate kept. */
  status: 'accept' | 'reject'
  /** C3 semantics: string = release value; null = rejected (never released). */
  finalValue: string | null
  /** On reject: where the raw read is parked for human review. */
  candidateValue: string | null
  reviewRequired: boolean
  manualRequired: boolean
  criticality: ReturnType<typeof classifyCriticality>
  safetyDecision?: string
  reasonCodes?: OcrSafetyReason[]
}

export interface DecideOpts {
  zeroRecognition?: boolean
  anchorResolver?: (field: SafeField) => boolean
}

/** Pure per-field decision — the exact live C3 branch, lifted. */
export function decideField(f: SafeField, ctx: SafetyContext, opts: DecideOpts = {}): FieldDecision {
  const criticality = classifyCriticality(f.field)
  const strongAnchor = opts.anchorResolver
    ? opts.anchorResolver(f) || ctx.strong_source_anchor === true
    : ctx.strong_source_anchor === true
  const r = protectOcrField({
    flow: ctx.flow,
    field_name: f.field,
    criticality,
    document_class: ctx.document_class ?? null,
    source_doc_type: ctx.source_doc_type ?? null,
    expected_source_doc_type: ctx.expected_source_doc_type ?? null,
    value_present: f.value != null && f.value !== '',
    candidate_value_present:
      (f.raw_cyrillic != null && f.raw_cyrillic !== '') || (f.value != null && f.value !== ''),
    review_required: f.review_required === true,
    confidence: typeof f.confidence === 'number' ? f.confidence : null,
    strong_source_anchor: strongAnchor,
    legacy_reader: ctx.legacy_reader === true,
    hard_case: ctx.hard_case === true,
    source_doc_id_hash: ctx.source_doc_id_hash ?? null,
    session_doc_id_hash: ctx.session_doc_id_hash ?? null,
    zero_usable_recognition: opts.zeroRecognition === true,
    consensus_reliable: f.consensus_reliable === true,
  })
  if (r.final_value_allowed) {
    const acceptedValue: string | null =
      (f as Record<string, unknown>).normalizedValue != null
        ? ((f as Record<string, unknown>).normalizedValue as string)
        : f.value ?? null
    return {
      field: f.field,
      status: 'accept',
      finalValue: acceptedValue,
      candidateValue: null,
      reviewRequired: f.review_required === true || r.review_required,
      manualRequired: r.manual_required,
      criticality,
    }
  }
  return {
    field: f.field,
    status: 'reject',
    finalValue: null,
    candidateValue: f.value ?? f.raw_cyrillic ?? null,
    reviewRequired: true,
    manualRequired: r.manual_required,
    criticality,
    safetyDecision: r.decision,
    reasonCodes: r.reason_codes,
  }
}

/** Materialize a decision onto a field — reproduces applyOcrFieldSafety's output EXACTLY. */
export function applyFieldDecision<T extends SafeField>(f: T, d: FieldDecision): SafeField {
  if (d.status === 'accept') {
    return {
      ...f,
      review_required: d.reviewRequired,
      manual_required: d.manualRequired,
      finalValue: d.finalValue,
    }
  }
  return {
    ...f,
    candidate_value: d.candidateValue,
    value: null,
    review_required: true,
    manual_required: d.manualRequired,
    safety_decision: d.safetyDecision,
    safety_reason_codes: d.reasonCodes,
    finalValue: null,
  }
}

/** Doc-level decision pass — mirrors applyOcrFieldSafety's shape (fields + unresolved flag). */
export function decideFields<T extends SafeField>(
  fields: T[],
  ctx: SafetyContext,
  opts: DecideOpts = {},
): { decisions: FieldDecision[]; fields: SafeField[]; anyUnresolvedCritical: boolean } {
  const decisions = fields.map((f) => decideField(f, ctx, opts))
  const out = fields.map((f, i) => applyFieldDecision(f, decisions[i]))
  const anyUnresolvedCritical = decisions.some(
    (d) =>
      (d.criticality === 'critical_identity' || d.criticality === 'critical_document') &&
      (d.reviewRequired || d.manualRequired),
  )
  return { decisions, fields: out, anyUnresolvedCritical }
}

/** Shadow flag (strict '1'): routes may diff engine-vs-legacy with zero behavior change. */
export function isDecisionShadowEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.ONE_BRAIN_DECISION_SHADOW === '1'
}
