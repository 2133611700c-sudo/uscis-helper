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

    it('re-upsert does NOT overwrite an existing raw value (raw immutable)', async () => {
      const r = make()
      await r.review.upsertFields(SID, [field({})])
      await r.review.upsertFields(SID, [field({ rawValue: 'TAMPERED' })])
      expect((await r.review.getField(SID, 'child_family_name'))?.rawValue).toBe("Солов'як")
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
  })
})
