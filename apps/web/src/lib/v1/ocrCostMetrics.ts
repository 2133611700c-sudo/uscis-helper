/**
 * ocrCostMetrics — V1 Phase 7-A (P2): OCR/AI provider COST OBSERVABILITY.
 *
 * OBSERVE-ONLY. This module emits PII-free structured cost/usage events at the
 * real external provider call sites so the (currently uncapped) paid-call spend
 * becomes VISIBLE before any cap is enforced. It does NOT cache, NOT substitute,
 * NOT budget-gate, and NOT change any OCR/AI output, retry, or control flow.
 *
 * What is DEFERRED (explicitly NOT in this module / this PR):
 *   - 7-B: cache substitution (look up + serve from lib/v1/ocrCache / ocrCacheStore).
 *   - 7-C: enforced budget (lib/v1/providerBudget.checkBudget as a hard gate).
 * Those live behind staging gates in later PRs. Here we only MEASURE.
 *
 * PII rule (enforced by tests): an event may carry ONLY technical dimensions and
 * a cache_key HASH. It must NEVER carry document bytes, OCR text, field values,
 * applicant names/dates/addresses/document numbers, prompts, or raw responses.
 *
 * The cache_key is the SAME deterministic key the future cache will use
 * (file_sha256 · provider · model · prompt_version · preproc_version) — computed
 * now, in shadow, so we can later measure the would-be cache-hit rate from logs.
 */
import { createHash } from 'node:crypto'
import { AsyncLocalStorage } from 'node:async_hooks'
import { buildOcrCacheKey } from './ocrCache'

// ── Cost table (PUBLIC LIST PRICES — cite source, do NOT invent) ──────────────
//
// Stored as integer USD micros (1 USD = 1_000_000 micros) to avoid float drift.
// These are coarse per-call estimates for OBSERVABILITY only (a later enforced
// cap is the source of truth for spend). Real per-call cost varies with image
// size / token count; these constants make the relative call cost visible.
//
// Sources (public list prices, captured 2026-06-14 — verify before billing use):
//   - Google Cloud Vision DOCUMENT_TEXT_DETECTION: $1.50 / 1000 units (first 5M/mo)
//     https://cloud.google.com/vision/pricing  → $0.0015/call = 1500 micros.
//   - Google Document AI Document OCR processor: $1.50 / 1000 pages
//     https://cloud.google.com/document-ai/pricing → $0.0015/page = 1500 micros.
//   - Gemini (generativelanguage) image+text generateContent: token-priced; a
//     single document page read is on the order of ~$0.002 with current
//     pro/flash image input+output sizes. https://ai.google.dev/pricing
//     → 2000 micros (coarse per-call estimate, NOT a billed amount).
//   - DeepSeek deepseek-chat: token-priced (~$0.27/M in, ~$1.10/M out cache-miss).
//     https://api-docs.deepseek.com/quick_start/pricing → a ~4k-in/2.5k-out
//     crossref/brain call ≈ $0.0040. → 4000 micros (coarse per-call estimate).
//   - DeepSeek deepseek-reasoner: pricier reasoning tier; coarse ≈ $0.008.
//     → 8000 micros.
//
// NOTE: micros are intentionally rounded — they exist to rank call cost and to
// sum "calls × est" per upload, not to reconcile a bill.
export const OCR_COST_TABLE_USD_MICROS: Readonly<Record<string, number>> = Object.freeze({
  google_vision: 1500,
  google_docai: 1500,
  gemini: 2000,
  deepseek_chat: 4000,
  deepseek_reasoner: 8000,
})

/** Look up the coarse list-price estimate for a (provider, model). Unknown → 0
 *  (an unknown provider is still observed; its cost is simply not yet tabled). */
export function estCostUsdMicros(provider: string, model?: string | null): number {
  const m = (model ?? '').toLowerCase()
  if (provider === 'deepseek') {
    if (m.includes('reason')) return OCR_COST_TABLE_USD_MICROS.deepseek_reasoner
    return OCR_COST_TABLE_USD_MICROS.deepseek_chat
  }
  return OCR_COST_TABLE_USD_MICROS[provider] ?? 0
}

export type OcrProviderName = 'google_vision' | 'google_docai' | 'gemini' | 'deepseek'

export type OcrCostCallStatus = 'ok' | 'error'

/** The PII-free event payload. Only these keys are ever logged. */
export type OcrProviderCallEvent = {
  event: 'ocr_provider_call'
  product: string
  route: string
  provider: OcrProviderName | string
  model: string | null
  est_cost_usd_micros: number
  /** sha256 of the SAME 5-part future cache key (file_sha+provider+model+prompt+preproc). */
  cache_key_sha: string
  duration_ms: number
  status: OcrCostCallStatus
  /** Always false in 7-A: this PR never serves from cache (no substitution). */
  cached: boolean
}

export type OcrUploadCostSummaryEvent = {
  event: 'ocr_upload_cost_summary'
  product: string
  route: string
  total_calls: number
  total_est_cost_micros: number
}

/**
 * Compute the SHADOW cache key hash for an upcoming call. Identical inputs →
 * identical hash; any change to file_sha / provider / model / prompt_version /
 * preproc_version → different hash. This is the exact key the future cache uses,
 * hashed so the cleartext sha256 of the document never appears in a log line.
 */
export function computeCacheKeySha(parts: {
  fileSha256: string
  provider: string
  model: string
  promptVersion: string
  preprocVersion: string
}): string {
  const key = buildOcrCacheKey({
    fileSha256: parts.fileSha256,
    provider: parts.provider,
    modelVersion: parts.model,
    promptVersion: parts.promptVersion,
    preprocessingVersion: parts.preprocVersion,
  })
  return createHash('sha256').update(key).digest('hex')
}

/** sha256 of an arbitrary buffer (document image OR text-input payload). The
 *  resulting hex is a stable opaque id, never the content. */
export function sha256Hex(input: Buffer | string): string {
  return createHash('sha256').update(input).digest('hex')
}

// ── PII guard ─────────────────────────────────────────────────────────────────
// Hard allow-list of event keys. Anything outside this set is dropped before a
// line is logged, so a future careless caller cannot smuggle a field value in.
const ALLOWED_CALL_KEYS = new Set<keyof OcrProviderCallEvent>([
  'event', 'product', 'route', 'provider', 'model',
  'est_cost_usd_micros', 'cache_key_sha', 'duration_ms', 'status', 'cached',
])
const ALLOWED_SUMMARY_KEYS = new Set<keyof OcrUploadCostSummaryEvent>([
  'event', 'product', 'route', 'total_calls', 'total_est_cost_micros',
])

function sanitizeCallEvent(e: OcrProviderCallEvent): OcrProviderCallEvent {
  const out = {} as Record<string, unknown>
  for (const k of Object.keys(e) as (keyof OcrProviderCallEvent)[]) {
    if (ALLOWED_CALL_KEYS.has(k)) out[k] = e[k]
  }
  return out as unknown as OcrProviderCallEvent
}

function sanitizeSummaryEvent(e: OcrUploadCostSummaryEvent): OcrUploadCostSummaryEvent {
  const out = {} as Record<string, unknown>
  for (const k of Object.keys(e) as (keyof OcrUploadCostSummaryEvent)[]) {
    if (ALLOWED_SUMMARY_KEYS.has(k)) out[k] = e[k]
  }
  return out as unknown as OcrUploadCostSummaryEvent
}

// Test seam: capture emitted events without parsing stdout.
type Sink = (e: OcrProviderCallEvent | OcrUploadCostSummaryEvent) => void
let _testSink: Sink | null = null
/** TEST ONLY — route events to a sink instead of console. Returns a restore fn. */
export function __setOcrCostMetricsSink(sink: Sink | null): void {
  _testSink = sink
}

// ── Per-request (per-upload) roll-up via AsyncLocalStorage ────────────────────
// A request handler wraps its body in runWithUploadCostTally(); every provider
// call inside that async context auto-accumulates into the request's tally, so
// the "up to N paid calls/upload" total is measurable WITHOUT threading a param
// through every provider boundary. Concurrency-safe (one store per request).
type RequestTally = { calls: number; micros: number }
const _uploadTallyALS = new AsyncLocalStorage<RequestTally>()

/**
 * Run `fn` in a request-scoped cost-tally context, then emit ONE
 * ocr_upload_cost_summary with the total provider calls + est cost. The summary
 * is emitted even if `fn` throws (finally), so a failed upload is still counted.
 * Returns `fn`'s result unchanged.
 */
export async function runWithUploadCostTally<T>(
  meta: { product: string; route: string },
  fn: () => Promise<T>,
): Promise<T> {
  const tally: RequestTally = { calls: 0, micros: 0 }
  try {
    return await _uploadTallyALS.run(tally, fn)
  } finally {
    emitOcrUploadCostSummary({
      event: 'ocr_upload_cost_summary',
      product: meta.product,
      route: meta.route,
      total_calls: tally.calls,
      total_est_cost_micros: tally.micros,
    })
  }
}

/**
 * Emit a single provider-call cost event. NEVER throws (observability must not
 * break the OCR path) and returns the (sanitized) event so a per-upload summary
 * can sum it. PII-free by construction (allow-list). Also folds the call into
 * the active request tally, if one is set.
 */
export function emitOcrCostEvent(e: OcrProviderCallEvent): OcrProviderCallEvent {
  const safe = sanitizeCallEvent({ ...e, cached: false }) // 7-A: never served from cache
  const tally = _uploadTallyALS.getStore()
  if (tally) {
    tally.calls += 1
    tally.micros += safe.est_cost_usd_micros
  }
  try {
    if (_testSink) _testSink(safe)
    else console.info(JSON.stringify(safe))
  } catch {
    /* observability must never throw into the OCR path */
  }
  return safe
}

/** Emit the per-upload roll-up so "up to N paid calls/upload" is measurable. */
export function emitOcrUploadCostSummary(e: OcrUploadCostSummaryEvent): OcrUploadCostSummaryEvent {
  const safe = sanitizeSummaryEvent(e)
  try {
    if (_testSink) _testSink(safe)
    else console.info(JSON.stringify(safe))
  } catch {
    /* never throw */
  }
  return safe
}

/**
 * NON-INVASIVE wrapper around a real provider call. It times the call, emits an
 * event AFTER the call returns (or status='error' on throw), and returns the
 * provider's result UNCHANGED. The result is never read, mutated, or replaced —
 * the OCR output the user receives is byte-identical with or without this wrap.
 *
 * It does NOT look up or substitute any cache (cached:false, always) and does
 * NOT consult any budget. Errors from the wrapped call are re-thrown verbatim so
 * the caller's existing retry/fallback/try-catch behaviour is preserved exactly.
 */
export async function withOcrCostMetrics<T>(
  meta: {
    product: string
    route: string
    provider: OcrProviderName | string
    model: string | null
    cacheKeySha: string
    est_cost_usd_micros: number
  },
  call: () => Promise<T>,
): Promise<T> {
  const t0 = Date.now()
  let status: OcrCostCallStatus = 'ok'
  try {
    const result = await call()
    return result
  } catch (err) {
    status = 'error'
    throw err
  } finally {
    emitOcrCostEvent({
      event: 'ocr_provider_call',
      product: meta.product,
      route: meta.route,
      provider: meta.provider,
      model: meta.model,
      est_cost_usd_micros: meta.est_cost_usd_micros,
      cache_key_sha: meta.cacheKeySha,
      duration_ms: Date.now() - t0,
      status,
      cached: false,
    })
  }
}
