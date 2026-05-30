/**
 * canonical/index.ts — Phase 2 canonical contract (one recognition brain).
 *
 * Types + pure policy. No product reads from this yet; it is introduced
 * additively so the canonical core can be built and shadow-tested before any
 * migration off the two existing stacks.
 */
export type {
  Criticality,
  SourceKind,
  FieldConfidence,
  FieldEvidence,
  CanonicalField,
  CanonicalProduct,
  CanonicalHashChain,
  CanonicalDocumentResult,
} from './types'

export {
  CRITICAL_FIELDS,
  REVIEW_THRESHOLD,
  criticalityOf,
  computeFinalConfidence,
  buildConfidence,
  materiallyDifferent,
  sourceRank,
  higherAuthority,
  resolveDisagreement,
  decideReviewRequired,
} from './policy'
