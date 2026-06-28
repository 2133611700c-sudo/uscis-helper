/**
 * generatePdfRoute.test.ts — legacy signed-PDF route, now persisting via the
 * repository-backed InsertableClient (Supabase decoupled). External collaborators
 * (canonical mode, owner access, Stripe, pdf-lib, email) are mocked; this test
 * asserts the certification-audit persistence goes through the repository.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/canonical/continuityMode', () => ({ getCanonicalMode: () => 'off' }))
const isOwnerSession = vi.fn(async () => ({ verified: true }))
vi.mock('@/lib/ownerAccess', () => ({ isOwnerSession: (...a: unknown[]) => isOwnerSession(...(a as [])), ownerAuditEvent: () => ({}) }))
vi.mock('@/lib/stripe/verifyPayment', () => ({ verifyStripeSessionPaid: vi.fn(async () => ({ paid: true, correctService: true })) }))
const generateTranslationPDF = vi.fn(async () => Buffer.from('%PDF-1.7 fake'))
vi.mock('@/lib/packet/pdf', () => ({ generateTranslationPDF: (...a: unknown[]) => generateTranslationPDF(...(a as [])) }))
const sendEmail = vi.fn(async () => {})
vi.mock('@/lib/email/resend', () => ({ sendEmail: (...a: unknown[]) => sendEmail(...(a as [])) }))

import { NextRequest } from 'next/server'
import { POST } from '../route'
import { getRepositories, __resetInMemoryRepositories, __getCertificationAuditRows } from '@/lib/repositories'

const SIGNER = 'Jane Q Translator'
const basePayload = () => ({
  profile: { name: SIGNER, email: 'jane@example.com', phone: '', addr: '123 Main St, LA, CA' },
  selectedPlan: 'basic' as const,
  spanishCopy: false,
  locale: 'en',
  signatureDataUrl: null,
  signatureMethod: 'manual_wet_signature' as const,
  signedAt: '2026-06-28T00:00:00Z',
  certificationTextVersion: 'v1.0-8cfr-2026',
  session_id: 'cs_test_123',
  doc_type: 'other',
  reviewConfirmed: true,
  dataReviewed: true,
  accuracyAttested: true,
  fields: [{
    field: 'full_name', source_label: '', source_zone: '', bbox: [0, 0, 0, 0] as [number, number, number, number],
    raw_value: 'Ivan', normalized_value: 'Ivan Kovalenko', language_layer: 'uk' as const, confidence: 1, review_required: false,
  }],
})

const req = (payload: unknown) =>
  new NextRequest('http://test/api/translation/generate-pdf', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
  })

describe('generate-pdf route — certification persistence via repository', () => {
  beforeEach(() => { __resetInMemoryRepositories(); generateTranslationPDF.mockClear(); sendEmail.mockClear(); isOwnerSession.mockClear() })

  it('owner happy path → PDF + persists order + certification audit rows via repository', async () => {
    const res = await POST(req(basePayload()))
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('application/pdf')
    expect(generateTranslationPDF).toHaveBeenCalledTimes(1)
    const { orderRows, auditRows } = __getCertificationAuditRows(getRepositories({}))
    expect(orderRows.length).toBe(1)
    expect(auditRows.length).toBe(1)
    expect(sendEmail).toHaveBeenCalledTimes(1)
  })

  it('400 fields_require_review when a field still needs review (pre-payment)', async () => {
    const p = basePayload()
    p.fields[0].review_required = true
    const res = await POST(req(p))
    const json = await res.json()
    expect(res.status).toBe(400)
    expect(json.error).toBe('fields_require_review')
  })

  it('402 when not owner and no payment token', async () => {
    isOwnerSession.mockResolvedValueOnce({ verified: false })
    const p = basePayload()
    p.session_id = ''  // no token via header or session_id
    const res = await POST(req(p))
    expect(res.status).toBe(402)
  })
})
