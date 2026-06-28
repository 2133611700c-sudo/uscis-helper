/**
 * Phase 10 / Workstream H — PII-free structured observability for the contract
 * vertical. Events carry ONLY a fixed allow-list of non-PII fields; the emitter
 * strips anything else, so a name / DOB / certificate number / raw OCR text can
 * never leak into logs even if a caller passes it by mistake.
 */
export type ContractEventType =
  | 'extraction_started'
  | 'extraction_completed'
  | 'schema_validation_failed'
  | 'review_required'
  | 'final_pdf_blocked'
  | 'final_pdf_generated'
  | 'provider_model_mismatch'
  | 'canonical_adapter_failed'

/** The ONLY fields allowed in an event payload (all non-PII). */
export interface ContractEvent {
  event: ContractEventType
  docType?: string | null
  fieldKey?: string | null // a contract field KEY (e.g. "document_series"), never a value
  state?: string | null
  errorCategory?: string | null
  modelId?: string | null
  schemaVersion?: string | null
  latencyMs?: number | null
  correlationId?: string | null // anonymous (opaque) id
}

const ALLOWED_KEYS: ReadonlyArray<keyof ContractEvent> = [
  'event', 'docType', 'fieldKey', 'state', 'errorCategory', 'modelId',
  'schemaVersion', 'latencyMs', 'correlationId',
]

/** Strip any key not on the allow-list (defense against accidental PII). */
export function sanitizeContractEvent(raw: Record<string, unknown>): Partial<ContractEvent> {
  const out: Record<string, unknown> = {}
  for (const k of ALLOWED_KEYS) if (raw[k as string] !== undefined) out[k as string] = raw[k as string]
  return out as Partial<ContractEvent>
}

/** Emit a PII-free contract event (console.info; swap for a sink later). */
export function emitContractEvent(
  e: ContractEvent,
  sink: (line: string) => void = (l) => console.info(l),
): void {
  const safe = sanitizeContractEvent(e as unknown as Record<string, unknown>)
  sink(`[contract_event] ${JSON.stringify(safe)}`)
}
