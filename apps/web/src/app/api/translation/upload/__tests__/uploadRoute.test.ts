/**
 * uploadRoute.test.ts — document-upload route, now on the in-memory repository
 * (Supabase decoupled). Proves validation + storage upload + document row +
 * session status/uploaded_pages + audit, all via getRepositories().
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '../route'
import { getRepositories, __resetInMemoryRepositories } from '@/lib/repositories'

const SESSION = '88888888-8888-8888-8888-888888888888'
const AT = '2026-06-28T00:00:00Z'

function formReq(parts: { file?: File; sessionId?: string }) {
  const fd = new FormData()
  if (parts.file) fd.set('file', parts.file)
  if (parts.sessionId !== undefined) fd.set('session_id', parts.sessionId)
  return new NextRequest('http://test/api/translation/upload', { method: 'POST', body: fd })
}
const jpeg = (name = 'doc.jpg', bytes = 2048) =>
  new File([new Uint8Array(bytes)], name, { type: 'image/jpeg' })

async function seedSession() {
  __resetInMemoryRepositories()
  await getRepositories({}).documents.createSession({
    sessionId: SESSION, docType: 'unknown', status: 'created', createdAt: AT, updatedAt: AT,
  })
}

describe('upload route — in-memory repository', () => {
  beforeEach(seedSession)

  it('valid JPEG → stores doc, sets session uploaded, records audit', async () => {
    const res = await POST(formReq({ file: jpeg(), sessionId: SESSION }))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(json.document_id).toBeTruthy()
    expect(json.storage_key).toContain(`${SESSION}/`)
    const r = getRepositories({})
    const latest = await r.documents.getLatestDocument(SESSION)
    expect(latest?.storageKey).toBe(json.storage_key)
    const session = await r.documents.getSession(SESSION)
    expect(session?.status).toBe('uploaded')
    expect(session?.uploadedPages).toBe(1)
    const audit = await r.audit.list(SESSION)
    expect(audit.some((e) => e.eventType === 'document_uploaded')).toBe(true)
  })

  it('404 for unknown session', async () => {
    const res = await POST(formReq({ file: jpeg(), sessionId: 'nope' }))
    expect(res.status).toBe(404)
  })

  it('missing file → 400; missing session_id → 400', async () => {
    expect((await POST(formReq({ sessionId: SESSION }))).status).toBe(400)
    expect((await POST(formReq({ file: jpeg() }))).status).toBe(400)
  })

  it('unsupported type → 422 validation failure', async () => {
    const txt = new File([new Uint8Array(10)], 'x.txt', { type: 'text/plain' })
    const res = await POST(formReq({ file: txt, sessionId: SESSION }))
    expect(res.status).toBe(422)
  })

  it('empty file → 422', async () => {
    const res = await POST(formReq({ file: jpeg('empty.jpg', 0), sessionId: SESSION }))
    expect(res.status).toBe(422)
  })
})
