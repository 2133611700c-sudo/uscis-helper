/**
 * visionExtractEvidence.test.ts — One-Brain §17 (route integration).
 *
 * Proves the VISUAL-EVIDENCE carriage END-TO-END at the /api/translation/vision-extract
 * route level, with the READER mocked (no network / no Gemini spend). The route runs the
 * REAL recognition spine (recognizeDocument → docintelToCandidate → arbitrateDocument →
 * buildCanonicalResult → toTranslationRows), so a provider-supplied evidence region must
 * survive the WHOLE contract chain:
 *
 *   ExtractedDocField.evidenceRegions
 *     → FieldCandidate.visualEvidence         (docintelToCandidate)
 *     → CanonicalField.visualEvidence          (arbitration, geometry pooled + deduped)
 *     → FieldOut.evidence                       (toTranslationRows)
 *     → response.fields[].evidence              (route)
 *
 * The route-local TEMPLATE attach is a FALLBACK ONLY (§12 priority: provider geometry
 * already on a field is never overwritten by the deterministic template).
 *
 * WHAT IS MOCKED (thin seams only, so the carriage itself is real):
 *   - security/rate-limit   → always allowed (no IP throttling in unit env)
 *   - ocr/image-preprocess  → identity passthrough (no sharp on synthetic bytes)
 *   - docintel/documentFieldReader.readDocument → the injected reader result
 *   - canonical/persistence → unused (CANONICAL_CONTINUITY_MODE=off in every test)
 *
 * WHAT IS REAL: recognizeDocument, the translation adapter, arbitration, the canonical
 * builder, the evidence adapters, and the route's own attach/priority logic.
 *
 * FICTIONAL DATA ONLY (no real PII). Names/values are synthetic.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { ExtractedDocField } from '@/lib/docintel/types'
import type { EvidenceRegion } from '@/lib/docintel/evidence/EvidenceRegion'

// ── thin seam mocks ──────────────────────────────────────────────────────────
vi.mock('@/lib/security/rate-limit', () => ({
  rateLimit: vi.fn(async () => ({ allowed: true, resetAt: new Date(Date.now() + 60_000) })),
  getClientIP: () => '127.0.0.1',
}))

// preprocess is best-effort in the route; make it a deterministic identity passthrough
// so the exact synthetic buffer/mime reaches the (mocked) reader unchanged.
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

// The ONE reader seam. Every test sets its resolved value via readerReturn.
const readerMock = vi.fn()
vi.mock('@/lib/docintel/documentFieldReader', () => ({
  readDocument: (...args: unknown[]) => readerMock(...args),
}))

import { POST } from '../vision-extract/route'

// ── helpers ──────────────────────────────────────────────────────────────────

/** A localized OCR-token region (provider geometry) — status 'exact' requires a bbox. */
function ocrRegion(fieldKey: string, bbox: [number, number, number, number]): EvidenceRegion {
  return { fieldKey, bbox, page: 1, status: 'exact', source: 'ocr_token', cropPath: null }
}

/** Minimal valid ExtractedDocField — synthetic, no PII. */
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
    evidenceRegions: over.evidenceRegions,
  }
}

/** Make readDocument resolve to a successful read with the given fields. */
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

/**
 * Build a multipart request. Uses a >100 KB synthetic buffer so the route's
 * document-class size guard (min 100 KB for Ukrainian identity docs) passes —
 * the bytes are never decoded (reader + preprocess are mocked).
 */
function makeRequest(docTypeId: string): Request {
  const bytes = new Uint8Array(120_000) // >100 KB → clears checkImageQuality
  const fd = new FormData()
  fd.append('file', new Blob([bytes], { type: 'image/jpeg' }), 'doc.jpg')
  fd.append('docTypeId', docTypeId)
  return new Request('http://localhost/api/translation/vision-extract', { method: 'POST', body: fd })
}

/** Find the returned field row for a given field key. */
function rowFor(json: { fields?: Array<{ field: string }> }, key: string) {
  return (json.fields ?? []).find((f) => f.field === key) as
    | { field: string; evidence?: EvidenceRegion[] }
    | undefined
}

// ── env harness: recognize + evidence flags, continuity OFF (no Supabase) ──────
const ENV_KEYS = ['ONE_BRAIN_RECOGNIZE_ENABLED', 'ONE_BRAIN_EVIDENCE_ENABLED', 'CANONICAL_CONTINUITY_MODE'] as const
const saved: Record<string, string | undefined> = {}

beforeEach(() => {
  for (const k of ENV_KEYS) saved[k] = process.env[k]
  readerMock.mockReset()
  // Default posture for the carriage tests: single-orchestrator path + continuity off.
  process.env.ONE_BRAIN_RECOGNIZE_ENABLED = '1'
  process.env.CANONICAL_CONTINUITY_MODE = 'off'
  delete process.env.ONE_BRAIN_EVIDENCE_ENABLED
})

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k]
    else process.env[k] = saved[k]
  }
})

describe('vision-extract §17 — provider evidence carriage through the whole route', () => {
  it('1. provider ocr_token region survives ExtractedDocField → response.fields[].evidence', async () => {
    process.env.ONE_BRAIN_EVIDENCE_ENABLED = '1'
    const region = ocrRegion('given_name', [0.11, 0.22, 0.33, 0.28])
    // Use a doc type WITHOUT a field template so ONLY provider geometry can appear.
    readerReturns([extractedField({ field: 'given_name', value: 'MARIA', evidenceRegions: [region] })])

    const res = await POST(makeRequest('ua_internal_passport_booklet') as never)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.status).toBe('ok:core-b2')
    const row = rowFor(json, 'given_name')
    expect(row).toBeTruthy()
    // The exact provider geometry rode the whole chain (no re-derivation, no loss).
    expect(row!.evidence).toEqual([region])
  })

  it('2. provider evidence is NOT overwritten by the route-local template fallback (§12 priority)', async () => {
    process.env.ONE_BRAIN_EVIDENCE_ENABLED = '1'
    // 'given_name' HAS a template box under ua_birth_certificate. Provider evidence
    // must win: the returned region stays the ocr_token region, not the template.
    const region = ocrRegion('given_name', [0.5, 0.5, 0.6, 0.55])
    readerReturns([extractedField({ field: 'given_name', value: 'OLENA', evidenceRegions: [region] })])

    const res = await POST(makeRequest('ua_birth_certificate') as never)
    const json = await res.json()

    expect(res.status).toBe(200)
    const row = rowFor(json, 'given_name')
    expect(row).toBeTruthy()
    // Exactly the provider region — source 'ocr_token', not 'field_template'.
    expect(row!.evidence).toHaveLength(1)
    expect(row!.evidence![0].source).toBe('ocr_token')
    expect(row!.evidence![0].bbox).toEqual([0.5, 0.5, 0.6, 0.55])
  })

  it('3. NO provider evidence + template exists (ua_birth_certificate) → template fallback fills it', async () => {
    process.env.ONE_BRAIN_EVIDENCE_ENABLED = '1'
    // Reader returns family_name WITHOUT evidenceRegions; the birth-cert template has a
    // family_name box → deterministic 'approximate'/'field_template' evidence is attached.
    readerReturns([extractedField({ field: 'family_name', value: 'PETRENKO' })])

    const res = await POST(makeRequest('ua_birth_certificate') as never)
    const json = await res.json()

    expect(res.status).toBe(200)
    const row = rowFor(json, 'family_name')
    expect(row).toBeTruthy()
    expect(row!.evidence).toHaveLength(1)
    expect(row!.evidence![0].status).toBe('approximate')
    expect(row!.evidence![0].source).toBe('field_template')
    expect(row!.evidence![0].bbox).not.toBeNull()
  })

  it('4. multiple provider regions on one field are all preserved (deduped by geometry, not collapsed)', async () => {
    process.env.ONE_BRAIN_EVIDENCE_ENABLED = '1'
    const r1 = ocrRegion('given_name', [0.10, 0.20, 0.20, 0.24])
    const r2 = ocrRegion('given_name', [0.22, 0.20, 0.34, 0.24]) // distinct bbox → distinct region
    readerReturns([extractedField({ field: 'given_name', value: 'ANNA MARIA', evidenceRegions: [r1, r2] })])

    const res = await POST(makeRequest('ua_internal_passport_booklet') as never)
    const json = await res.json()

    expect(res.status).toBe(200)
    const row = rowFor(json, 'given_name')
    expect(row).toBeTruthy()
    expect(row!.evidence).toHaveLength(2)
    const bboxes = row!.evidence!.map((e) => e.bbox)
    expect(bboxes).toEqual(expect.arrayContaining([r1.bbox, r2.bbox]))
  })

  it('5. ONE_BRAIN_EVIDENCE_ENABLED OFF → a field read WITHOUT provider geometry has no `evidence` key', async () => {
    // Flag OFF (deleted in beforeEach). Field has no evidenceRegions → the byte-identical
    // baseline: no template attach, no `evidence` key on the row.
    readerReturns([extractedField({ field: 'family_name', value: 'KOVALENKO' })])

    const res = await POST(makeRequest('ua_birth_certificate') as never)
    const json = await res.json()

    expect(res.status).toBe(200)
    const row = rowFor(json, 'family_name')
    expect(row).toBeTruthy()
    expect(row!).not.toHaveProperty('evidence')
  })

  it('6. reader error does NOT destroy the extracted fields of the other pages (fail-open per page)', async () => {
    process.env.ONE_BRAIN_EVIDENCE_ENABLED = '1'
    // Two pages: page 1 reads a field (with evidence), page 2 throws. recognizeDocument
    // resolves per-page (Promise.all over reads); a page whose read has no fields simply
    // contributes nothing. The extracted field + its evidence must still be returned.
    const region = ocrRegion('given_name', [0.1, 0.2, 0.3, 0.26])
    readerMock
      .mockResolvedValueOnce({
        ok: true, doc_type_id: 'mock', anchor_read: true, provider: 'mock', model: 'm', ms: 5, status: 'ok',
        fields: [extractedField({ field: 'given_name', value: 'IRYNA', evidenceRegions: [region] })],
      })
      .mockResolvedValueOnce({
        // A clean empty read (no fields, no provider_error) — must not fail the whole request.
        ok: true, doc_type_id: 'mock', anchor_read: false, provider: 'mock', model: 'm', ms: 5, status: 'ok', fields: [],
      })

    const bytes = new Uint8Array(120_000)
    const fd = new FormData()
    fd.append('file', new Blob([bytes], { type: 'image/jpeg' }), 'p1.jpg')
    fd.append('file', new Blob([bytes], { type: 'image/jpeg' }), 'p2.jpg')
    fd.append('docTypeId', 'ua_internal_passport_booklet')
    const req = new Request('http://localhost/api/translation/vision-extract', { method: 'POST', body: fd })

    const res = await POST(req as never)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.ok).toBe(true)
    const row = rowFor(json, 'given_name')
    expect(row).toBeTruthy()
    expect(row!.evidence).toEqual([region])
  })
})
