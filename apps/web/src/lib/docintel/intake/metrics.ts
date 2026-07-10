/**
 * metrics.ts — PHASE 9: scorecards + flip criteria (no trust without measurement).
 *
 * Truth rule made enforceable: a doc-type/family/provider may NOT be marked trusted or flipped LIVE
 * without a metrics object meeting the threshold. Pilot N (small) proves function only; N≥25/family
 * proves trust; handwritten fields need a GT battery before selective review; a BLOCKED_EXTERNAL
 * provider can never be counted as a pass. Pure types + pure guards.
 */
import type { DocumentTypeId } from './canonicalRegistry'

export type StatusLabel =
  | 'LIVE' | 'SHADOW_ONLY' | 'FLAGGED' | 'DARK' | 'BLOCKED_EXTERNAL' | 'PARTIAL'
  | 'STRONG_PARTIAL' | 'HISTORICAL' | 'UNVERIFIED'

export const MIN_N_FOR_TRUST = 25 // per doc-type family (owner rule)

export interface Scorecard {
  subject: string            // docTypeId / family / providerId
  n: number                  // independent documents measured
  accuracy: number | null    // 0..1, null if not measured
  handwrittenFields: boolean // does this subject include handwritten fields?
  handwrittenGtBattery: boolean // is there a ground-truth battery for the handwritten fields?
  providerBlockedExternal: boolean // is the required provider blocked (billing/host)?
  reviewRequiredPrecision: number | null
  label: StatusLabel
}

export interface FlipVerdict {
  canFlip: boolean
  blockers: string[]
}

/**
 * Can a subject be TRUSTED / flipped LIVE? Fail-closed: needs measured accuracy, N≥threshold, no
 * blocking external provider, and (if handwritten) a GT battery. Returns the exact blockers.
 */
export function canClaimTrust(sc: Scorecard, opts: { minN?: number; minAccuracy?: number } = {}): FlipVerdict {
  const minN = opts.minN ?? MIN_N_FOR_TRUST
  const minAcc = opts.minAccuracy ?? 0.95
  const blockers: string[] = []
  if (sc.providerBlockedExternal) blockers.push('provider_blocked_external')
  if (sc.accuracy === null) blockers.push('accuracy_not_measured')
  else if (sc.accuracy < minAcc) blockers.push(`accuracy_below_${minAcc}`)
  if (sc.n < minN) blockers.push(`insufficient_n_${sc.n}_lt_${minN}`)
  if (sc.handwrittenFields && !sc.handwrittenGtBattery) blockers.push('handwritten_without_gt_battery')
  return { canFlip: blockers.length === 0, blockers }
}

/** Derive the honest status label from a scorecard (never over-claims). */
export function deriveStatusLabel(sc: Scorecard): StatusLabel {
  if (sc.providerBlockedExternal) return 'BLOCKED_EXTERNAL'
  if (sc.accuracy === null || sc.n === 0) return 'UNVERIFIED'
  if (sc.n < 3) return 'UNVERIFIED'
  const trust = canClaimTrust(sc)
  if (trust.canFlip) return 'LIVE'
  if (sc.n >= 3 && (sc.accuracy ?? 0) >= 0.9) return 'STRONG_PARTIAL'
  return 'PARTIAL'
}

/** A trusted claim requires a metrics object that passes canClaimTrust. Returns violations. */
export function assertTrustedRequiresMetrics(claimTrusted: boolean, sc: Scorecard | null): string[] {
  if (!claimTrusted) return []
  if (!sc) return ['trusted claimed with no metrics object']
  const v = canClaimTrust(sc)
  return v.canFlip ? [] : v.blockers.map((b) => `trusted claim blocked: ${b}`)
}

/** The current known evidence for the one doc-type proven this session (pilot only — NOT trusted). */
export function birthCertSovietPilotScorecard(): Scorecard {
  return {
    subject: 'ua_birth_certificate_soviet' satisfies DocumentTypeId,
    n: 1,                          // one real document
    accuracy: null,               // handwriting NOT solved → no field-accuracy claim
    handwrittenFields: true,
    handwrittenGtBattery: false,  // no GT battery yet
    providerBlockedExternal: true, // HTR host missing
    reviewRequiredPrecision: null,
    label: 'BLOCKED_EXTERNAL',
  }
}
