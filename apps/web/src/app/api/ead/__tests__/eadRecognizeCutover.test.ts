/**
 * EAD STEP-E cutover: with ONE_BRAIN_RECOGNIZE_ENABLED=1 the route delegates to
 * recognizeDocument and still emits the same canonical carriage contract.
 * Synthetic fixtures only (TESTIVANENKO). Proves the ON path is live-capable;
 * the OFF default stays byte-identical (covered by eadExtractCanonicalCarriage).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const persistMock = vi.fn()

vi.mock('@/lib/security/rate-limit', () => ({
  rateLimit: vi.fn(async () => ({ allowed: true, resetAt: new Date(Date.now() + 60_000) })),
  getClientIP: () => '127.0.0.1',
}))
vi.mock('@/lib/ocr/image-preprocess', () => ({
  preprocessImage: vi.fn(async () => ({ ok: true, buffer: Buffer.from('img'), mimeType: 'image/jpeg' })),
}))
vi.mock('@/lib/docintel/documentFieldReader', () => ({
  readDocument: vi.fn(async () => ({ ok: true, status: 'ok', ms: 1, fields: [{ field: 'family_name', kind: 'name', raw_cyrillic: null, value: 'TESTIVANENKO', confidence: 1, review_required: false, source: 'vision', provider: 'gemini' }] })),
}))
// recognizeDocument imports BOTH docintelToCandidate and buildCyrillicMap from here.
vi.mock('@/lib/canonical/core/translationAdapter', () => ({
  docintelToCandidate: (f: { field: string; value: string }) => ({ key: f.field, value: f.value }),
  buildCyrillicMap: () => new Map<string, string>(),
}))
vi.mock('@/lib/canonical/core/knowledgeBrain', () => ({
  buildKnowledgeContext: () => ({}),
  applyKnowledgeBrainIfEnabled: (cands: Array<{ key: string; value: string }>) =>
    cands.map((c) => ({ key: c.key, finalValue: c.value, reviewRequired: false })),
}))
vi.mock('@/lib/canonical/core/eadAdapter', () => ({
  toEadAnswers: () => ({ family_name: 'TESTIVANENKO', review_required: false, uncertain_fields: [], core_status: 'ok', invented_fields_count: 0 }),
}))
vi.mock('@/lib/canonical/persistence', () => ({
  persistCanonicalDocument: (...a: unknown[]) => persistMock(...a),
  loadAllCanonicalDocumentsForSession: vi.fn(async () => []),
}))
vi.mock('@/lib/canonical/core/crossDocReconcile', () => ({ isCrossDocReconcileEnabled: () => false }))

function reqWith(): import('next/server').NextRequest {
  const fd = new FormData()
  fd.set('file', new File([new Uint8Array([1, 2, 3])], 'p.jpg', { type: 'image/jpeg' }))
  fd.set('docHint', 'ead')
  return { formData: async () => fd, headers: new Headers() } as unknown as import('next/server').NextRequest
}

describe('EAD STEP-E cutover (ONE_BRAIN_RECOGNIZE_ENABLED=1)', () => {
  beforeEach(() => { persistMock.mockReset(); process.env.ONE_BRAIN_RECOGNIZE_ENABLED = '1'; process.env.CANONICAL_CONTINUITY_MODE = 'shadow' })
  afterEach(() => { delete process.env.ONE_BRAIN_RECOGNIZE_ENABLED; delete process.env.CANONICAL_CONTINUITY_MODE })

  it('emits canonical carriage through recognizeDocument when persist succeeds', async () => {
    persistMock.mockResolvedValue({ id: 'uuid-ead-1', fieldsHash: 'abc12345' })
    const { POST } = await import('../../../api/ead/ocr/extract/route')
    const res = await POST(reqWith())
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.ok).not.toBe(false)
    expect(json.canonical_document_id).toBe('uuid-ead-1')
    expect(persistMock).toHaveBeenCalledTimes(1)
  })
})
