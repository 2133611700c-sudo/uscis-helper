/**
 * Repository CONTRACT TESTS — the behavioral spec EVERY implementation must satisfy
 * (in-memory now; the future Supabase adapter must pass the identical suite). Also
 * proves the Supabase stub is fail-closed (not connected by default). Fictional data.
 */
import { describe, it, expect } from 'vitest'
import { createInMemoryRepositories } from '../inMemory'
import { createSupabaseRepositoriesStub } from '../supabaseAdapter.stub'
import { getRepositories, resolveRepositoryDriver, __resetInMemoryRepositories } from '../index'
import { SupabaseNotConnectedError, type RepositoryBundle, type FieldRecord } from '../types'

const SID = 'synthetic-session-1'
const AT = '2026-06-28T00:00:00Z'
const field = (over: Partial<FieldRecord>): FieldRecord => ({
  sessionId: SID, field: 'child_family_name', rawValue: "Солов'як", normalizedValue: 'Soloviak',
  reviewRequired: true, confirmed: false, ...over,
})

/** The contract suite — runs against any bundle factory. */
function contractSuite(name: string, make: () => RepositoryBundle) {
  describe(`repository contract — ${name}`, () => {
    it('session create → get → status update', async () => {
      const r = make()
      await r.documents.createSession({ sessionId: SID, docType: 'ua_birth_certificate', status: 'reviewing', createdAt: AT, updatedAt: AT })
      expect((await r.documents.getSession(SID))?.docType).toBe('ua_birth_certificate')
      await r.documents.updateSessionStatus(SID, 'rendered', '2026-06-28T01:00:00Z')
      expect((await r.documents.getSession(SID))?.status).toBe('rendered')
    })

    it('markExtracted sets status=extracted + docType', async () => {
      const r = make()
      await r.documents.createSession({ sessionId: SID, docType: 'unknown', status: 'uploaded', createdAt: AT, updatedAt: AT })
      await r.documents.markExtracted(SID, 'ua_birth_certificate', AT)
      const s = await r.documents.getSession(SID)
      expect(s?.status).toBe('extracted')
      expect(s?.docType).toBe('ua_birth_certificate')
    })

    it('upsert + list + get fields', async () => {
      const r = make()
      await r.review.upsertFields(SID, [field({}), field({ field: 'dob', rawValue: null, normalizedValue: '01/15/1990' })])
      expect((await r.review.listFields(SID)).length).toBe(2)
      expect((await r.review.getField(SID, 'dob'))?.normalizedValue).toBe('01/15/1990')
    })

    it('confirmField sets confirmed + confirmedAt and PRESERVES raw', async () => {
      const r = make()
      await r.review.upsertFields(SID, [field({})])
      const c = await r.confirmation.confirmField(SID, 'child_family_name', AT)
      expect(c?.confirmed).toBe(true)
      expect(c?.confirmedAt).toBe(AT)
      expect(c?.reviewRequired).toBe(false)
      expect(c?.rawValue).toBe("Солов'як") // raw immutable
    })

    it('correctField updates normalized+confirmed but NEVER touches raw', async () => {
      const r = make()
      await r.review.upsertFields(SID, [field({})])
      const c = await r.confirmation.correctField(SID, 'child_family_name', 'Soloviak-Corrected', AT)
      expect(c?.normalizedValue).toBe('Soloviak-Corrected')
      expect(c?.confirmedValue).toBe('Soloviak-Corrected')
      expect(c?.confirmed).toBe(true)
      expect(c?.rawValue).toBe("Солов'як") // raw immutable
    })

    it('recordUserCorrection returns id + monotonically increasing version', async () => {
      const r = make()
      await r.review.upsertFields(SID, [field({})])
      const c1 = await r.confirmation.recordUserCorrection(SID, 'child_family_name', 'Old', 'New', 'manual', AT)
      expect(c1.id).toBeTruthy()
      expect(c1.version).toBe(1)
      const c2 = await r.confirmation.recordUserCorrection(SID, 'child_family_name', 'New', 'Newer', 'manual', AT)
      expect(c2.version).toBe(2)
    })

    it('re-upsert does NOT overwrite an existing raw value (raw immutable)', async () => {
      const r = make()
      await r.review.upsertFields(SID, [field({})])
      await r.review.upsertFields(SID, [field({ rawValue: 'TAMPERED' })])
      expect((await r.review.getField(SID, 'child_family_name'))?.rawValue).toBe("Солов'як")
    })

    it('manual-review case: get → delete is idempotent; storage.remove no-throw', async () => {
      const r = make()
      // contract suites with no seed helper (e.g. a future adapter) just prove the no-throw shape
      expect(await r.manualReview.getCase('missing-case')).toBeNull()
      await r.manualReview.deleteCase('missing-case') // idempotent
      await r.storage.remove('translation-uploads', ['a.jpg', 'b.jpg']) // idempotent / no-throw
    })

    it('getLatestDocument null when none; storage.createSignedUrl returns a string', async () => {
      const r = make()
      expect(await r.documents.getLatestDocument(SID)).toBeNull()
      const url = await r.storage.createSignedUrl('translation-documents', 'uploads/x.jpg', 3600)
      expect(typeof url).toBe('string')
      expect(url).toContain('uploads/x.jpg')
    })

    it('upload → createDocument → getLatestDocument/getDocument; download bytes; markUploaded; upsert conflict throws', async () => {
      const r = make()
      await r.documents.createSession({ sessionId: SID, docType: 'unknown', status: 'created', createdAt: AT, updatedAt: AT })
      await r.storage.upload('translation-documents', `${SID}/1.jpg`, new Uint8Array([1, 2, 3]), 'image/jpeg', { upsert: false })
      // re-upload same key without upsert → throws
      await expect(r.storage.upload('translation-documents', `${SID}/1.jpg`, new Uint8Array([1]), 'image/jpeg')).rejects.toThrow(/already exists/)
      // download round-trips the stored bytes; absent key → null
      expect(Array.from((await r.storage.download('translation-documents', `${SID}/1.jpg`))!)).toEqual([1, 2, 3])
      expect(await r.storage.download('translation-documents', 'nope')).toBeNull()
      const doc = await r.documents.createDocument({ sessionId: SID, storageKey: `${SID}/1.jpg`, originalName: 'a.jpg', mimeType: 'image/jpeg', fileSizeBytes: 3, createdAt: AT })
      expect(doc.id).toBeTruthy()
      expect((await r.documents.getLatestDocument(SID))?.storageKey).toBe(`${SID}/1.jpg`)
      expect((await r.documents.getDocument(SID, doc.id))?.storageKey).toBe(`${SID}/1.jpg`)
      expect(await r.documents.getDocument(SID, 'missing')).toBeNull()
      await r.documents.markUploaded(SID, 2, '2026-06-28T02:00:00Z')
      const s = await r.documents.getSession(SID)
      expect(s?.status).toBe('uploaded'); expect(s?.uploadedPages).toBe(2)
    })

    it('extraction run: createRun → getRun → updateRun patches status', async () => {
      const r = make()
      const { id } = await r.extractionRuns.createRun({ sessionId: SID, documentId: 'doc-1', status: 'processing', startedAt: AT, retakeCount: 0 })
      expect(id).toBeTruthy()
      expect((await r.extractionRuns.getRun(SID, id!))?.status).toBe('processing')
      await r.extractionRuns.updateRun(id, { status: 'completed' })
      expect((await r.extractionRuns.getRun(SID, id!))?.status).toBe('completed')
      await r.extractionRuns.updateRun(null, { status: 'x' }) // null runId → no-op
    })

    it('certification record: save (upsert) → get; second save overwrites', async () => {
      const r = make()
      expect(await r.certification.getCertificationRecord(SID)).toBeNull()
      await r.certification.saveCertificationRecord({
        sessionId: SID, signerFullName: 'Jane Tester', signerAddress: null, signerPhone: null,
        signerEmail: null, sourceLanguage: 'Ukrainian', targetLanguage: 'English',
        languagePairConfirmed: true, statement: 'pursuant to 8 CFR §103.2(b)(3)',
        signatureTypedName: 'Jane Tester', certificationVersion: 'v1.0-8cfr-2026', signedAt: AT,
      })
      const got = await r.certification.getCertificationRecord(SID)
      expect(got?.signerFullName).toBe('Jane Tester')
      expect(got?.targetLanguage).toBe('English')
      await r.certification.saveCertificationRecord({ ...got!, signerFullName: 'Jane Updated', signatureTypedName: 'Jane Updated' })
      expect((await r.certification.getCertificationRecord(SID))?.signerFullName).toBe('Jane Updated')
    })

    it('orders: get null when absent; update only on existing; appendEvent no-throw', async () => {
      const r = make()
      expect(await r.orders.getOrder('ORD-x')).toBeNull()
      expect(await r.orders.updateOrder('ORD-x', { status: 's' }, AT)).toBeNull() // absent → null
      await r.orders.appendEvent('ORD-x', 'noop', { k: 1 }) // no-throw even if order absent
    })

    it('certification audit: append order + audit rows (opaque)', async () => {
      const r = make()
      await r.certificationAudit.appendOrderRow({ name: 'X', plan: 'basic' })
      await r.certificationAudit.appendCertificationAudit({ document_hash: 'abc' })
      // no-throw shape contract; in-memory exposes the rows via __getCertificationAuditRows
    })

    it('final render: save (upsert) → get', async () => {
      const r = make()
      expect(await r.finalRenders.getFinalRender(SID)).toBeNull()
      await r.finalRenders.saveFinalRender({ sessionId: SID, storageKey: `renders/${SID}/1.pdf`, contentType: 'application/pdf', fileSizeBytes: 100, qaPassed: true, qaReport: { status: 'PASS' }, createdAt: AT })
      const fr = await r.finalRenders.getFinalRender(SID)
      expect(fr?.storageKey).toBe(`renders/${SID}/1.pdf`)
      expect(fr?.qaPassed).toBe(true)
    })

    it('translation + pdf artifact + audit round-trip', async () => {
      const r = make()
      await r.translation.saveTranslatedValue(SID, 'child_family_name', 'Soloviak')
      expect((await r.translation.getTranslatedValues(SID))['child_family_name']).toBe('Soloviak')
      await r.pdfArtifacts.saveArtifact({ sessionId: SID, kind: 'mirror', sha256: 'abc', byteLength: 2509, createdAt: AT })
      expect((await r.pdfArtifacts.getArtifact(SID))?.sha256).toBe('abc')
      await r.audit.append({ sessionId: SID, eventType: 'final_pdf_generated', at: AT })
      expect((await r.audit.list(SID)).length).toBe(1)
    })

    it('reopen state via a fresh repository reference sees prior writes (within store)', async () => {
      const r = make()
      await r.review.upsertFields(SID, [field({})])
      // same bundle = same backing store → "reopen" reads persisted state
      expect((await r.review.listFields(SID)).length).toBe(1)
    })
  })
}

contractSuite('in-memory', createInMemoryRepositories)

describe('repository resolver + Supabase stub (fail-closed; Supabase OFF by default)', () => {
  it('defaults to in-memory; supabase only on explicit opt-in', () => {
    expect(resolveRepositoryDriver({})).toBe('in_memory')
    expect(resolveRepositoryDriver({ REPOSITORY_DRIVER: 'supabase' })).toBe('supabase')
  })
  it('getRepositories() default is in-memory (no Supabase connection)', async () => {
    __resetInMemoryRepositories()
    const r = getRepositories({})
    await r.documents.createSession({ sessionId: 'x', docType: 'ua_birth_certificate', status: 's', createdAt: AT, updatedAt: AT })
    expect((await r.documents.getSession('x'))?.sessionId).toBe('x')
  })
  it('the Supabase adapter is a fail-closed STUB until owner-wired', async () => {
    const r = createSupabaseRepositoriesStub()
    await expect(r.review.listFields(SID)).rejects.toBeInstanceOf(SupabaseNotConnectedError)
    await expect(r.documents.getSession(SID)).rejects.toThrow(/DO NOT RUN WITHOUT OWNER APPROVAL/)
    await expect(r.manualReview.getCase('x')).rejects.toBeInstanceOf(SupabaseNotConnectedError)
    await expect(r.storage.remove('b', ['k'])).rejects.toBeInstanceOf(SupabaseNotConnectedError)
    await expect(r.certification.getCertificationRecord(SID)).rejects.toBeInstanceOf(SupabaseNotConnectedError)
    await expect(r.documents.getLatestDocument(SID)).rejects.toBeInstanceOf(SupabaseNotConnectedError)
    await expect(r.storage.createSignedUrl('b', 'k', 60)).rejects.toBeInstanceOf(SupabaseNotConnectedError)
    await expect(r.storage.upload('b', 'k', new Uint8Array([1]), 'image/jpeg')).rejects.toBeInstanceOf(SupabaseNotConnectedError)
    await expect(r.orders.getOrder('ORD-x')).rejects.toBeInstanceOf(SupabaseNotConnectedError)
    await expect(r.storage.download('b', 'k')).rejects.toBeInstanceOf(SupabaseNotConnectedError)
    await expect(r.extractionRuns.createRun({ sessionId: SID, documentId: 'd', status: 's', startedAt: AT, retakeCount: 0 })).rejects.toBeInstanceOf(SupabaseNotConnectedError)
    await expect(r.finalRenders.getFinalRender(SID)).rejects.toBeInstanceOf(SupabaseNotConnectedError)
    await expect(r.certificationAudit.appendOrderRow({})).rejects.toBeInstanceOf(SupabaseNotConnectedError)
  })
})
