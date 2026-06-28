/**
 * ocrFromStorageRoute.test.ts — OCR pipeline route, now on the in-memory
 * repository (Supabase decoupled). External services (Vision OCR, DeepSeek field
 * mapper, image preprocess, manual-review router, packet persistence) are mocked;
 * this test asserts the REPOSITORY interactions: session/doc load, run create,
 * storage download, status→extracted. 404 paths need no OCR mocks.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock external (non-repository) collaborators ──────────────────────────────
vi.mock('@/lib/ocr/image-preprocess', () => ({
  preprocessImage: vi.fn(async () => ({ ok: true, buffer: Buffer.from([1, 2, 3]), mimeType: 'image/jpeg' })),
}))
const extractText = vi.fn(async () => ({
  words: [{ id: 'w_0001', text: 'Ivan', bbox: [0, 0, 1, 1], confidence: 0.9 }],
  lines: [{ id: 'l_0001', text: 'Ivan', bbox: [0, 0, 1, 1] }],
  raw_text: 'Ivan Kovalenko 1990',
  warnings: [],
  processing_ms: 10,
}))
vi.mock('@/lib/ocr/providers', () => ({ getOcrProvider: () => ({ extractText }) }))
vi.mock('@/lib/ocr/field-mapper', () => ({
  mapFieldsWithDeepSeek: vi.fn(async () => ({
    ok: true,
    fields: [{ field: 'surname', source_label: 'Прізвище', source_zone: 'top', ocr_ids: [], raw_value: 'Коваленко', normalized_value: 'Kovalenko', language_layer: 'uk', confidence: 0.9, review_required: false }],
    warnings: [],
    image_quality: { overall: 0.9, issues: [] },
  })),
}))
const persistExtractedFields = vi.fn(async () => {})
const writeAuditLog = vi.fn(async () => {})
vi.mock('@/lib/translation/packetStateManager', () => ({
  persistExtractedFields: (...a: unknown[]) => persistExtractedFields(...(a as [])),
  writeAuditLog: (...a: unknown[]) => writeAuditLog(...(a as [])),
}))
vi.mock('@/lib/translation/manualReview/integrations', () => ({
  routePipelineToManualReview: vi.fn(async () => {}),
  gateInputFromSignals: (x: unknown) => x,
}))

import { NextRequest } from 'next/server'
import { POST } from '../route'
import { getRepositories, __resetInMemoryRepositories, __seedDocument } from '@/lib/repositories'

const SESSION = '99999999-9999-9999-9999-999999999999'
const AT = '2026-06-28T00:00:00Z'
const DOC_ID = 'doc-img-1'

const req = (body: unknown = {}) =>
  new NextRequest(`http://test/api/translation/${SESSION}/ocr-from-storage`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  })
const ctx = (id = SESSION) => ({ params: Promise.resolve({ sessionId: id }) })

async function seed(opts: { withDoc: boolean; withBytes?: boolean }) {
  __resetInMemoryRepositories()
  const r = getRepositories({})
  await r.documents.createSession({ sessionId: SESSION, docType: 'ua_birth_certificate', status: 'uploaded', createdAt: AT, updatedAt: AT })
  if (opts.withDoc) {
    __seedDocument(r, { id: DOC_ID, sessionId: SESSION, storageKey: `${SESSION}/x.jpg`, originalName: 'x.jpg', mimeType: 'image/jpeg', fileSizeBytes: 3, createdAt: AT })
    if (opts.withBytes !== false) await r.storage.upload('translation-documents', `${SESSION}/x.jpg`, new Uint8Array([1, 2, 3]), 'image/jpeg', { upsert: true })
  }
}

describe('ocr-from-storage route — in-memory repository', () => {
  beforeEach(() => { extractText.mockClear(); persistExtractedFields.mockClear() })

  it('happy path: creates run, downloads, persists, marks session extracted, 200', async () => {
    await seed({ withDoc: true })
    const res = await POST(req({ doc_type: 'ua_birth_certificate' }), ctx())
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(json.extraction_run_id).toBeTruthy()
    expect(extractText).toHaveBeenCalledTimes(1)
    expect(persistExtractedFields).toHaveBeenCalledTimes(1)
    expect((await getRepositories({}).documents.getSession(SESSION))?.status).toBe('extracted')
  })

  it('404 when session missing (no OCR calls)', async () => {
    await seed({ withDoc: true })
    const res = await POST(req(), ctx('00000000-0000-0000-0000-000000000000'))
    expect(res.status).toBe(404)
    expect(extractText).not.toHaveBeenCalled()
  })

  it('404 when no document uploaded', async () => {
    await seed({ withDoc: false })
    const res = await POST(req(), ctx())
    expect(res.status).toBe(404)
    expect(extractText).not.toHaveBeenCalled()
  })

  it('500 when storage download returns nothing (doc row but no bytes)', async () => {
    await seed({ withDoc: true, withBytes: false })
    const res = await POST(req(), ctx())
    expect(res.status).toBe(500)
  })
})
