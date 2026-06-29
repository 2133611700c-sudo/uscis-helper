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
  createdAt?: string
}

export interface RecognizeOutput {
  /** 'ok' = at least one usable candidate (or a clean empty read). 'unavailable' = fail-closed. */
  status: 'ok' | 'unavailable'
  canonicalResult: CanonicalDocumentResult | null
  cyrillicMap: Map<string, string>
  providerErrors: ProviderErr[]
  pageResults: Array<{ page: number; ok: boolean; status: string; ms: number }>
  /** candidates BEFORE arbitration — lets a route distinguish "0 fields read" from "arbitration empty". */
  candidateCount: number
}

/**
 * Run the recognition spine. Pure composition of existing functions; the only I/O
 * is the injected reader (readDocument). No HTTP shaping — routes keep that.
 */
export async function recognizeDocument(input: RecognizeInput): Promise<RecognizeOutput> {
  const reader = input.reader ?? readDocument
  const cyrillicMap = new Map<string, string>()
  // READ candidates only — the "fields read" set the routes gate their no-fields
  // error on (BEFORE any product extraCandidates like MRZ are injected).
  const readCandidates: FieldCandidate[] = []
  const providerErrors: ProviderErr[] = []
  const pageResults: RecognizeOutput['pageResults'] = []

  const reads = await Promise.all(
    input.pages.map(async (p, i) => {
      const r = (await reader(p.buffer, p.mime, input.docTypeId, {
        product: input.product,
        ...(input.readOpts ?? {}),
      })) as ReadDocumentResult
      return { i, r }
    }),
  )

  for (const { i, r } of reads) {
    pageResults.push({ page: i + 1, ok: r.ok, status: r.status, ms: r.ms })
    if (r.ok && Array.isArray(r.fields)) {
      buildCyrillicMap(r.fields).forEach((v: string, k: string) => { if (!cyrillicMap.has(k)) cyrillicMap.set(k, v) })
      readCandidates.push(...r.fields.map((f: ExtractedDocField) => docintelToCandidate(f, i + 1)))
    } else if (r.provider_error) {
      providerErrors.push(r.provider_error)
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
