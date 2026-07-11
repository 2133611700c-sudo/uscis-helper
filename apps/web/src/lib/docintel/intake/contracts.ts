/**
 * intake/contracts.ts — PHASE 2 of the One Brain Foundation: the canonical DECISION spine.
 *
 * Every intake step returns a typed decision that carries its OWN truth-chain
 * (status → trusted → final) so no step can overstate what it knows, and so recognition can be
 * gated on a real decision existing. Enum values come from the Phase-1 canonical registry (single
 * source of truth). Pure types + pure guards — no network, no provider, no I/O.
 *
 * NOTE (no-rewrite rule): the FIELD-level spine already exists and is mature — `FieldCandidate`
 * (canonical/core/types.ts), `CanonicalField`/`CanonicalDocumentResult` (canonical/types.ts). Phase
 * 2 does NOT redefine them; it adds the INTAKE decision layer + a trace model + guards ON TOP, and
 * provides pure validators (`assertCanonicalHasSource`) that the C3 phase will use. Nothing here
 * changes runtime behavior.
 *
 * Design: docs/architecture/DOCUMENT_INTAKE_BRAIN_DESIGN.md.
 */
import type { OrientationTelemetry } from '../orientation/detectOrientation'
import type {
  DocumentTypeId, DocumentFamily, CountryCode, IssuingSystem, ScriptCode, LanguageCode,
  LanguageMode, ReaderRouteId, ProviderId, PageSideId, ReviewPolicy,
} from './canonicalRegistry'

// ─────────────────────────────────────────────────────────────────────────────
// The truth-chain: enabled ≠ attempted ≠ measured ≠ trusted ≠ final
// ─────────────────────────────────────────────────────────────────────────────
export type DecisionStatus =
  | 'not_attempted' // the step never ran (disabled / earlier short-circuit)
  | 'attempted'     // ran but produced no usable measurement
  | 'measured'      // a provider returned a usable result — the ONLY status that may be trusted
  | 'failed'        // ran and errored
  | 'skipped'       // deliberately not run for this document
  | 'unavailable'   // provider/resource not available (e.g. HTR host, Vision billing)

export type IntakeReasonCode =
  | 'not_a_document' | 'low_image_quality' | 'duplicate_upload'
  | 'orientation_not_measured' | 'language_not_measured' | 'language_unknown'
  | 'handwriting_unknown' | 'country_not_measured' | 'country_unknown'
  | 'family_not_measured'
  | 'family_unknown' | 'doc_type_unknown' | 'doc_type_low_confidence'
  | 'handwriting_present' | 'single_provider_classification'
  | 'page_side_not_measured' | 'page_side_unknown' | 'route_requires_human_review'
  | 'user_hint_conflicts_measured' | 'no_reader_route' | 'no_family_metrics_yet'
  | 'provider_unavailable' | 'below_route_confidence' | 'shadow_error'

/** Every decision carries this — its provenance and its own honest certainty. Evidence is a
 *  PII-SAFE pointer/hash or a reason string, NEVER raw document text. */
export interface DecisionBase {
  status: DecisionStatus
  provider: ProviderId | null
  confidence: number | null
  trusted: boolean            // invariant: true ⇒ status === 'measured' (enforced by mkDecision)
  evidence: string | null     // PII-safe (hash/pointer/reason), never raw values
  reasonCodes: IntakeReasonCode[]
  limitations: string[]
  timingMs: number | null
  traceId: string | null
  spanId: string | null
}

export type IntakeStatus = 'rejected' | 'unknown' | 'needs_review' | 'ready'

// ─────────────────────────────────────────────────────────────────────────────
// Per-step decision contracts (each extends DecisionBase)
// ─────────────────────────────────────────────────────────────────────────────
export interface PreflightResult extends DecisionBase {
  isDocument: boolean | null
  mediaType: 'image' | 'pdf' | 'unknown'
  pageCount: number | null
  isFullPage: boolean | null
  quality: 'ok' | 'low' | 'not_measured'
  isDuplicate: boolean | null
}
export interface OrientationDecision extends DecisionBase {
  rotationAppliedCw: 0 | 90 | 180 | 270 | null
  telemetryStatus: OrientationTelemetry['status']
}
export interface LanguageScriptDecision extends DecisionBase {
  primary: LanguageCode
  scripts: ScriptCode[]
  languageMode: LanguageMode
  printedTextPresent: boolean | null
  handwritingPresent: boolean | null
}
export interface CountryDecision extends DecisionBase {
  country: CountryCode
  issuingSystem: IssuingSystem
}
/** family/type are CANDIDATES at intake time (provider proposes; brain decides). */
export interface DocumentFamilyCandidate extends DecisionBase {
  family: DocumentFamily
}
export interface DocumentTypeCandidate extends DecisionBase {
  docTypeId: DocumentTypeId
  candidates: Array<{ doc_type_id: DocumentTypeId; confidence: number }>
}
export interface PageSideDecision extends DecisionBase {
  side: PageSideId
  pageIndex: number | null
}
export interface ReaderRouteDecision extends DecisionBase {
  reader: ReaderRouteId
  needsHTR: boolean
  needsHumanReview: boolean
}
export interface ReviewDecision {
  reviewRequired: boolean
  policy: ReviewPolicy | null
  reasonCodes: IntakeReasonCode[]
}

/** The single object the whole intake produces. */
export interface DocumentIntakeResult {
  status: IntakeStatus
  preflight: PreflightResult
  orientation: OrientationDecision
  language: LanguageScriptDecision
  country: CountryDecision
  family: DocumentFamilyCandidate
  docType: DocumentTypeCandidate
  pageSide: PageSideDecision
  route: ReaderRouteDecision
  review: ReviewDecision
  userHint?: { docTypeId: DocumentTypeId } | null
  traceId: string | null
}

// ─────────────────────────────────────────────────────────────────────────────
// Guards (pure — the invariants live in code, not comments)
// ─────────────────────────────────────────────────────────────────────────────

/** Build a DecisionBase enforcing: trusted is ONLY possible when status==='measured'. A caller
 *  asking for trusted with any other status gets trusted:false (fail-closed, never throws in prod
 *  paths). This is the enabled≠attempted≠measured≠trusted invariant in code. */
export function mkDecision(p: Partial<DecisionBase> & { status: DecisionStatus }): DecisionBase {
  const status = p.status
  const trusted = p.trusted === true && status === 'measured'
  return {
    status,
    provider: p.provider ?? null,
    confidence: p.confidence ?? null,
    trusted,
    evidence: p.evidence ?? null,
    reasonCodes: p.reasonCodes ?? [],
    limitations: p.limitations ?? [],
    timingMs: p.timingMs ?? null,
    traceId: p.traceId ?? null,
    spanId: p.spanId ?? null,
  }
}

/** True iff the decision may be relied on as fact. */
export function isTrustworthy(d: DecisionBase): boolean {
  return d.trusted && d.status === 'measured'
}

/**
 * A canonical field may only carry a finalValue if it has a candidate SOURCE + provider + evidence
 * (or an explicit reason evidence is unavailable) + it was arbitrated. Pure validator the C3 phase
 * uses; returns the list of violations (empty = ok). Works structurally on the existing
 * CanonicalField shape without importing/mutating it.
 */
export function assertCanonicalHasSource(field: {
  key?: string
  finalValue?: string | null
  evidence?: Array<{ source?: string; provider?: string }> | null
  source?: string | null
}): string[] {
  const v: string[] = []
  const hasFinal = field.finalValue !== undefined && field.finalValue !== null
  if (!hasFinal) return v // no final value ⇒ nothing to police
  const ev = field.evidence ?? []
  if (ev.length === 0) v.push(`${field.key ?? '?'}: finalValue set with no evidence/candidate source`)
  if (!field.source) v.push(`${field.key ?? '?'}: finalValue set with no controlling source`)
  const hasProvider = ev.some((e) => !!e.provider)
  if (ev.length > 0 && !hasProvider) v.push(`${field.key ?? '?'}: evidence has no provider`)
  return v
}

/**
 * THE GATE (recognition must not start until an intake decision exists). Recognition may proceed
 * ONLY when the doc was not rejected/unknown and a real reader route is resolved.
 */
export function intakeReadyForRecognition(r: DocumentIntakeResult): boolean {
  if (r.status === 'rejected' || r.status === 'unknown') return false
  if (r.route.reader === 'none' || r.route.reader === 'unknown_reader') return false
  return r.status === 'ready' || r.status === 'needs_review'
}

/** Fail-closed "nothing measured yet" starting decisions. */
export function emptyIntake(): Omit<DocumentIntakeResult, 'status'> {
  const base = mkDecision({ status: 'not_attempted' })
  return {
    preflight: { ...base, isDocument: null, mediaType: 'unknown', pageCount: null, isFullPage: null, quality: 'not_measured', isDuplicate: null },
    orientation: { ...base, rotationAppliedCw: null, telemetryStatus: 'disabled' },
    language: { ...base, primary: 'unknown', scripts: [], languageMode: 'unknown', printedTextPresent: null, handwritingPresent: null },
    country: { ...base, country: 'UNKNOWN', issuingSystem: 'unknown' },
    family: { ...base, family: 'unknown' },
    docType: { ...base, docTypeId: 'unknown', candidates: [] },
    pageSide: { ...base, side: 'unknown', pageIndex: null },
    route: { ...base, reader: 'none', needsHTR: false, needsHumanReview: false },
    review: { reviewRequired: true, policy: null, reasonCodes: [] },
    traceId: null,
  }
}

/**
 * Derive the top-level status + review from composed decisions. Pure and total: the single place
 * intake status is computed (mirrors the orientation-telemetry normalizer pattern).
 */
export function deriveIntakeStatus(
  d: Omit<DocumentIntakeResult, 'status' | 'review'>,
  opts: { docTypeMinConfidence?: number } = {},
): { status: IntakeStatus; review: ReviewDecision } {
  const min = opts.docTypeMinConfidence ?? 0.65
  const reasons: IntakeReasonCode[] = []
  const pushUnique = (reason: IntakeReasonCode) => {
    if (!reasons.includes(reason)) reasons.push(reason)
  }

  if (d.preflight.status === 'measured' && d.preflight.isDocument === false) {
    pushUnique('not_a_document')
    return { status: 'rejected', review: { reviewRequired: true, policy: 'reject_or_retake', reasonCodes: reasons } }
  }
  if (d.preflight.quality === 'low') pushUnique('low_image_quality')
  if (d.preflight.isDuplicate === true) pushUnique('duplicate_upload')

  const typeKnown = d.docType.status === 'measured' && d.docType.docTypeId !== 'unknown'
    && d.docType.docTypeId !== 'unsupported' && d.docType.docTypeId !== 'not_a_document'
  if (!typeKnown) {
    if (d.country.status !== 'measured') pushUnique('country_not_measured')
    if (d.country.country === 'UNKNOWN') pushUnique('country_unknown')
    if (d.family.status !== 'measured') pushUnique('family_not_measured')
    if (d.family.family === 'unknown') pushUnique('family_unknown')
    pushUnique('doc_type_unknown')
    return { status: 'unknown', review: { reviewRequired: true, policy: 'manual_review_required', reasonCodes: reasons } }
  }
  if ((d.docType.confidence ?? 0) < min) pushUnique('doc_type_low_confidence')

  if (d.orientation.status !== 'measured') pushUnique('orientation_not_measured')

  if (d.language.status !== 'measured') pushUnique('language_not_measured')
  if (d.language.primary === 'unknown') pushUnique('language_unknown')
  if (d.language.handwritingPresent === true) pushUnique('handwriting_present')
  if (d.language.handwritingPresent === null) pushUnique('handwriting_unknown')

  if (d.country.status !== 'measured') pushUnique('country_not_measured')
  if (d.country.country === 'UNKNOWN') pushUnique('country_unknown')

  if (d.family.status !== 'measured') pushUnique('family_not_measured')
  if (d.family.family === 'unknown') pushUnique('family_unknown')

  if (d.pageSide.status !== 'measured') pushUnique('page_side_not_measured')
  if (d.pageSide.side === 'unknown') pushUnique('page_side_unknown')

  if (d.route.needsHumanReview) pushUnique('route_requires_human_review')
  if (d.userHint && d.userHint.docTypeId !== d.docType.docTypeId) pushUnique('user_hint_conflicts_measured')
  if (d.route.needsHTR) pushUnique('provider_unavailable')

  if (d.route.reader === 'none' || d.route.reader === 'unknown_reader') {
    pushUnique('no_reader_route')
    return { status: 'unknown', review: { reviewRequired: true, policy: 'manual_review_required', reasonCodes: reasons } }
  }
  const status: IntakeStatus = reasons.length === 0 ? 'ready' : 'needs_review'
  return { status, review: { reviewRequired: status !== 'ready', policy: null, reasonCodes: reasons } }
}

// ─────────────────────────────────────────────────────────────────────────────
// PII-safe serialization
// ─────────────────────────────────────────────────────────────────────────────
/** Keys whose values may carry document text/PII and must be redacted from any log. */
const PII_RISK_KEYS = new Set(['printed_title_seen', 'rawValue', 'raw_cyrillic', 'value', 'finalValue', 'normalizedValue'])

/** Redact PII-risk fields recursively for safe logging of an intake/trace object. Structural: it
 *  keeps decision metadata (status/confidence/reasonCodes/…) and blanks value-bearing keys. */
export function toSafeLog<T>(obj: T): unknown {
  if (obj === null || typeof obj !== 'object') return obj
  if (Array.isArray(obj)) return obj.map((x) => toSafeLog(x))
  const out: Record<string, unknown> = {}
  for (const [k, val] of Object.entries(obj as Record<string, unknown>)) {
    out[k] = PII_RISK_KEYS.has(k) ? (val == null ? val : '[redacted]') : toSafeLog(val)
  }
  return out
}
