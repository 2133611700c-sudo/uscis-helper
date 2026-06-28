/**
 * certifyRoute.test.ts — certification route, now on the in-memory repository
 * (Supabase decoupled). Proves the critical-field gate + record persistence +
 * session status update + PII-safe audit, all via getRepositories().
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '../route'
import { getRepositories, __resetInMemoryRepositories } from '@/lib/repositories'
import type { FieldRecord } from '@/lib/repositories'
import { getCriticalFieldsForDocumentType } from '@/lib/translation/modules/adapters'

const SESSION = '55555555-5555-5555-5555-555555555555'
const AT = '2026-06-28T00:00:00Z'
const SIGNER = 'Jane Q Translator'

function req(body: unknown) {
  return new NextRequest('http://test/api/translation/certify', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  })
}

async function seed(allConfirmed: boolean) {
  __resetInMemoryRepositories()
  const r = getRepositories({})
  await r.documents.createSession({ sessionId: SESSION, docType: 'ua_birth_certificate', status: 'reviewing', createdAt: AT, updatedAt: AT })
  const critical = getCriticalFieldsForDocumentType('ua_birth_certificate')
  const fields: FieldRecord[] = critical.map((f) => ({
    sessionId: SESSION, field: f, rawValue: 'X', normalizedValue: 'X', reviewRequired: false, confirmed: allConfirmed,
  }))
  await r.review.upsertFields(SESSION, fields)
}

const base = { session_id: SESSION, signer_name: SIGNER, signature_typed_name: SIGNER, source_language: 'Ukrainian' }

describe('certify route — in-memory repository', () => {
  beforeEach(async () => { await seed(true) })

  it('all critical confirmed → certifies; persists record + status=certified + audit', async () => {
    const res = await POST(req(base))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.ok).toBe(true)
    const r = getRepositories({})
    const cert = await r.certification.getCertificationRecord(SESSION)
    expect(cert?.signerFullName).toBe(SIGNER)
    expect(cert?.targetLanguage).toBe('English')
    expect((await r.documents.getSession(SESSION))?.status).toBe('certified')
    const audit = await r.audit.list(SESSION)
    expect(audit.some((e) => e.eventType === 'certification_completed')).toBe(true)
    // PII-safe: audit detail carries only a name LENGTH, never the name itself.
    const ev = audit.find((e) => e.eventType === 'certification_completed')
    expect(JSON.stringify(ev?.detail ?? {})).not.toContain(SIGNER)
  })

  it('unconfirmed critical fields → 400 gate, no record persisted', async () => {
    await seed(false)
    const res = await POST(req(base))
    const json = await res.json()
    expect(res.status).toBe(400)
    expect(json.gate).toBe('critical_fields_unconfirmed')
    expect(await getRepositories({}).certification.getCertificationRecord(SESSION)).toBeNull()
  })

  it('missing signer_name → 400', async () => {
    const res = await POST(req({ ...base, signer_name: undefined }))
    expect(res.status).toBe(400)
  })

  it('signer_name ≠ signature_typed_name → 400 invalid record', async () => {
    const res = await POST(req({ ...base, signature_typed_name: 'Someone Else' }))
    const json = await res.json()
    expect(res.status).toBe(400)
    expect(json.error).toMatch(/invalid/i)
  })
})
