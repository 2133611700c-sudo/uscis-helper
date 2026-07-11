/**
 * readerBridge.ts — B→A bridge decision (SHARED across services), decision-SHADOW phase.
 *
 * The intake brain (B) knows what the document IS; the field reader (A) currently reads by the
 * service's MANUAL docType hint. This module computes — PII-free — what a bridge WOULD decide if it
 * let intake pick the reader's docType, WITHOUT acting on it. In this phase the service still reads
 * with the manual type (`effectiveDocTypeId === manualDocTypeId` always). A later controlled-bridge
 * phase can consume `safeToBridge` + `intakeDocTypeId` to actually substitute.
 *
 * Gated by ONE_BRAIN_CONTROLS_READER (default OFF). Consumes the existing intake SHADOW observation
 * — it never calls analyzeIntake itself (pure function of the observation) ⇒ no double intake run.
 * Emits only type ids + booleans + reason codes: no field values, names, dates, doc numbers, OCR.
 */
import type { ShadowObservation } from './shadowRunner'

export function isReaderControlEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.ONE_BRAIN_CONTROLS_READER === '1'
}

/** intake docType values that must NEVER drive the reader. */
const UNUSABLE_TYPES = new Set(['unknown', 'unsupported', 'not_a_document', 'none', ''])

export interface ReaderBridgeDecision {
  service: string
  manualDocTypeId: string
  intakeDocTypeId: string | null
  /** intake type == manual hint? (null when intake did not run) */
  agreement: boolean | null
  intakeReady: boolean
  intakeStatus: string | null
  /** would a controlled bridge use the intake type? (ready AND usable type). */
  safeToBridge: boolean
  /** what the reader ACTUALLY uses in this phase: ALWAYS the manual type (decision-shadow). */
  effectiveDocTypeId: string
  reasonCodes: string[]
}

/**
 * Pure, PII-free. Given the manual hint and the intake shadow observation, decide what the bridge
 * WOULD do — and, for this decision-shadow phase, keep `effectiveDocTypeId` = manual regardless.
 */
export function decideReaderDocType(manualDocTypeId: string, obs: ShadowObservation | null): ReaderBridgeDecision {
  const reasonCodes: string[] = []
  const ran = obs?.ran === true
  const intakeDocTypeId = ran ? (obs?.brainDocTypeId ?? null) : null
  const intakeReady = ran ? obs?.readyForRecognition === true : false
  const typeUsable = intakeDocTypeId !== null && !UNUSABLE_TYPES.has(intakeDocTypeId)
  const agreement = ran ? (obs?.typeMatchesDeclared ?? (intakeDocTypeId === manualDocTypeId)) : null

  if (!ran) reasonCodes.push('intake_not_run')
  if (ran && !intakeReady) reasonCodes.push('intake_not_ready')
  if (ran && !typeUsable) reasonCodes.push('intake_type_unusable')
  if (ran && agreement === false) reasonCodes.push('type_disagreement')

  const safeToBridge = ran && intakeReady && typeUsable

  return {
    service: obs?.service ?? 'translation',
    manualDocTypeId,
    intakeDocTypeId,
    agreement,
    intakeReady,
    intakeStatus: obs?.intakeStatus ?? null,
    safeToBridge,
    // DECISION-SHADOW: the reader ALWAYS keeps the manual type in this phase. The substitution
    // (safeToBridge ? intakeDocTypeId : manual) is deferred to the owner-gated controlled phase.
    effectiveDocTypeId: manualDocTypeId,
    reasonCodes,
  }
}
