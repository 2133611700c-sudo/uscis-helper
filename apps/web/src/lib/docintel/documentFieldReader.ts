/**
 * docintel/documentFieldReader — the single entry point every product calls.
 *
 *   readDocument(image, mime, 'ua_birth_certificate') → ExtractedDocField[]
 *
 * Orchestrates: registry lookup → vendor-agnostic vision provider → centralized
 * KMU-55 transliteration → canonical, provenance-tracked, review-flagged fields.
 * TPS, ReParole, EAD and Translation all consume the SAME output shape; each
 * adapts it to its own form/translation needs (see adapters/).
 *
 * Candidate-only: review_required is set per field; the consuming product's
 * Review Gate makes values final. Vision failure → ok:false, never throws.
 */

import { getDocTypeSpec } from './documentRegistry'
import { defaultVisionProvider, primaryGeminiModel } from './providers/geminiVisionProvider'
import { openaiVisionProvider, isReaderFallbackEnabled, READER_FALLBACK_TIMEOUT_MS } from './providers/openaiVisionProvider'
import { getGeminiApiKey } from '@/lib/gemini/apiKey'
import { autoOrient } from './orientation/autoOrient'
import { applyDateRoleGuard } from './dates/dateRoleGuard'
import { toCanonicalValue, isNameSourceScriptAmbiguous } from './transliterationPolicy'
import { reconcilePatronymicFields } from './patronymicReconcile'
import { resolveAuthorityFields } from './authorityResolve'
import { applyAntiFabricationGate, HANDWRITTEN_FABRICATION_RISK_CLASSES } from './antiFabricationGate'
import { docintelIdToDocumentClass } from '@/lib/canonical/core/documentClassPolicy'
import { identityHash, decideStatus, applySelfConsistencyOutcome } from './selfConsistency'
import { recordDocumentClassMetric, type MetricProduct } from './documentClassMetric'
import { classifyProviderError } from '@/lib/ocr/ocrErrors'
import { coordinatedDocumentRead } from './coordinatedDocumentRead'
import { OcrCoordinationUnavailable } from '@/lib/v1/ocrCoordination'
import type {
  DocumentReadResult,
  ExtractedDocField,
  ReaderExecutionTrace,
  VisionProvider,
  VisionReadResult,
} from './types'

export async function readDocument(
  imageBuffer: Buffer,
  mimeType: string,
  docTypeId: string,
  opts: {
    provider?: VisionProvider
    timeoutMs?: number
    attemptsPerModel?: number
    product?: MetricProduct
    /** Tenant/session scope bound into the OCR coordination cache key (isolation). */
    cacheScope?: string
  } = {},
): Promise<DocumentReadResult> {
  // Wall-clock start for totalReaderLatencyMs in the ReaderExecutionTrace. Normal
  // app code (not a workflow), so Date.now() is the correct clock here.
  const readerStart = Date.now()

  const spec = getDocTypeSpec(docTypeId)
  if (!spec) {
    return {
      ok: false, doc_type_id: docTypeId, fields: [], anchor_read: false,
      provider: null, model: null, ms: 0, status: 'unknown_document_type',
      error: `No registry entry for "${docTypeId}"`,
    }
  }

  // PII-free document-class metric (logging only; silent unless flag on).
  if (opts.product) recordDocumentClassMetric({ product: opts.product, docTypeId })

  // AUTO_ORIENT_ENABLED (default OFF): correct content rotation BEFORE the read.
  // A real birth cert was photographed sideways (90°) and every engine read the
  // cursive sideways. sharp.rotate() fixes only EXIF; this detects + fixes rotated
  // CONTENT. Fail-open. OFF ⇒ byte-identical, no extra cost.
  let orientApplied = 0
  if (process.env.AUTO_ORIENT_ENABLED === '1') {
    const apiKey = getGeminiApiKey()
    if (apiKey) {
      const oriented = await autoOrient(imageBuffer, apiKey, primaryGeminiModel())
      imageBuffer = oriented.buffer
      orientApplied = oriented.applied
      if (orientApplied) console.info('[auto_orient] rotated', JSON.stringify({ doc_type_id: docTypeId, cw: orientApplied }))
    }
  }

  // OCR COORDINATION (issue #161, OCR_DISTRIBUTED_DEDUP_MODE, default off): the ONE
  // provider call runs through the cross-instance lease + secure cache. off ⇒
  // byte-identical direct call. enforce ⇒ a winner-failure/loser-timeout surfaces
  // OcrCoordinationUnavailable, which we map to an honest non-2xx (never a crash).
  const provider = opts.provider ?? defaultVisionProvider
  // Was a provider injected? Then the "primary" is that injected provider, not the
  // configured Gemini primary — the trace must reflect this honestly (no fabricated
  // gemini attempt). primaryOutcome='skipped' means "configured primary was bypassed".
  const providerInjected = !!opts.provider
  let read
  try {
    read = await coordinatedDocumentRead(imageBuffer, mimeType, spec, docTypeId, provider, {
      timeoutMs: opts.timeoutMs,
      attemptsPerModel: opts.attemptsPerModel,
      tenantScope: opts.cacheScope,
      product: opts.product,
    })
  } catch (err) {
    if (err instanceof OcrCoordinationUnavailable) {
      // Honest trace: the primary was attempted but coordination made it unavailable;
      // no model, no fallback. PII-free, no fabricated values.
      return {
        ok: false, doc_type_id: docTypeId, fields: [], anchor_read: false,
        provider: provider.name, model: null, ms: 0,
        status: `ocr_unavailable:${err.errorClass}`,
        error: err.message,
        provider_error: classifyProviderError(503, undefined, { marker: err.errorClass }),
        reader_trace: {
          configuredPrimaryProvider: providerInjected ? provider.name : 'gemini',
          configuredPrimaryModel: providerInjected ? provider.name : primaryGeminiModel(),
          primaryAttempted: true,
          primaryOutcome: 'failed',
          fallbackAttempted: false,
          fallbackProvider: null,
          fallbackModel: null,
          fallbackOutcome: 'not_attempted',
          finalProvider: provider.name,
          finalModel: null,
          providerCallCount: 0,
          primaryLatencyMs: null,
          fallbackLatencyMs: null,
          totalReaderLatencyMs: Date.now() - readerStart,
        },
      }
    }
    throw err
  }

  // TRUTHFUL TELEMETRY: capture the PRIMARY read outcome BEFORE the fallback block
  // can replace `read`. `primaryRead` is the exact result the configured/injected
  // primary produced; `fallbackRead` is set only if the #13 fallback actually ran.
  const primaryRead: VisionReadResult = read
  const primaryOk = read.ok
  let fallbackRead: VisionReadResult | null = null
  let fallbackAttempted = false

  // ── READER RESILIENCE (ONE_BRAIN_READER_FALLBACK, default OFF) ──────────────
  // On a RETRIABLE primary failure (rate-limit 429 / 5xx / timeout/deadline), try ONE OpenAI
  // fallback read. A fallback read is non-primary ⇒ force-reviewed downstream (fallback_model_used);
  // its fields are candidate-only, never auto-final. Only when no provider was explicitly injected.
  if (!read.ok && !opts.provider && isReaderFallbackEnabled()) {
    const retriable =
      read.errorStatus === 429 || read.errorStatus === 503 || read.errorStatus === 502 ||
      read.errorStatus === 408 || read.errorTimeout === true
    if (retriable) {
      try {
        fallbackAttempted = true
        const fb = await coordinatedDocumentRead(imageBuffer, mimeType, spec, docTypeId, openaiVisionProvider, {
          timeoutMs: Math.min(opts.timeoutMs ?? READER_FALLBACK_TIMEOUT_MS, READER_FALLBACK_TIMEOUT_MS),
          attemptsPerModel: 1,
          tenantScope: opts.cacheScope,
          product: opts.product,
        })
        fallbackRead = fb
        if (fb.ok) read = fb // use the fallback read; non-primary model ⇒ force-reviewed
      } catch {
        // the fallback must NEVER crash the primary read path
      }
    }
  }

  // Build the ONE ReaderExecutionTrace from ACTUAL values. Every API telemetry field
  // derives from this — never from a constant. `fallbackServed` = fallback replaced
  // the returned read; the returned `read` is either the primary or the fallback.
  const fallbackServed = fallbackRead !== null && fallbackRead.ok && read === fallbackRead
  const reader_trace = buildReaderTrace({
    provider, providerInjected, primaryRead, primaryOk,
    fallbackAttempted, fallbackRead, fallbackServed, read,
    totalReaderLatencyMs: Date.now() - readerStart,
  })

  if (!read.ok) {
    // Honest degradation (P1): classify the provider failure into a typed OCR
    // error. A 429 rate-limit / 5xx / timeout is NOT a "successful empty read" —
    // the route inspects provider_error and fails closed (honest non-2xx) instead
    // of returning HTTP 200 + fields:[]. When the failure carries no HTTP status
    // (e.g. 'no GEMINI_API_KEY', 'invalid JSON', 'deadline') we leave
    // provider_error UNSET so the route's existing 0-field handling applies.
    const hasHttpSignal = typeof read.errorStatus === 'number' || read.errorTimeout === true
    const providerError = hasHttpSignal
      ? classifyProviderError(read.errorStatus ?? 0, undefined, {
          timeout: read.errorTimeout === true,
          marker: read.error ?? null,
        })
      : undefined
    return {
      ok: false, doc_type_id: docTypeId, fields: [], anchor_read: false,
      provider: provider.name, model: read.model, ms: read.ms,
      status: `vision_failed:${read.error ?? 'unknown'}`, error: read.error,
      ...(providerError ? { provider_error: providerError } : {}),
      reader_trace,
    }
  }

  const kindByField = new Map(spec.fields.map((f) => [f.field, f.kind]))
  const fields: ExtractedDocField[] = []
  let anchorRead = false

  for (const r of read.fields) {
    if (!r.can_read) continue
    const kind = kindByField.get(r.field)
    if (!kind) continue
    const value = toCanonicalValue(r, kind)
    if (!value) {
      // Phase 2.0 bug-C fix: do NOT silently drop a field when toCanonicalValue
      // fails (e.g. date with no iso_date, agency with no Cyrillic in later fields).
      // If the vision provider DID read something (r.cyrillic non-empty), emit the
      // field as a review-required candidate with the raw Cyrillic as fallback value.
      // D2 will have a chance to normalize it; human review is always required.
      // When r.cyrillic is also empty there is nothing to emit — skip normally.
      if (r.cyrillic) {
        if (r.field === spec.vision_anchor) anchorRead = true
        fields.push({
          field: r.field,
          kind,
          raw_cyrillic: r.cyrillic,
          value: r.cyrillic,  // unresolved canonical; D2 may normalize from Cyrillic
          confidence: Math.max(0, Math.min(1, r.confidence)),
          review_required: true,
          source: 'vision',
          provider: provider.name,
          review_reasons: ['canonical_value_unresolved'],
        })
      }
      continue
    }
    if (r.field === spec.vision_anchor) anchorRead = true
    // SOURCE-SCRIPT GATE (owner-locked 2026-06-10): a name whose VISIBLE source
    // script is not confirmed (no distinctive UA і/ї/є/ґ nor RU ы/э/ё/ъ) is
    // AMBIGUOUS — visible source controls transliteration, ambiguity blocks final.
    // `value` stays a best-effort KMU-55 candidate (screen isn't empty), but we
    // force review + reason so C3 will not finalize it until the script is
    // confirmed. Better a noisy review than a clean PDF with the wrong name.
    const ambiguousScript = kind === 'name' && isNameSourceScriptAmbiguous(r.cyrillic ?? '')
    fields.push({
      field: r.field,
      kind,
      raw_cyrillic: r.cyrillic || null,
      value,
      confidence: Math.max(0, Math.min(1, r.confidence)),
      // Handwritten fields ALWAYS require human confirmation; printed fields
      // require it below high confidence (v5 §19 critical-field gate);
      // ambiguous source script always reviews (source_script_ambiguous).
      review_required: isHandwritten(spec, r.field) || ambiguousScript ? true : r.confidence < 0.95,
      source: 'vision',
      provider: provider.name,
      ...(ambiguousScript ? { review_reasons: ['source_script_ambiguous'] } : {}),
    })
  }

  // REGISTRY BACKFILL (2026-06-11, owner live test): an unread field
  // (can_read:false, or omitted by the model, or empty cyrillic) used to vanish
  // from the response entirely — the UI then showed 5 of 6 booklet fields and a
  // missing patronymic was indistinguishable from "this doc type has no
  // patronymic". Every registry field now ALWAYS appears: unread → value:null +
  // review_required ("enter manually" row). Guarded by fields.length>0 so a
  // totally failed read still reports 0 fields (ok:false semantics unchanged).
  if (fields.length > 0) {
    const present = new Set(fields.map((f) => f.field))
    for (const f of spec.fields) {
      if (present.has(f.field)) continue
      fields.push({
        field: f.field,
        kind: f.kind,
        raw_cyrillic: null,
        value: null,
        confidence: 0,
        review_required: true,
        source: 'vision',
        provider: provider.name,
        review_reasons: ['not_read_manual_entry'],
      })
    }
  }

  // MODEL MATRIX (ADR-018): only the configured primary model is a trusted
  // reader for Cyrillic documents. When the provider fell back (primary
  // timeout/5xx → flash), every field becomes review-required: gemini-2.5-flash
  // was DISQUALIFIED on certificate docs (read a DIFFERENT person — 2026-06-02
  // adjudication). Deterministic, no flag: a fallback read is never silent.
  if (spec.script !== 'latin' && read.model !== null && read.model !== primaryGeminiModel()) {
    for (const f of fields) {
      f.review_required = true
      f.review_reasons = [...(f.review_reasons ?? []), 'fallback_model_used']
    }
    // Observability (P1): PII-free signal — ids + counts only, never field values.
    // Lets prod monitors see fallback-rate without exposing any document content.
    console.warn('[ADR018] fallback_model_used', JSON.stringify({
      doc_type_id: docTypeId, model: read.model, primary: primaryGeminiModel(), fields: fields.length,
    }))
  }

  // SMART_NORMALIZE_ENABLED (default OFF): document-level post-passes that need
  // the full field set (the per-field toCanonicalValue has no sibling context
  // and returns a bare string, dropping any review signal).
  //   P2.2 — reconcile patronymic vs sibling given name + inferred sex.
  //   P2.3 — resolve issuing authority (agency) via the sourced registry.
  // No silent correction; never lowers a review flag. Flag OFF → fields untouched.
  let finalFields =
    process.env.SMART_NORMALIZE_ENABLED === '1'
      ? resolveAuthorityFields(reconcilePatronymicFields(fields))
      : fields

  // ANTI_FABRICATION_GATE_ENABLED (default OFF): on hard-case document classes,
  // force review on identity/document-critical fields (the model's own
  // review_required=false is not trusted there). Only raises review; never
  // changes values. Applied here so all 4 products inherit it via this one door.
  if (process.env.ANTI_FABRICATION_GATE_ENABLED === '1') {
    finalFields = applyAntiFabricationGate(finalFields, docTypeId)
  }

  // SELF_CONSISTENCY_GATE_ENABLED (default OFF): instability detector for the
  // handwritten-risk allowlist. Acts ONLY when ANTI_FABRICATION_GATE_ENABLED is
  // also ON (no hidden second reads / paid behavior). Re-reads the SAME image with
  // the SAME provider, compares the raw-identity hash; disagreement / incomplete /
  // sparse → force review on identity fields (NEVER changes values, NEVER claims
  // correctness; agreement does NOT lower review). NOT a majority vote.
  let selfConsistency: DocumentReadResult['self_consistency']
  const scOn =
    process.env.ANTI_FABRICATION_GATE_ENABLED === '1' &&
    process.env.SELF_CONSISTENCY_GATE_ENABLED === '1' &&
    HANDWRITTEN_FABRICATION_RISK_CLASSES.has(docintelIdToDocumentClass(docTypeId))
  if (scOn) {
    const runs = Math.min(4, Math.max(2, Number(process.env.SELF_CONSISTENCY_RUNS) || 2))
    const scTimeout = Number(process.env.SELF_CONSISTENCY_TIMEOUT_MS) || opts.timeoutMs
    const first = identityHash(read.fields)
    const others: Array<{ hash: string; count: number } | null> = []
    if (first.count >= 2) {
      for (let i = 1; i < runs; i++) {
        try {
          const r2 = await provider.readFields(imageBuffer, mimeType, spec, { timeoutMs: scTimeout })
          others.push(r2.ok ? identityHash(r2.fields) : null)
        } catch {
          others.push(null)
        }
      }
    }
    const status = decideStatus(first, others)
    finalFields = applySelfConsistencyOutcome(finalFields, status)
    selfConsistency = {
      status,
      instability: status === 'mismatch',
      identity_hash_prefix: first.hash.slice(0, 12),
      runs,
    }
  }

  // DATE-ROLE GUARD (deterministic, no flag): catch role conflation (one date
  // copied into two role fields) and sequence conflicts (issue before birth).
  // Only raises review; never edits a value or lowers a flag. All products inherit it.
  const dateGuard = applyDateRoleGuard(finalFields)
  finalFields = dateGuard.fields
  if (dateGuard.conflicts.length) {
    console.info('[date_role_guard]', JSON.stringify({ doc_type_id: docTypeId, conflicts: dateGuard.conflicts }))
  }

  return {
    ok: true, doc_type_id: docTypeId, fields: finalFields, anchor_read: anchorRead,
    provider: provider.name, model: read.model, ms: read.ms,
    status: `ok:${read.model}:${read.ms}ms:${fields.length}f`,
    ...(selfConsistency ? { self_consistency: selfConsistency } : {}),
    reader_trace,
  }
}

/**
 * Build the single ReaderExecutionTrace from ACTUAL read results. PII-free: only
 * provider names, model ids, latencies and counts — never field values or OCR text.
 *
 * When a provider was injected (opts.provider), it IS the primary: configuredPrimary
 * reflects the injected provider and its real model, and primaryOutcome is
 * 'skipped'/... honestly — we do NOT fabricate a gemini attempt that never happened.
 */
function buildReaderTrace(args: {
  provider: VisionProvider
  providerInjected: boolean
  primaryRead: VisionReadResult
  primaryOk: boolean
  fallbackAttempted: boolean
  fallbackRead: VisionReadResult | null
  fallbackServed: boolean
  read: VisionReadResult
  totalReaderLatencyMs: number
}): ReaderExecutionTrace {
  const {
    provider, providerInjected, primaryRead, primaryOk,
    fallbackAttempted, fallbackRead, fallbackServed, read, totalReaderLatencyMs,
  } = args

  // configuredPrimary: the configured Gemini primary normally; the injected provider
  // (+ its actual read model) when one was injected — honest either way.
  const configuredPrimaryProvider = providerInjected ? provider.name : 'gemini'
  const configuredPrimaryModel = providerInjected
    ? (primaryRead.model ?? provider.name)
    : primaryGeminiModel()

  // primaryOutcome: 'skipped' iff a provider was injected AND it is NOT gemini —
  // i.e. the CONFIGURED gemini primary was bypassed (there is no READER_PROVIDER
  // mode; an injected provider is the only way this happens). Otherwise it reflects
  // the real read. `primaryAttempted=false` marks the configured primary as bypassed.
  const configuredPrimaryBypassed = providerInjected && provider.name !== 'gemini'
  const primaryOutcome: ReaderExecutionTrace['primaryOutcome'] =
    configuredPrimaryBypassed ? 'skipped' : (primaryOk ? 'success' : 'failed')

  // Real HTTP attempts the returned read op made (from the provider counter). This
  // ALWAYS reflects the actual calls — including an injected provider's calls — so
  // providerCallCount is honest even when the configured gemini primary was bypassed.
  const primaryAttemptCount = primaryRead.attempts ?? 1

  const fallbackProvider = fallbackAttempted ? openaiVisionProvider.name : null
  const fallbackModel = fallbackRead && fallbackRead.ok ? fallbackRead.model : null
  const fallbackOutcome: ReaderExecutionTrace['fallbackOutcome'] =
    !fallbackAttempted ? 'not_attempted' : (fallbackRead && fallbackRead.ok ? 'success' : 'failed')
  const fallbackAttemptCount = fallbackAttempted ? (fallbackRead?.attempts ?? 1) : 0

  // finalProvider/finalModel: derived from the read actually returned. If the
  // fallback served ⇒ openai/fb.model; else the primary provider + its real model.
  const finalProvider = fallbackServed ? openaiVisionProvider.name : provider.name
  const finalModel = read.model

  return {
    configuredPrimaryProvider,
    configuredPrimaryModel,
    primaryAttempted: !configuredPrimaryBypassed,
    primaryOutcome,
    fallbackAttempted,
    fallbackProvider,
    fallbackModel,
    fallbackOutcome,
    finalProvider,
    finalModel,
    providerCallCount: primaryAttemptCount + fallbackAttemptCount,
    primaryLatencyMs: primaryRead.ms,
    fallbackLatencyMs: fallbackRead ? fallbackRead.ms : null,
    totalReaderLatencyMs,
  }
}

function isHandwritten(spec: ReturnType<typeof getDocTypeSpec>, field: string): boolean {
  return !!spec?.fields.find((f) => f.field === field)?.handwritten
}
