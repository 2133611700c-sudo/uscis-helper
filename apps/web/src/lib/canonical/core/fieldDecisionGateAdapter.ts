/**
 * fieldDecisionGateAdapter — ONE-BRAIN v2 Phase 1b ("gates become READERS of FieldDecision").
 *
 * Zero-risk form of the plan step: the gates (reviewGate / finalPdfGate) are NOT rewritten —
 * they already read shared derivations (contractReviewState, classifyCriticality). Instead,
 * this adapter PROJECTS the Decision Engine's FieldDecision onto the exact input shapes the
 * gates consume, so when the engine flips on, routes can feed gates the engine's decision
 * without any gate change. Pure layout: no value invented, no review lowered.
 *
 * INVARIANT (enforced by fieldDecisionGateInvariant.test):
 *   engine reject (finalValue=null)  ⟹ reviewGate counts the field unresolved
 *                                    ⟹ finalPdfGate cannot see it as releasable.
 *   engine review ⟹ gate review (monotonic — the projection can never LOWER review).
 */
import type { FieldDecision } from './decisionEngine'
import type { ReviewGateField } from '@/lib/translation/reviewGate'
import type { FinalPdfField } from '@/lib/contracts/finalPdfGate'

/** Project one FieldDecision onto the reviewGate's field shape. */
export function fieldDecisionToReviewGateField(d: FieldDecision): ReviewGateField {
  return {
    field: d.field,
    // reviewGate treats an empty normalized_value as unresolved — a rejected decision
    // (finalValue null) therefore hard-blocks, exactly the engine's intent.
    normalized_value: d.finalValue,
    review_required: d.reviewRequired || d.status === 'reject',
    review_reasons: d.reasonCodes ? [...d.reasonCodes] : undefined,
  }
}

/** Project one FieldDecision onto the finalPdfGate's field shape. */
export function fieldDecisionToFinalPdfField(d: FieldDecision): FinalPdfField {
  return {
    field: d.field,
    // C3 semantics carried verbatim: final_value string = release; null = rejected.
    final_value: d.finalValue,
    normalized_value: d.finalValue,
    raw_value: d.candidateValue ?? null,
    review_required: d.reviewRequired || d.status === 'reject',
    review_reasons: d.reasonCodes ? [...d.reasonCodes] : undefined,
    // The projection NEVER asserts user confirmation — only a human can set that.
    confirmed: false,
  }
}
