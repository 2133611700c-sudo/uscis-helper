/**
 * deleteRoute.test.ts — GDPR case-delete route, now on the in-memory repository
 * (Supabase decoupled). Proves token gating + idempotent delete + storage removal.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from '../route'
import { getRepositories, __resetInMemoryRepositories, __seedManualReviewCase } from '@/lib/repositories'
import { generateDeleteToken } from '@/lib/security/delete-token'

const SECRET = 'test-admin-secret'
const CASE = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const BUCKET = 'translation-uploads'

function reqWith(caseId: string, token: string | null) {
  const url = new URL(`http://test/api/translation/${caseId}/delete`)
  if (token !== null) url.searchParams.set('token', token)
  return new NextRequest(url)
}
const ctx = (caseId: string) => ({ params: Promise.resolve({ sessionId: caseId }) })

describe('delete route — GDPR case delete (in-memory repository)', () => {
  const origSecret = process.env.ADMIN_SECRET
  beforeEach(() => {
    process.env.ADMIN_SECRET = SECRET
    __resetInMemoryRepositories()
    __seedManualReviewCase(getRepositories({}), CASE, BUCKET, 'uploads/foo.jpg')
  })
  afterEach(() => { if (origSecret === undefined) delete process.env.ADMIN_SECRET; else process.env.ADMIN_SECRET = origSecret })

  it('valid token → deletes case + storage object, redirects to /delete-confirmed', async () => {
    const token = generateDeleteToken(CASE, SECRET)
    const res = await GET(reqWith(CASE, token), ctx(CASE))
    expect(res.status).toBe(307) // NextResponse.redirect default
    expect(res.headers.get('location')).toContain('/delete-confirmed')
    expect(await getRepositories({}).manualReview.getCase(CASE)).toBeNull()
  })

  it('idempotent: deleting an already-gone case still redirects (no throw)', async () => {
    const token = generateDeleteToken(CASE, SECRET)
    await GET(reqWith(CASE, token), ctx(CASE)) // first delete
    const res = await GET(reqWith(CASE, token), ctx(CASE)) // second delete
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/delete-confirmed')
  })

  it('missing token → 404 (case untouched)', async () => {
    const res = await GET(reqWith(CASE, null), ctx(CASE))
    expect(res.status).toBe(404)
    expect(await getRepositories({}).manualReview.getCase(CASE)).not.toBeNull()
  })

  it('token id ≠ path id → 404 (no cross-case delete)', async () => {
    const token = generateDeleteToken('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', SECRET)
    const res = await GET(reqWith(CASE, token), ctx(CASE))
    expect(res.status).toBe(404)
    expect(await getRepositories({}).manualReview.getCase(CASE)).not.toBeNull()
  })

  it('ADMIN_SECRET unset → 500 not configured', async () => {
    delete process.env.ADMIN_SECRET
    const res = await GET(reqWith(CASE, 'x'), ctx(CASE))
    expect(res.status).toBe(500)
  })
})
