/**
 * renderRoute.test.ts — final-render route, now on the in-memory repository
 * (Supabase decoupled). The gate externals (canonical mode, manual-review, Stripe,
 * owner access, QA, renderer, pdf-lib, final-PDF gate) are mocked to PASS; this
 * test asserts the REPOSITORY writes: session→rendered, final_renders saved, audit.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/canonical/continuityMode', () => ({ getCanonicalMode: () => 'off' }))
vi.mock('@/lib/translation/manualReview/integrations', () => ({
  getOpenManualReviewForSession: vi.fn(async () => ({ open: false, status: null, userMessageKey: null })),
}))
vi.mock('@/lib/stripe/verifyPayment', () => ({ verifyStripeSessionPaid: vi.fn(async () => ({ paid: true })) }))
vi.mock('@/lib/ownerAccess', () => ({
  isOwnerSession: vi.fn(async () => ({ verified: false })),
  ownerAuditEvent: () => ({}),
}))
vi.mock('@/lib/translation/translationQaValidator', () => ({
  runQaValidators: () => ({ status: 'PASS', warnings: [], failures: [] }),
}))
vi.mock('@/lib/translation/bureauStyleRenderer', () => ({ buildFinalDocument: () => 'final text' }))
const generateTranslationPDF = vi.fn(async () => Buffer.from('%PDF-1.7 fake'))
vi.mock('@/lib/packet/pdf', () => ({ generateTranslationPDF: (...a: unknown[]) => generateTranslationPDF(...(a as [])) }))
vi.mock('@/lib/contracts/finalPdfGate', () => ({ assertDocumentReadyForFinalPdf: () => ({ enforced: false, ready: true, blockedReasons: [] }) }))

import { NextRequest } from 'next/server'
import { POST } from '../route'
import { getRepositories, __resetInMemoryRepositories } from '@/lib/repositories'
import type { FieldRecord } from '@/lib/repositories'
import { getCriticalFieldsForDocumentType } from '@/lib/translation/modules/adapters'
import { buildCertificationRecord } from '@/lib/translation/certificationRecord'

const SESSION = 'abababab-abab-abab-abab-abababababab'
const AT = '2026-06-28T00:00:00Z'
const SIGNER = 'Jane Q Translator'

const req = (body: unknown) =>
  new NextRequest('http://test/api/translation/render', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  })

async function seed(opts: { paid: boolean }) {
  __resetInMemoryRepositories()
  const r = getRepositories({})
  await r.documents.createSession({
    sessionId: SESSION, docType: 'ua_birth_certificate', status: 'reviewing',
    scopeTitle: 'Birth certificate', paymentConfirmed: opts.paid, createdAt: AT, updatedAt: AT,
  })
  const critical = getCriticalFieldsForDocumentType('ua_birth_certificate')
  const fields: FieldRecord[] = critical.map((f) => ({
    sessionId: SESSION, field: f, rawValue: 'X', normalizedValue: 'X',
    reviewRequired: false, confirmed: true, evidenceType: 'ocr_bbox', confidence: 0.9,
  }))
  await r.review.upsertFields(SESSION, fields)
  const cert = buildCertificationRecord({ signerName: SIGNER, sourceLanguage: 'Ukrainian', signatureTypedName: SIGNER })
  await r.certification.saveCertificationRecord({
    sessionId: SESSION, signerFullName: cert.signer_full_name, signerAddress: null, signerPhone: null,
    signerEmail: null, sourceLanguage: 'Ukrainian', targetLanguage: 'English',
    languagePairConfirmed: cert.language_pair_confirmed, statement: cert.statement,
    signatureTypedName: cert.signature_typed_name, certificationVersion: cert.certification_version, signedAt: cert.signed_at,
  })
}

describe('render route — in-memory repository', () => {
  beforeEach(() => { generateTranslationPDF.mockClear() })

  it('400 when session_id missing', async () => {
    await seed({ paid: true })
    expect((await POST(req({}))).status).toBe(400)
  })

  it('404 when session not found', async () => {
    await seed({ paid: true })
    expect((await POST(req({ session_id: 'no-such' }))).status).toBe(404)
  })

  it('402 when payment not confirmed', async () => {
    await seed({ paid: false })
    const res = await POST(req({ session_id: SESSION }))
    const json = await res.json()
    expect(res.status).toBe(402)
    expect(json.gate).toBe('payment')
  })

  it('all gates pass → PDF; session rendered, final_renders saved, audit', async () => {
    await seed({ paid: true })
    const res = await POST(req({ session_id: SESSION }))
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('application/pdf')
    expect(generateTranslationPDF).toHaveBeenCalledTimes(1)
    const r = getRepositories({})
    expect((await r.documents.getSession(SESSION))?.status).toBe('rendered')
    const fr = await r.finalRenders.getFinalRender(SESSION)
    expect(fr?.contentType).toBe('application/pdf')
    expect(fr?.qaPassed).toBe(true)
    const audit = await r.audit.list(SESSION)
    expect(audit.some((e) => e.eventType === 'final_rendered')).toBe(true)
  })
})
