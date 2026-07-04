/**
 * recognizeDocument — the ONE internal orchestrator (One-Brain plan, STEP D).
 *
 * This is an EXTRACTION (not a rebuild) of the recognition spine that the four
 * product routes currently inline identically:
 *   per page: readDocument(...) → buildCyrillicMap + docintelToCandidate
 *   → fail-closed if no candidate AND a provider error occurred
 *   → applyKnowledgeBrainIfEnabled(candidates, buildKnowledgeContext)
 *   → buildCanonicalResult(...)
 *
 * It composes the EXISTING exported functions in the SAME order with the SAME
 * arguments, so wiring a route to it is byte-identical (the cutover is a later,
 * gated step — STEP E/G — this module changes NO route yet).
 *
 * The facade stays `readDocument` per product; this is the internal orchestration
 * function behind it. There is intentionally NO new public RecognitionOrchestrator
 * and NO new canonical type — it returns the existing CanonicalDocumentResult.
 */
import { readDocument } from './documentFieldReader'
import type { ExtractedDocField } from './types'
import { docintelToCandidate, buildCyrillicMap } from '@/lib/canonical/core/translationAdapter'
import { buildKnowledgeContext, applyKnowledgeBrainIfEnabled } from '@/lib/canonical/core/knowledgeBrain'
import { buildCanonicalResult } from '@/lib/canonical/core/buildCanonicalResult'
import type { CanonicalDocumentResult } from '@/lib/canonical/types'
import type { FieldCandidate } from '@/lib/canonical/core/types'
import { templateEvidenceForDocType } from './evidence/evidenceAdapters'
import type { EvidenceRegion } from './evidence/EvidenceRegion'
import { disabledEvidenceProvider, type EvidenceProvider } from './evidence/evidenceProvider'
import { readerResultFromExtracted, observationToCandidate } from './readers/ReaderResult'

/**
 * Populate ExtractedDocField.evidenceRegions from an evidence-only provider (geometry only).
 * Fails SAFE: provider unavailable / throws / no region for a field → that field is returned
 * UNCHANGED, so semantic extraction is never harmed and template fallback can still apply.
 */
async function attachProviderEvidence(
  fields: ExtractedDocField[],
  page: RecognizePage,
  provider: EvidenceProvider,
): Promise<ExtractedDocField[]> {
  const values = fields
    .filter((f) => (f.value ?? '').trim() !== '')
    .map((f) => ({ key: f.field, value: f.value as string }))
  if (values.length === 0) return fields
  let res
  try {
    res = await provider.locateEvidence({ document: { buffer: page.buffer, mime: page.mime }, fields: values })
  } catch {
    return fields // provider threw → semantic fields preserved
  }
  if (res.status !== 'available') return fields
  return fields.map((f) => {
    const regions = res.regionsByField[f.field]
    return regions && regions.length > 0 ? { ...f, evidenceRegions: regions } : f
  })
}

/** The exact shape readDocument resolves to (no separate exported alias exists). */
type ReadDocumentResult = Awaited<ReturnType<typeof readDocument>>
type ProviderErr = NonNullable<ReadDocumentResult['provider_error']>

/**
 * Cutover flag (STEP E). Default OFF → routes keep their inline sequence
 * (byte-identical). ON → the route delegates recognition to recognizeDocument.
 */
export function isOneBrainRecognizeEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.ONE_BRAIN_RECOGNIZE_ENABLED === '1'
}

export interface RecognizePage {
  buffer: Buffer
  mime: string
  /** per-page read opts (e.g. translation's per-page forensic + originalBuffer); merged over global readOpts. */
  readOpts?: Record<string, unknown>
}

export interface RecognizeInput {
  pages: RecognizePage[]
  docTypeId: string
  product: 'translation' | 'tps' | 'ead' | 'reparole'
  documentSessionId?: string
  /** extra candidates injected before arbitration (e.g. MRZ authority) — product-specific, optional. */
  extraCandidates?: FieldCandidate[]
  readOpts?: Record<string, unknown>
  /** injectable reader for tests — defaults to the real readDocument. */
  reader?: typeof readDocument
  /**
   * Injectable EVIDENCE-ONLY visual-geometry provider. Default = disabledEvidenceProvider
   * (no external call → byte-identical). Populates ExtractedDocField.evidenceRegions BEFORE
   * candidate conversion; only runs when ONE_BRAIN_EVIDENCE_ENABLED === '1'. Provider geometry
   * beats template (template attach below skips candidates that already carry visualEvidence).
   */
  evidenceProvider?: EvidenceProvider
  /**
   * ONE-BRAIN v2 Phase 7 — retry-on-empty policy. When the first read pass yields ZERO
   * usable candidates, re-read every page ONCE with these merged readOpts (e.g. a longer
   * timeout / preprocessing variant). This folds the translation route's separate
   * "0 fields → second readDocument" legacy-fallback plane into the SINGLE door as a retry,
   * not a parallel plane. Gated by RECOGNIZE_RETRY_ON_EMPTY==='1' AND presence of this
   * option → absent/OFF = exactly one pass = byte-identical.
   */
  retryOnEmpty?: { readOpts: Record<string, unknown> }
  createdAt?: string
}

export interface RecognizeOutput {
  /** 'ok' = at least one usable candidate (or a clean empty read). 'unavailable' = fail-closed. */
  status: 'ok' | 'unavailable'
  canonicalResult: CanonicalDocumentResult | null
  cyrillicMap: Map<string, string>
  providerErrors: ProviderErr[]
  pageResults: Array<{ page: number; ok: boolean; status: string; ms: number; model: string | null; provider: string | null }>
  /** candidates BEFORE arbitration — lets a route distinguish "0 fields read" from "arbitration empty". */
  candidateCount: number
}

/**
 * Run the recognition spine. Pure composition of existing functions; the only I/O
 * is the injected reader (readDocument). No HTTP shaping — routes keep that.
 */
export async function recognizeDocument(input: RecognizeInput): Promise<RecognizeOutput> {
  const reader = input.reader ?? readDocument
  const evidenceProvider = input.evidenceProvider ?? disabledEvidenceProvider
  const evidenceEnabled = process.env.ONE_BRAIN_EVIDENCE_ENABLED === '1'
  const cyrillicMap = new Map<string, string>()
  // READ candidates only — the "fields read" set the routes gate their no-fields
  // error on (BEFORE any product extraCandidates like MRZ are injected).
  const readCandidates: FieldCandidate[] = []
  const providerErrors: ProviderErr[] = []
  const pageResults: RecognizeOutput['pageResults'] = []

  const readPass = (extraOpts: Record<string, unknown>) =>
    Promise.all(
      input.pages.map(async (p, i) => {
        const r = (await reader(p.buffer, p.mime, input.docTypeId, {
          product: input.product,
          ...(input.readOpts ?? {}),
          ...(p.readOpts ?? {}),
          ...extraOpts,
        })) as ReadDocumentResult
        return { i, r }
      }),
    )

  let reads = await readPass({})
  // ONE-BRAIN v2 Phase 7 — retry-on-empty (single door replaces the route's 2nd-reader plane).
  // Only when the FIRST pass produced no usable fields on any page AND the policy is enabled.
  if (
    process.env.RECOGNIZE_RETRY_ON_EMPTY === '1' &&
    input.retryOnEmpty &&
    reads.every(({ r }) => !(r.ok && Array.isArray(r.fields) && r.fields.length > 0))
  ) {
    console.info('[recognize_retry_on_empty]', JSON.stringify({ product: input.product, doc_type_id: input.docTypeId }))
    reads = await readPass(input.retryOnEmpty.readOpts)
  }

  for (const { i, r } of reads) {
    pageResults.push({
      page: i + 1,
      ok: r.ok,
      status: r.status,
      ms: r.ms,
      model: r.model ?? null,
      provider: r.provider ?? null,
    })
    if (r.ok && Array.isArray(r.fields)) {
      buildCyrillicMap(r.fields).forEach((v: string, k: string) => { if (!cyrillicMap.has(k)) cyrillicMap.set(k, v) })
      // EVIDENCE PRODUCER (before candidate conversion): a localizing provider locates the
      // already-read values on THIS page and populates ExtractedDocField.evidenceRegions.
      // Default provider is disabled (no call → byte-identical); provider unavailable/error
      // leaves fields UNCHANGED (semantic extraction never harmed) so template fallback applies.
      const fields = evidenceEnabled
        ? await attachProviderEvidence(r.fields, input.pages[i], evidenceProvider)
        : r.fields
      // ReaderResult is now the ONE internal observation seam of recognizeDocument.
      // This is a structural refactor only: readerResultSeam.parity.test freezes byte
      // parity against the old direct docintelToCandidate path, so product behavior
      // remains unchanged while the internal spine loses a fork.
      const rr = readerResultFromExtracted(fields, r.model ?? null, r.ms)
      const providerName = (fields[0] as ExtractedDocField | undefined)?.provider ?? 'gemini'
      readCandidates.push(...rr.fields.map((o) => observationToCandidate(o, i + 1, providerName)))
    } else if (r.provider_error) {
      providerErrors.push(r.provider_error)
    }
  }

  // VISUAL-EVIDENCE CARRIAGE (flag ONE_BRAIN_EVIDENCE_ENABLED): if a localizing reader
  // did not already attach provider geometry to a candidate, attach deterministic key-free
  // TEMPLATE evidence by field key so it rides the SAME candidate → arbitration →
  // CanonicalField.visualEvidence → FieldOut path (first-class), NOT a route-local post-hoc
  // splice. Provider geometry (when present) is NEVER overwritten. OFF / no template → no
  // change (byte-identical). §12 priority: provider evidence already on the candidate wins.
  if (process.env.ONE_BRAIN_EVIDENCE_ENABLED === '1' && readCandidates.length > 0) {
    const tmpl = templateEvidenceForDocType(input.docTypeId)
    if (tmpl.length > 0) {
      const byKey = new Map<string, EvidenceRegion[]>()
      for (const r of tmpl) { const a = byKey.get(r.fieldKey) ?? []; a.push(r); byKey.set(r.fieldKey, a) }
      for (const c of readCandidates) {
        if ((c.visualEvidence?.length ?? 0) === 0 && byKey.has(c.key)) {
          c.visualEvidence = byKey.get(c.key)
        }
      }
    }
  }

  // FAIL CLOSED: no usable candidate AND a typed provider error → not read.
  if (readCandidates.length === 0 && providerErrors.length > 0) {
    return { status: 'unavailable', canonicalResult: null, cyrillicMap, providerErrors, pageResults, candidateCount: 0 }
  }

  // reads FIRST, product extraCandidates (e.g. MRZ) appended LAST — matches inline route order.
  const candidates: FieldCandidate[] = [...readCandidates, ...(input.extraCandidates ?? [])]
  const canonicalFields = applyKnowledgeBrainIfEnabled(
    candidates,
    buildKnowledgeContext({ docTypeId: input.docTypeId, product: input.product }),
  )

  const canonicalResult =
    canonicalFields.length > 0
      ? buildCanonicalResult({
          documentSessionId: input.documentSessionId ?? `${input.product}-recognize`,
          product: input.product,
          docType: input.docTypeId,
          fields: canonicalFields,
          createdAt: input.createdAt ?? new Date().toISOString(),
        })
      : null

  return { status: 'ok', canonicalResult, cyrillicMap, providerErrors, pageResults, candidateCount: readCandidates.length }
}
