/**
 * Route-level integration test for confirm-field — proves the route runs on the
 * in-memory repository (no Supabase). Covers: confirm + gates, raw preserved,
 * not-found, idempotent retry, invalid input.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '../confirm-field/route'
import { getRepositories, __resetInMemoryRepositories } from '@/lib/repositories'
import type { FieldRecord } from '@/lib/repositories'

const SID = '11111111-1111-4111-8111-111111111111'
const AT = '2026-06-28T00:00:00Z'

function req(body: unknown) {
  return new NextRequest('http://localhost/api/translation/x/confirm-field', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  })
}
const params = (sessionId: string) => ({ params: Promise.resolve({ sessionId }) })

async function seed() {
  __resetInMemoryRepositories()
  const r = getRepositories({})
  await r.documents.createSession({ sessionId: SID, docType: 'ua_birth_certificate', status: 'reviewing', createdAt: AT, updatedAt: AT })
  const fields: FieldRecord[] = [
    { sessionId: SID, field: 'surname', rawValue: "Солов'як", normalizedValue: 'Soloviak', reviewRequired: true, confirmed: false },
    { sessionId: SID, field: 'given_names', rawValue: 'Андрій', normalizedValue: 'Andrii', reviewRequired: true, confirmed: false },
  ]
  await r.review.upsertFields(SID, fields)
  return r
}

describe('confirm-field route on in-memory repository', () => {
  beforeEach(seed)

  it('confirms a field, preserves raw, returns gates', async () => {
    const res = await POST(req({ field: 'surname' }), params(SID))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(json.field).toBe('surname')
    expect(json.confirmed_at).toBeTruthy()
    expect(json.gates.critical_total).toBeGreaterThan(0)
    const f = await getRepositories({}).review.getField(SID, 'surname')
    expect(f?.confirmed).toBe(true)
    expect(f?.rawValue).toBe("Солов'як") // raw preserved
  })

  it('404 for an unknown session', async () => {
    const res = await POST(req({ field: 'surname' }), params('22222222-2222-4222-8222-222222222222'))
    expect(res.status).toBe(404)
    expect((await res.json()).error).toBe('session_not_found')
  })

  it('400 on invalid field', async () => {
    const res = await POST(req({ field: '' }), params(SID))
    expect(res.status).toBe(400)
  })

  it('400 on non-UUID session', async () => {
    const res = await POST(req({ field: 'surname' }), params('not-a-uuid'))
    expect(res.status).toBe(400)
  })

  it('retry is idempotent (no duplicate state)', async () => {
    await POST(req({ field: 'surname' }), params(SID))
    await POST(req({ field: 'surname' }), params(SID))
    const fields = await getRepositories({}).review.listFields(SID)
    expect(fields.filter((f) => f.field === 'surname').length).toBe(1)
  })

  it('does not import a Supabase client (decoupled)', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const src = readFileSync(resolve(__dirname, '../confirm-field/route.ts'), 'utf8')
    expect(/createAdminSupabaseClient|@supabase\/supabase-js|lib\/supabase/.test(src)).toBe(false)
  })
})
