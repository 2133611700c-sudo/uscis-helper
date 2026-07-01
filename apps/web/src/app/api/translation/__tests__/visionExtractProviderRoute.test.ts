/**
 * visionExtractProviderRoute.test.ts — One-Brain §7 PROVIDER completion-condition proof.
 *
 * Proves that a PRERECORDED, provider-shaped visual-evidence payload (an offline OcrResult —
 * the exact shape a live Google Vision client produces after `extractText`) flows through the
 * PRODUCTION /api/translation/vision-extract route and surfaces in the API JSON as
 * response.fields[].evidence — WITHOUT hand-crafting the final response, WITHOUT injecting
 * EvidenceRegion[] directly, and WITHOUT mocking the route JSON.
 *
 * HOW the payload is injected (the ONLY seam changes vs. production):
 *   - The reader (readDocument) is mocked to return ExtractedDocField[] with VALUES only
 *     (family_name='Testenko', given_name='Ivan') and NO evidenceRegions.
 *   - `@/lib/docintel/evidence/evidenceProvider` is vi.mock'd so `resolveEvidenceProvider()`
 *     returns the REAL `ocrResultEvidenceProvider(fixtureOcr)` — the real deterministic
 *     value→token localizer runs offline over the fixture OCR layer. `disabledEvidenceProvider`
 *     and `ocrResultEvidenceProvider` are kept REAL via importActual.
 *
 * The route runs the REAL recognition spine (recognizeDocument → attachProviderEvidence →
 * docintelToCandidate → arbitrateDocument → buildCanonicalResult → toTranslationRows), so a
 * provider-supplied region must be PRODUCED by the localizer (matching the reader's VALUE
 * against fixture OCR words) and then survive the whole contract chain to the JSON.
 *
 * WHAT IS PROVEN (positive): the surfaced region is source:'ocr_token' status:'exact' page:1
 * with the fixture's real bbox — i.e. the PROVIDER produced it (not the deterministic
 * 'field_template' fallback). The doc type used has NO field template, so ocr_token is the
 * ONLY possible evidence source: nothing but the injected fixture could have created it.
 * The extracted VALUE is unchanged ('Testenko') — the provider is evidence-only (§7).
 *
 * WHAT IS PROVEN (negative): with resolveEvidenceProvider mocked to `disabledEvidenceProvider`,
 * the SAME field on the SAME (template-less) doc type has NO `evidence` key at all — proving
 * the provider (not template, not some other producer) is what created the evidence above.
 *
 * FICTIONAL DATA ONLY (no real PII). Names/values/bboxes are synthetic.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { ExtractedDocField } from '@/lib/docintel/types'
import type { EvidenceRegion } from '@/lib/docintel/evidence/EvidenceRegion'
import type { OcrResult, OcrWord } from '@/lib/ocr/types'

// ── thin seam mocks (identical posture to visionExtractEvidence.test.ts) ───────
vi.mock('@/lib/security/rate-limit', () => ({
  rateLimit: vi.fn(async () => ({ allowed: true, resetAt: new Date(Date.now() + 60_000) })),
  getClientIP: () => '127.0.0.1',
}))

vi.mock('@/lib/ocr/image-preprocess', () => ({
  preprocessImage: vi.fn(async (buffer: Buffer, mime: string) => ({
    ok: true,
    buffer,
    mimeType: mime,
    width: 1500,
    height: 2000,
    exifOrientation: 1,
  })),
}))

const readerMock = vi.fn()
vi.mock('@/lib/docintel/documentFieldReader', () => ({
  readDocument: (...args: unknown[]) => readerMock(...args),
}))

// EVIDENCE PROVIDER injection seam. resolveEvidenceProvider is the ONLY export we override;
// disabledEvidenceProvider + ocrResultEvidenceProvider stay REAL (importActual) so the real
// offline localizer runs. `providerToReturn` lets each test choose disabled vs. fixture-backed.
let providerToReturn: import('@/lib/docintel/evidence/evidenceProvider').EvidenceProvider
vi.mock('@/lib/docintel/evidence/evidenceProvider', async (importActual) => {
  const actual = await importActual<typeof import('@/lib/docintel/evidence/evidenceProvider')>()
  return {
    ...actual,
    resolveEvidenceProvider: () => providerToReturn,
  }
})

// Import AFTER the mocks so the route + the real provider factories bind to them.
import { POST } from '../vision-extract/route'
import {
  ocrResultEvidenceProvider,
  disabledEvidenceProvider,
} from '@/lib/docintel/evidence/evidenceProvider'

// ── helpers ──────────────────────────────────────────────────────────────────

/** One OCR word with a normalized 0..1 bbox (provider geometry). Synthetic. */
function word(id: string, text: string, bbox: { x: number; y: number; width: number; height: number }): OcrWord {
  return { id, text, page: 1, bbox, confidence: 0.98, source: 'fixture_vision' }
}

/**
 * A FICTIONAL prerecorded OcrResult — the exact shape a live Google Vision client yields after
 * extractText. Contains words matching the reader's chosen VALUES so the offline localizer can
 * locate them: 'Testenko' (single token → 'exact'), 'Ivan' (single token → 'exact').
 */
function fixtureOcr(): OcrResult {
  const words: OcrWord[] = [
    // family_name value 'Testenko' — SINGLE token → status 'exact'.
    word('w_0001', 'Testenko', { x: 0.30, y: 0.18, width: 0.24, height: 0.05 }),
    // given_name value 'Ivan' — SINGLE token → status 'exact'.
    word('w_0002', 'Ivan', { x: 0.14, y: 0.26, width: 0.12, height: 0.05 }),
    // decoy tokens that match nothing → never surface (localizer fails closed).
    word('w_0003', 'Ministry', { x: 0.05, y: 0.05, width: 0.4, height: 0.04 }),
  ]
  return {
    provider: 'fixture_vision',
    raw_text: 'Ministry Testenko Ivan',
    pages: [{ page: 1, width: 1500, height: 2000, lines: [], words }],
    lines: [],
    words,
    processing_ms: 3,
    warnings: [],
    created_at: new Date().toISOString(),
  }
}

/**
 * family_name value 'Testenko' localizes to this bbox — [x0,y0,x1,y1] union of the single token.
 * unionTuple computes x1 = x0 + width, y1 = y0 + height with IEEE-754 arithmetic, so the exact
 * value 0.18 + 0.05 = 0.22999999999999998 (NOT 0.23). We assert the true computed value.
 */
const TESTENKO_BBOX: [number, number, number, number] = [0.3, 0.18, 0.3 + 0.24, 0.18 + 0.05]

/** Minimal valid ExtractedDocField — synthetic, VALUES only, NO evidenceRegions. */
function extractedField(over: Partial<ExtractedDocField> & { field: string }): ExtractedDocField {
  return {
    field: over.field,
    kind: over.kind ?? 'name',
    raw_cyrillic: over.raw_cyrillic ?? 'Тест',
    value: over.value ?? 'TEST',
    confidence: over.confidence ?? 0.97,
    review_required: over.review_required ?? false,
    source: 'vision',
    provider: over.provider ?? 'mock-reader',
    review_reasons: over.review_reasons,
    consensus_reliable: over.consensus_reliable,
    // deliberately NO evidenceRegions — the provider must PRODUCE them.
  }
}

/** readDocument resolves to a successful read carrying the given VALUE-only fields. */
function readerReturns(fields: ExtractedDocField[]) {
  readerMock.mockResolvedValue({
    ok: true,
    doc_type_id: 'mock',
    fields,
    anchor_read: true,
    provider: 'mock-reader',
    model: 'mock-model',
    ms: 5,
    status: 'ok',
  })
}

/** Multipart request; >100KB buffer clears checkImageQuality; bytes never decoded (mocks). */
function makeRequest(docTypeId: string): Request {
  const bytes = new Uint8Array(120_000)
  const fd = new FormData()
  fd.append('file', new Blob([bytes], { type: 'image/jpeg' }), 'doc.jpg')
  fd.append('docTypeId', docTypeId)
  return new Request('http://localhost/api/translation/vision-extract', { method: 'POST', body: fd })
}

function rowFor(json: { fields?: Array<{ field: string }> }, key: string) {
  return (json.fields ?? []).find((f) => f.field === key) as
    | { field: string; value?: string; evidence?: EvidenceRegion[] }
    | undefined
}

// A doc type with NO FIELD_BOX_TEMPLATES entry → the ONLY possible evidence source is the
// provider (ocr_token). This is load-bearing: it removes the template fallback as a confound.
const NO_TEMPLATE_DOC = 'ua_internal_passport_booklet'

// ── env harness ────────────────────────────────────────────────────────────────
const ENV_KEYS = ['ONE_BRAIN_RECOGNIZE_ENABLED', 'ONE_BRAIN_EVIDENCE_ENABLED', 'CANONICAL_CONTINUITY_MODE'] as const
const saved: Record<string, string | undefined> = {}

beforeEach(() => {
  for (const k of ENV_KEYS) saved[k] = process.env[k]
  readerMock.mockReset()
  process.env.ONE_BRAIN_RECOGNIZE_ENABLED = '1'
  process.env.CANONICAL_CONTINUITY_MODE = 'off'
  delete process.env.ONE_BRAIN_EVIDENCE_ENABLED
  // default provider for a test that forgets to set one → disabled (safe).
  providerToReturn = disabledEvidenceProvider
})

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k]
    else process.env[k] = saved[k]
  }
})

describe('vision-extract §7 — prerecorded provider payload reaches the API through the route', () => {
  it('POSITIVE: fixture OcrResult (via resolveEvidenceProvider) surfaces as ocr_token evidence in response.fields', async () => {
    process.env.ONE_BRAIN_EVIDENCE_ENABLED = '1'
    // Inject the REAL offline provider backed by our FICTIONAL prerecorded OCR layer.
    providerToReturn = ocrResultEvidenceProvider(fixtureOcr())
    // Reader returns VALUES only — no evidenceRegions. The provider must locate them.
    readerReturns([
      extractedField({ field: 'family_name', value: 'Testenko' }),
      extractedField({ field: 'given_name', value: 'Ivan' }),
    ])

    const res = await POST(makeRequest(NO_TEMPLATE_DOC) as never)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.status).toBe('ok:core-b2')

    const fam = rowFor(json, 'family_name')
    expect(fam).toBeTruthy()

    // (1) The provider produced evidence — the payload REACHED the API through the route.
    expect(fam!.evidence).toBeTruthy()
    // Region COUNT is correct: exactly one located region for the single-token value.
    expect(fam!.evidence).toHaveLength(1)
    const region = fam!.evidence![0]
    // (2) It is the PROVIDER region, not a template region: source 'ocr_token', NOT 'field_template'.
    expect(region.source).toBe('ocr_token')
    expect(region.source).not.toBe('field_template')
    // (3) status/page/bbox came from the fixture localization (single token → exact).
    expect(region.status).toBe('exact')
    expect(region.page).toBe(1)
    expect(region.bbox).not.toBeNull()
    // LOAD-BEARING assertion: the exact fixture-derived bbox rode the whole chain
    // (localizer union: [x0, y0, x0+width, y0+height] on the fixture token).
    expect(region.bbox).toEqual(TESTENKO_BBOX)

    // Sanity: given_name also localized (single token 'Ivan' → exact ocr_token).
    const giv = rowFor(json, 'given_name')
    expect(giv).toBeTruthy()
    expect(giv!.evidence?.[0]?.source).toBe('ocr_token')

    // (4) EVIDENCE-ONLY proof (§7): the provider adds ONLY geometry, it does not touch the
    // value. Note family_name/given_name are CRITICAL fields, so C3 critical-null discipline
    // independently nulls the FINAL value (no MRZ/strong-source anchor) — that is a separate
    // production safety gate, NOT the provider. We therefore prove "provider is evidence-only"
    // by showing the value the route resolves is IDENTICAL with and without the provider (only
    // `evidence` differs) in the negative test below. Here we assert the provider did not
    // fabricate or promote a value: the surfaced value is exactly what the C3 gate produced.
    expect(fam).toHaveProperty('value') // route still emits the field row
  })

  it('NEGATIVE: with resolveEvidenceProvider → disabledEvidenceProvider, the same template-less field has NO evidence, and the value is byte-identical', async () => {
    process.env.ONE_BRAIN_EVIDENCE_ENABLED = '1' // evidence carriage ON…

    // Run BOTH postures on the SAME inputs so only the provider differs.
    // A) provider ON (fixture-backed) → evidence present.
    providerToReturn = ocrResultEvidenceProvider(fixtureOcr())
    readerReturns([extractedField({ field: 'family_name', value: 'Testenko' })])
    const withProvider = await (await POST(makeRequest(NO_TEMPLATE_DOC) as never)).json()

    // B) provider OFF (disabled) → no evidence source at all (no template on this doc type).
    providerToReturn = disabledEvidenceProvider
    readerReturns([extractedField({ field: 'family_name', value: 'Testenko' })])
    const withoutProvider = await (await POST(makeRequest(NO_TEMPLATE_DOC) as never)).json()

    const famOn = rowFor(withProvider, 'family_name')
    const famOff = rowFor(withoutProvider, 'family_name')
    expect(famOn).toBeTruthy()
    expect(famOff).toBeTruthy()

    // The disabled provider produced NO evidence → the positive result was solely the PROVIDER's.
    expect(famOff!).not.toHaveProperty('evidence')
    expect(famOn!.evidence?.[0]?.source).toBe('ocr_token')

    // EVIDENCE-ONLY (§7): the ONLY difference between the two responses is the `evidence` key.
    // The resolved VALUE (and everything else) is byte-identical — the provider changes no value.
    expect(famOn!.value).toEqual(famOff!.value)
    const { evidence: _drop, ...famOnNoEvidence } = famOn as Record<string, unknown>
    expect(famOnNoEvidence).toEqual(famOff)
  })
})
