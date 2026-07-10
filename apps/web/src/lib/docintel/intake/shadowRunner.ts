/**
 * shadowRunner.ts — PHASE 7: service integration MECHANISM (shadow-only, flag-gated, log-only).
 *
 * Lets any service run the DocumentIntakeBrain ALONGSIDE its current path to observe what One Brain
 * would decide — WITHOUT changing the response. This is how a service is migrated safely: shadow →
 * compare → prove parity → owner sign-off → flip (the flip itself is NOT here; it is owner-gated per
 * the project's shadow-then-flip discipline). Default OFF ⇒ the runner is a no-op ⇒ byte-identical.
 *
 * Never throws into the caller (fail-open); never logs PII (uses toSafeLog); never influences the
 * service's output. Pure orchestration around analyzeIntake + a provided logger.
 */
import { analyzeIntake, type IntakeProviders, type IntakeOpts } from './documentIntakeBrain'
import { toSafeLog, intakeReadyForRecognition, type DocumentIntakeResult } from './contracts'
import { summarizeTrace } from './trace'

export function isIntakeShadowEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.ONE_BRAIN_INTAKE_SHADOW === '1'
}

export interface ShadowCompareInput {
  /** what the service is about to do WITHOUT One Brain (its user-declared type). */
  declaredDocTypeId?: string | null
  service: 'translation' | 'tps' | 'reparole' | 'ead'
}

export interface ShadowObservation {
  ran: boolean
  service: string
  intakeStatus: DocumentIntakeResult['status'] | null
  brainDocTypeId: string | null
  declaredDocTypeId: string | null
  /** the key comparison signal: does the brain's measured type match the service's declared hint? */
  typeMatchesDeclared: boolean | null
  readyForRecognition: boolean | null
  reasonCodes: string[]
}

/**
 * Run the intake brain in shadow. Returns a PII-free observation and emits it via `log` (if given).
 * When the flag is OFF this returns `{ran:false}` immediately and calls nothing — byte-identical.
 * NEVER affects the caller's control flow: all errors are swallowed into `{ran:false}`.
 */
export async function runIntakeShadow(
  buffer: Buffer,
  providers: IntakeProviders,
  input: ShadowCompareInput,
  opts: IntakeOpts & { log?: (marker: string, payload: unknown) => void; env?: Record<string, string | undefined> } = {},
): Promise<ShadowObservation> {
  const env = opts.env ?? process.env
  if (!isIntakeShadowEnabled(env)) {
    return { ran: false, service: input.service, intakeStatus: null, brainDocTypeId: null, declaredDocTypeId: input.declaredDocTypeId ?? null, typeMatchesDeclared: null, readyForRecognition: null, reasonCodes: [] }
  }
  try {
    const { result, trace } = await analyzeIntake(buffer, providers, opts)
    const brainType = result.docType.docTypeId
    const declared = input.declaredDocTypeId ?? null
    const obs: ShadowObservation = {
      ran: true,
      service: input.service,
      intakeStatus: result.status,
      brainDocTypeId: brainType,
      declaredDocTypeId: declared,
      typeMatchesDeclared: declared == null ? null : declared === brainType,
      readyForRecognition: intakeReadyForRecognition(result),
      reasonCodes: result.review.reasonCodes,
    }
    if (opts.log) {
      opts.log('[one_brain_intake_shadow]', { ...obs, intake: toSafeLog(result), trace: summarizeTrace(trace) })
    }
    return obs
  } catch {
    // fail-open: shadow must NEVER break the live service.
    return { ran: false, service: input.service, intakeStatus: null, brainDocTypeId: null, declaredDocTypeId: input.declaredDocTypeId ?? null, typeMatchesDeclared: null, readyForRecognition: null, reasonCodes: ['shadow_error'] }
  }
}
