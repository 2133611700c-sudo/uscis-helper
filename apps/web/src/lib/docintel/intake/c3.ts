/**
 * c3.ts — PHASE 6: the C3 writer contract (the ONLY final-value writer boundary for services).
 *
 * Doctrine: One Brain arbitrates · C3 writes · service presents. Every service must receive
 * CANONICAL, reviewed fields through this contract and produce output from them — never re-extract
 * a document, never take a raw provider candidate as final, never write final values itself. The
 * existing CanonicalField.finalValue is the field-level C3 gate; this adds the SERVICE-boundary
 * contract + a guard that rejects non-canonical input. Pure types + pure guards.
 */
import { assertCanonicalHasSource, type IntakeReasonCode } from './contracts'
import type { DocumentTypeId } from './canonicalRegistry'

/** The minimal canonical-field view C3 consumes. The existing CanonicalField structurally satisfies
 *  this (key/finalValue/reviewRequired/source/evidence), so no rewrite is needed. */
export interface CanonicalFieldView {
  key: string
  finalValue?: string | null // undefined = C3 hasn't run; null = rejected; string = accepted
  reviewRequired: boolean
  reviewReasons?: string[]
  source?: string | null
  evidence?: Array<{ source?: string; provider?: string }> | null
}

export type ServiceId = 'translation' | 'tps' | 'reparole' | 'ead'

export interface C3Input {
  docTypeId: DocumentTypeId | string
  fields: CanonicalFieldView[]
  documentSessionId: string
  service: ServiceId
  /** whole-document review flag from the brain (any critical/uncertain field) */
  requiresReview: boolean
  reasonCodes?: IntakeReasonCode[]
}

export interface ServiceOutput {
  service: ServiceId
  docTypeId: DocumentTypeId | string
  /** presentation fields — key + released value (may be null/held) + review flag; NEVER raw candidate. */
  fields: Array<{ key: string; value: string | null; reviewRequired: boolean; reviewReasons: string[] }>
  reviewRequiredFields: string[]
  requiresReview: boolean
}

/** A C3 writer takes canonical input and produces service-shaped output. Injected per service. */
export type C3Writer = (input: C3Input) => ServiceOutput

/** Presentation adapter: pure mapping from ServiceOutput to whatever the wizard renders. */
export type ServicePresentationAdapter<T> = (out: ServiceOutput) => T

// ── Guards ──

/**
 * Validate C3 input is genuinely canonical + arbitrated. Returns violations (empty = ok). Rejects:
 * a field with a finalValue but no candidate source/evidence (assertCanonicalHasSource), or a
 * released (non-null) finalValue on a field still flagged reviewRequired without any review reason.
 */
export function validateC3Input(input: C3Input): string[] {
  const v: string[] = []
  for (const f of input.fields) {
    v.push(...assertCanonicalHasSource(f))
    const released = f.finalValue !== undefined && f.finalValue !== null
    if (released && f.reviewRequired && (f.reviewReasons ?? []).length === 0) {
      v.push(`${f.key}: released value marked reviewRequired but no review reason`)
    }
  }
  return v
}

/**
 * The canonical C3 writer used by services. It NEVER invents a value: it emits the field's
 * finalValue (or null when C3 rejected/held it), preserves review flags, and refuses to release a
 * value that failed `validateC3Input` (that field is forced to null + review). Deterministic, pure.
 */
export function writeCanonical(input: C3Input): ServiceOutput {
  const violations = new Set(validateC3Input(input).map((s) => s.split(':')[0]))
  const fields = input.fields.map((f) => {
    const invalid = violations.has(f.key)
    const value = invalid ? null : (f.finalValue ?? null)
    const reviewRequired = f.reviewRequired || invalid || value === null
    const reasons = [...(f.reviewReasons ?? [])]
    if (invalid) reasons.push('c3_input_invalid')
    return { key: f.key, value, reviewRequired, reviewReasons: reasons }
  })
  return {
    service: input.service,
    docTypeId: input.docTypeId,
    fields,
    reviewRequiredFields: fields.filter((f) => f.reviewRequired).map((f) => f.key),
    requiresReview: input.requiresReview || fields.some((f) => f.reviewRequired),
  }
}
