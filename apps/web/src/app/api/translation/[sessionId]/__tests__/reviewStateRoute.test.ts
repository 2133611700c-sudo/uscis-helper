/**
 * reviewStateRoute.test.ts — review-state GET handler, now on the in-memory
 * repository (Supabase decoupled). Proves the compound load (session + fields +
 * latest document signed URL + certification) + gates, all via getRepositories().
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from '../review-state/route'
import {
  getRepositories, __resetInMemoryRepositories, __seedDocument,
} from '@/lib/repositories'
import type { FieldRecord } from '@/lib/repositories'
import { getCriticalFieldsForDocumentType } from '@/lib/translation/modules/adapters'

const SESSION = '66666666-6666-6666-6666-666666666666'
const AT = '2026-06-28T00:00:00Z'

const req = () => new NextRequest(`http://test/api/translation/${SESSION}/review-state`)
const ctx = (id = SESSION) => ({ params: Promise.resolve({ sessionId: id }) })

async function seed(opts: { confirmed: boolean; withDoc?: boolean; withCert?: boolean }) {
  __resetInMemoryRepositories()
  const r = getRepositories({})
  await r.documents.createSession({
    sessionId: SESSION, docType: 'ua_birth_certificate', status: 'reviewing',
    scopeTitle: 'Birth certificate', paymentConfirmed: true, uploadedPages: 1, createdAt: AT, updatedAt: AT,
  })
  const critical = getCriticalFieldsForDocumentType('ua_birth_certificate')
  const fields: FieldRecord[] = critical.map((f, i) => ({
    sessionId: SESSION, field: f, rawValue: 'X', normalizedValue: 'X',
    reviewRequired: false, confirmed: opts.confirmed,
    id: `field-${i}`, confidence: 0.9, languageLayer: 'uk', createdAt: AT,
  }))
  await r.review.upsertFields(SESSION, fields)
  if (opts.withDoc) {
    __seedDocument(r, { id: 'doc-1', sessionId: SESSION, storageKey: 'uploads/x.jpg', originalName: 'x.jpg', mimeType: 'image/jpeg', fileSizeBytes: 1234, createdAt: AT })
  }
  if (opts.withCert) {
    await r.certification.saveCertificationRecord({
      sessionId: SESSION, signerFullName: 'Jane Tester', signerAddress: null, signerPhone: null,
      signerEmail: null, sourceLanguage: 'Ukrainian', targetLanguage: 'English',
      languagePairConfirmed: true, statement: 's', signatureTypedName: 'Jane Tester',
      certificationVersion: 'v1.0-8cfr-2026', signedAt: AT,
    })
  }
}

describe('review-state route — in-memory repository', () => {
  beforeEach(async () => { await seed({ confirmed: true, withDoc: true, withCert: true }) })

  it('returns session + fields + signed preview URL + cert; gates computed', async () => {
    const res = await GET(req(), ctx())
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(json.session.doc_type).toBe('ua_birth_certificate')
    expect(json.session.payment_confirmed).toBe(true)
    expect(json.fields.length).toBeGreaterThan(0)
    expect(json.document_image_url).toContain('translation-documents/uploads/x.jpg')
    expect(json.certification_record?.signer_full_name).toBe('Jane Tester')
    // all critical confirmed + cert + payment → can_certify and can_render true
    expect(json.gates.can_certify).toBe(true)
    expect(json.gates.can_render).toBe(true)
  })

  it('404 for unknown session', async () => {
    const res = await GET(req(), ctx('77777777-7777-7777-7777-777777777777'))
    expect(res.status).toBe(404)
  })

  it('unconfirmed critical → can_certify false + unconfirmed_critical listed', async () => {
    await seed({ confirmed: false, withDoc: false, withCert: false })
    const res = await GET(req(), ctx())
    const json = await res.json()
    expect(json.gates.can_certify).toBe(false)
    expect(json.gates.unconfirmed_critical.length).toBeGreaterThan(0)
    expect(json.document_image_url).toBeNull() // no document seeded
    expect(json.certification_record).toBeNull()
  })
})
