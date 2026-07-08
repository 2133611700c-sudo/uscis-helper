/**
 * arbitration.ts — PHASE 5: intake-level candidate pool + doc-TYPE arbitration + review policy.
 *
 * The FIELD-level arbiter (fieldArbiter.ts) is untouched. This adds the INTAKE-level fusion: many
 * classifier providers (rule/anchor, vision-LLM, OCR-keyword) each propose a doc-type candidate;
 * `arbitrateDocType` fuses them (agreement raises confidence, disagreement lowers it and flags
 * review) so no single provider decides. Plus `reviewPolicyForType` maps the registry policy +
 * runtime signals (handwriting, disagreement, low confidence) → review reasons. Pure + testable.
 */
import { getCanonicalEntry, type DocumentTypeId, type ProviderId } from './canonicalRegistry'
import type { IntakeReasonCode } from './contracts'

export interface TypeCandidate {
  provider: ProviderId
  docTypeId: DocumentTypeId | 'unknown'
  confidence: number
}

export interface TypeArbitration {
  docTypeId: DocumentTypeId | 'unknown'
  confidence: number
  agreement: boolean          // ≥2 providers agreed on the winner
  providerCount: number
  reasonCodes: IntakeReasonCode[]
  rejected: TypeCandidate[]    // audit: losing candidates preserved
}

/**
 * Fuse doc-type candidates. Winner = highest summed confidence across providers that named it.
 * Agreement (≥2 providers) boosts; a lone provider flags `single_provider_classification`;
 * genuine disagreement (different top ids) lowers confidence. Fail-closed to unknown on no input.
 */
export function arbitrateDocType(candidates: TypeCandidate[]): TypeArbitration {
  const real = candidates.filter((c) => c.docTypeId !== 'unknown' && c.confidence > 0)
  if (real.length === 0) {
    return { docTypeId: 'unknown', confidence: 0, agreement: false, providerCount: candidates.length, reasonCodes: ['doc_type_unknown'], rejected: candidates }
  }
  // group by id
  const byId = new Map<string, TypeCandidate[]>()
  for (const c of real) {
    const arr = byId.get(c.docTypeId) ?? []
    arr.push(c); byId.set(c.docTypeId, arr)
  }
  const groups = [...byId.entries()].map(([id, cs]) => ({
    id: id as DocumentTypeId,
    supporters: cs,
    // score = mean confidence * (1 + 0.25*(supporters-1))  (agreement bonus)
    score: (cs.reduce((s, c) => s + c.confidence, 0) / cs.length) * (1 + 0.25 * (cs.length - 1)),
  }))
  groups.sort((a, b) => b.score - a.score)
  const winner = groups[0]
  const agreement = winner.supporters.length >= 2
  const reasonCodes: IntakeReasonCode[] = []

  // disagreement: another id has meaningful support
  const disagreement = groups.length > 1 && groups[1].supporters.length > 0
  let confidence = Math.min(1, winner.score)
  if (!agreement) {
    reasonCodes.push('single_provider_classification')
  }
  if (disagreement) {
    // lower confidence proportional to the runner-up strength
    confidence = Math.max(0, confidence - Math.min(0.3, groups[1].score * 0.3))
  }
  const rejected = real.filter((c) => c.docTypeId !== winner.id)
  return { docTypeId: winner.id, confidence, agreement, providerCount: candidates.length, reasonCodes, rejected }
}

export interface ReviewContext {
  handwritingPresent: boolean | null
  docTypeConfidence: number
  providerDisagreement: boolean
  htrAvailable: boolean
}

export interface ReviewOutcome {
  reviewRequired: boolean
  reasonCodes: IntakeReasonCode[]
}

/**
 * Registry-driven review policy: a type's registry handwritingPolicy/reviewPolicy + runtime signals
 * decide review. Handwriting-forced types stay review-required until HTR metrics prove otherwise
 * (owner rule); disagreement or low confidence on a real type forces review; fail-closed pseudo-types
 * always review.
 */
export function reviewPolicyForType(docTypeId: DocumentTypeId | 'unknown', ctx: ReviewContext, opts: { minConfidence?: number } = {}): ReviewOutcome {
  const reasons: IntakeReasonCode[] = []
  if (docTypeId === 'unknown') return { reviewRequired: true, reasonCodes: ['doc_type_unknown'] }
  const e = getCanonicalEntry(docTypeId)
  const min = opts.minConfidence ?? e.minConfidenceToTrust

  if (e.reviewPolicy === 'manual_review_required' || e.reviewPolicy === 'reject_or_retake') reasons.push('doc_type_unknown')
  const forcedHw = e.handwritingPolicy === 'force_review'
  const conditionalHw = e.handwritingPolicy === 'force_review_if_handwritten' && ctx.handwritingPresent === true
  if (forcedHw || conditionalHw) {
    reasons.push('handwriting_present')
    if (!ctx.htrAvailable) reasons.push('provider_unavailable')
  }
  if (ctx.docTypeConfidence < min) reasons.push('below_route_confidence')
  if (ctx.providerDisagreement) reasons.push('single_provider_classification')
  return { reviewRequired: reasons.length > 0, reasonCodes: reasons }
}
