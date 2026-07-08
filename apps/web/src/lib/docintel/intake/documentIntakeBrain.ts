/**
 * documentIntakeBrain.ts — PHASE 3: the ordered intake orchestrator.
 *
 * Runs the canonical funnel IN ORDER and returns ONE DocumentIntakeResult + a trace, BEFORE any
 * recognition. Order: preflight → orientation → language/script → country → family/type → page-side
 * → reader-route. Language/country/family narrow the type candidates (funnel). Provider proposes;
 * the brain decides against the Phase-1 registry; nothing is trusted unless measured; recognition is
 * gated by `intakeReadyForRecognition`.
 *
 * DECOUPLED + TESTABLE: the actual model/OCR calls are injected as `IntakeProviders` (Phase 4
 * concern), so this module has NO network/provider/key coupling and is fully mock-tested. It is a
 * NEW standalone module — wired into no route here (Phase 7 does integration). No behavior change.
 */
import {
  CANONICAL_DOCUMENT_REGISTRY as REG, getCanonicalEntry,
  type DocumentTypeId, type DocumentFamily, type CountryCode, type IssuingSystem,
  type ScriptCode, type LanguageCode, type LanguageMode, type PageSideId, type ProviderId,
} from './canonicalRegistry'
import {
  mkDecision, deriveIntakeStatus, type DocumentIntakeResult,
  type PreflightResult, type OrientationDecision, type LanguageScriptDecision, type CountryDecision,
  type DocumentFamilyCandidate, type DocumentTypeCandidate, type PageSideDecision, type ReaderRouteDecision,
} from './contracts'
import { startTrace, addSpan, type OneBrainTrace, type SpanName, type SpanStatus } from './trace'
import type { OrientationTelemetry } from '../orientation/detectOrientation'

// ── Provider input/output shapes (candidates the brain validates) ──
export interface IntakeProviders {
  preflight(buf: Buffer): Promise<{ isDocument: boolean | null; mediaType: 'image' | 'pdf' | 'unknown'; pageCount: number | null; isFullPage: boolean | null; quality: 'ok' | 'low' | 'not_measured'; isDuplicate: boolean | null; provider?: ProviderId | null; timingMs?: number }>
  orient(buf: Buffer): Promise<{ rotationAppliedCw: 0 | 90 | 180 | 270 | null; telemetryStatus: OrientationTelemetry['status']; provider: ProviderId | null; measured: boolean; trusted: boolean; timingMs?: number }>
  language(buf: Buffer): Promise<{ primary: LanguageCode; scripts: ScriptCode[]; languageMode?: LanguageMode; printedTextPresent: boolean | null; handwritingPresent: boolean | null; confidence: number; provider: ProviderId | null; measured: boolean; timingMs?: number }>
  country(buf: Buffer): Promise<{ country: CountryCode; issuingSystem: IssuingSystem; confidence: number; evidence: string | null; provider: ProviderId | null; measured: boolean; timingMs?: number }>
  /** classify is HANDED the country-scoped allowed type ids — it may only choose among them or 'unknown'. */
  classify(buf: Buffer, allowed: DocumentTypeId[]): Promise<{ docTypeId: DocumentTypeId; family: DocumentFamily; candidates: Array<{ doc_type_id: DocumentTypeId; confidence: number }>; confidence: number; provider: ProviderId | null; measured: boolean; timingMs?: number }>
  pageSide?(buf: Buffer): Promise<{ side: PageSideId; pageIndex: number | null; provider: ProviderId | null; measured: boolean; timingMs?: number }>
}

export interface IntakeOpts {
  traceId?: string
  userHint?: { docTypeId: DocumentTypeId } | null
  docTypeMinConfidence?: number
}

/** Registry funnel: which canonical types are reachable for a detected country (UNKNOWN widens to all). */
export function canonicalTypesForCountry(country: CountryCode): DocumentTypeId[] {
  const real = Object.values(REG).filter((e) => e.family !== 'unknown' && e.family !== 'not_a_document')
  if (country === 'UNKNOWN') return real.map((e) => e.id)
  return real.filter((e) => e.countries.includes(country)).map((e) => e.id)
}

/** Reader route + review flags come FROM the registry entry for the resolved type (registry constrains). */
export function resolveReaderRouteFromRegistry(docTypeId: DocumentTypeId, handwritingPresent: boolean | null): Pick<ReaderRouteDecision, 'reader' | 'needsHTR' | 'needsHumanReview'> {
  const e = getCanonicalEntry(docTypeId)
  const forcedHw = e.handwritingPolicy === 'force_review'
  const conditionalHw = e.handwritingPolicy === 'force_review_if_handwritten' && handwritingPresent === true
  const needsHTR = (forcedHw || conditionalHw) && e.externalBlockers.some((b) => b.includes('htr'))
  const needsHumanReview = forcedHw || conditionalHw
    || e.reviewPolicy === 'manual_review_required' || e.reviewPolicy === 'reject_or_retake'
  return { reader: e.readerRoute, needsHTR, needsHumanReview }
}

/** Run the ordered intake funnel. Pure orchestration over injected providers. */
export async function analyzeIntake(buffer: Buffer, providers: IntakeProviders, opts: IntakeOpts = {}): Promise<{ result: DocumentIntakeResult; trace: OneBrainTrace }> {
  const traceId = opts.traceId ?? 'intake'
  let trace = startTrace(traceId)
  let clock = 0
  const span = (name: SpanName, status: SpanStatus, ms: number | undefined, provider: ProviderId | null, decision: string | null, reasonCodes: string[] = []) => {
    const start = clock
    const end = clock + (ms ?? 0)
    clock = end
    trace = addSpan(trace, { name, status, startMs: start, endMs: end, provider: provider ?? null, decision, reasonCodes })
  }

  // ── 0. Preflight ──
  let preflight: PreflightResult
  try {
    const p = await providers.preflight(buffer)
    preflight = { ...mkDecision({ status: 'measured', provider: p.provider ?? null, timingMs: p.timingMs ?? null, traceId }), isDocument: p.isDocument, mediaType: p.mediaType, pageCount: p.pageCount, isFullPage: p.isFullPage, quality: p.quality, isDuplicate: p.isDuplicate }
    span('preflight', 'ok', p.timingMs, p.provider ?? null, `isDocument=${p.isDocument} quality=${p.quality}`)
  } catch {
    preflight = { ...mkDecision({ status: 'failed', traceId }), isDocument: null, mediaType: 'unknown', pageCount: null, isFullPage: null, quality: 'not_measured', isDuplicate: null }
    span('preflight', 'failed', 0, null, null, ['preflight_failed'])
  }

  // Short-circuit: not a document → rejected (no further steps, no recognition).
  if (preflight.status === 'measured' && preflight.isDocument === false) {
    const empty = buildEmptyDownstream(traceId)
    const composed = { preflight, ...empty, userHint: opts.userHint ?? null, traceId }
    const { status, review } = deriveIntakeStatus(composed, { docTypeMinConfidence: opts.docTypeMinConfidence })
    span('intake', 'ok', 0, null, `status=${status}`)
    return { result: { status, ...composed, review }, trace }
  }

  // ── 1. Orientation ──
  let orientation: OrientationDecision
  try {
    const o = await providers.orient(buffer)
    orientation = { ...mkDecision({ status: o.measured ? 'measured' : 'attempted', provider: o.provider, trusted: o.trusted, timingMs: o.timingMs ?? null, traceId }), rotationAppliedCw: o.rotationAppliedCw, telemetryStatus: o.telemetryStatus }
    span('orientation', o.measured ? 'ok' : 'failed', o.timingMs, o.provider, `cw=${o.rotationAppliedCw}`)
  } catch {
    orientation = { ...mkDecision({ status: 'failed', traceId }), rotationAppliedCw: null, telemetryStatus: 'attempted_failed' }
    span('orientation', 'failed', 0, null, null)
  }

  // ── 2. Language / script ──
  let language: LanguageScriptDecision
  try {
    const l = await providers.language(buffer)
    language = { ...mkDecision({ status: l.measured ? 'measured' : 'attempted', provider: l.provider, confidence: l.confidence, timingMs: l.timingMs ?? null, traceId }), primary: l.primary, scripts: l.scripts, languageMode: l.languageMode ?? 'unknown', printedTextPresent: l.printedTextPresent, handwritingPresent: l.handwritingPresent }
    span('language', l.measured ? 'ok' : 'failed', l.timingMs, l.provider, `lang=${l.primary} hw=${l.handwritingPresent}`)
  } catch {
    language = { ...mkDecision({ status: 'failed', traceId }), primary: 'unknown', scripts: [], languageMode: 'unknown', printedTextPresent: null, handwritingPresent: null }
    span('language', 'failed', 0, null, null)
  }

  // ── 3. Country ──
  let country: CountryDecision
  try {
    const c = await providers.country(buffer)
    country = { ...mkDecision({ status: c.measured ? 'measured' : 'attempted', provider: c.provider, confidence: c.confidence, evidence: c.evidence, timingMs: c.timingMs ?? null, traceId }), country: c.country, issuingSystem: c.issuingSystem }
    span('country', c.measured ? 'ok' : 'failed', c.timingMs, c.provider, `country=${c.country}`)
  } catch {
    country = { ...mkDecision({ status: 'failed', traceId }), country: 'UNKNOWN', issuingSystem: 'unknown' }
    span('country', 'failed', 0, null, null)
  }

  // ── 4. Family / type (FUNNEL: scoped by country) ──
  const allowed = canonicalTypesForCountry(country.country)
  let docType: DocumentTypeCandidate
  let family: DocumentFamilyCandidate
  try {
    const t = await providers.classify(buffer, allowed)
    // registry constraint: the chosen id must be an allowed, real type — else fail closed to unknown.
    const chosen: DocumentTypeId = allowed.includes(t.docTypeId) ? t.docTypeId : 'unknown'
    const chosenFamily: DocumentFamily = chosen === 'unknown' ? 'unknown' : getCanonicalEntry(chosen).family
    docType = { ...mkDecision({ status: t.measured ? 'measured' : 'attempted', provider: t.provider, confidence: t.confidence, timingMs: t.timingMs ?? null, traceId }), docTypeId: chosen, candidates: t.candidates.filter((c) => allowed.includes(c.doc_type_id)) }
    family = { ...mkDecision({ status: t.measured ? 'measured' : 'attempted', provider: t.provider, confidence: t.confidence, traceId }), family: chosenFamily }
    span('family', t.measured ? 'ok' : 'failed', 0, t.provider, `family=${chosenFamily}`)
    span('type', t.measured ? 'ok' : 'failed', t.timingMs, t.provider, `type=${chosen} conf=${t.confidence}`)
  } catch {
    docType = { ...mkDecision({ status: 'failed', traceId }), docTypeId: 'unknown', candidates: [] }
    family = { ...mkDecision({ status: 'failed', traceId }), family: 'unknown' }
    span('family', 'failed', 0, null, null); span('type', 'failed', 0, null, null)
  }

  // ── 5. Page side (optional) ──
  let pageSide: PageSideDecision
  if (providers.pageSide) {
    try {
      const ps = await providers.pageSide(buffer)
      pageSide = { ...mkDecision({ status: ps.measured ? 'measured' : 'attempted', provider: ps.provider, timingMs: ps.timingMs ?? null, traceId }), side: ps.side, pageIndex: ps.pageIndex }
      span('page_side', ps.measured ? 'ok' : 'failed', ps.timingMs, ps.provider, `side=${ps.side}`)
    } catch {
      pageSide = { ...mkDecision({ status: 'failed', traceId }), side: 'unknown', pageIndex: null }
      span('page_side', 'failed', 0, null, null)
    }
  } else {
    pageSide = { ...mkDecision({ status: 'skipped', traceId }), side: 'unknown', pageIndex: null }
    span('page_side', 'skipped', 0, null, null)
  }

  // ── 6. Reader route (FROM registry) ──
  const rr = resolveReaderRouteFromRegistry(docType.docTypeId, language.handwritingPresent)
  const route: ReaderRouteDecision = { ...mkDecision({ status: docType.status === 'measured' ? 'measured' : 'attempted', traceId }), reader: rr.reader, needsHTR: rr.needsHTR, needsHumanReview: rr.needsHumanReview }
  span('reader_route', 'ok', 0, null, `reader=${rr.reader} htr=${rr.needsHTR}`)

  // ── Compose + derive status ──
  const composed = { preflight, orientation, language, country, family, docType, pageSide, route, userHint: opts.userHint ?? null, traceId }
  const { status, review } = deriveIntakeStatus(composed, { docTypeMinConfidence: opts.docTypeMinConfidence })
  span('review_policy', 'ok', 0, null, `status=${status} reasons=${review.reasonCodes.length}`)
  return { result: { status, ...composed, review }, trace }
}

function buildEmptyDownstream(traceId: string): Omit<DocumentIntakeResult, 'status' | 'preflight' | 'review'> {
  const base = mkDecision({ status: 'skipped', traceId })
  return {
    orientation: { ...base, rotationAppliedCw: null, telemetryStatus: 'disabled' },
    language: { ...base, primary: 'unknown', scripts: [], languageMode: 'unknown', printedTextPresent: null, handwritingPresent: null },
    country: { ...base, country: 'UNKNOWN', issuingSystem: 'unknown' },
    family: { ...base, family: 'unknown' },
    docType: { ...base, docTypeId: 'unknown', candidates: [] },
    pageSide: { ...base, side: 'unknown', pageIndex: null },
    route: { ...base, reader: 'none', needsHTR: false, needsHumanReview: false },
    userHint: null,
    traceId,
  }
}
