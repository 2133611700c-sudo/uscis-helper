/**
 * processRoute.test.ts — legacy v3 order route, now on the in-memory repository
 * (Supabase decoupled). GET/PATCH/POST drive OrderRepository; the legacy packet
 * generator (@/lib/packet) is mocked so POST exercises only the order persistence.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const genPacket = vi.fn(async () => ({
  ok: true as const, signedUrl: 'https://signed/x.zip',
  expiresAt: new Date('2026-06-28T01:00:00Z'),
  files: [{ filename: 'packet.pdf', contentType: 'application/pdf' }],
}))
vi.mock('@/lib/packet', () => ({ generateFullPacket: (...a: unknown[]) => genPacket(...(a as [])) }))

import { NextRequest } from 'next/server'
import { GET, PATCH, POST } from '../route'
import { getRepositories, __resetInMemoryRepositories, __seedOrder } from '@/lib/repositories'

const ORDER = 'ORD-12345'
const AT = '2026-06-28T00:00:00Z'

const getReq = (q: string) => new NextRequest(`http://test/api/translation/process?${q}`)
const bodyReq = (body: unknown, method: 'PATCH' | 'POST') =>
  new NextRequest('http://test/api/translation/process', {
    method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  })

function seed() {
  __resetInMemoryRepositories()
  __seedOrder(getRepositories({}), {
    orderId: ORDER, status: 'reviewing', ocrStatus: 'done', documentType: 'birth_certificate',
    locale: 'en', fieldsReviewed: [{ field_name: 'surname', source_text: 'X', translated_text: 'Y' }],
    createdAt: AT, updatedAt: AT,
  })
}

describe('process route — legacy orders on in-memory repository', () => {
  beforeEach(() => { genPacket.mockClear(); seed() })

  it('GET returns the order (snake_case); 400 without order_id; 404 unknown', async () => {
    const res = await GET(getReq(`order_id=${ORDER}`))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.order_id).toBe(ORDER)
    expect(json.document_type).toBe('birth_certificate')
    expect((await GET(getReq(''))).status).toBe(400)
    expect((await GET(getReq('order_id=NOPE'))).status).toBe(404)
  })

  it('PATCH updates status + logs event; 404 unknown order', async () => {
    const res = await PATCH(bodyReq({ order_id: ORDER, status: 'reviewed' }, 'PATCH'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.status).toBe('reviewed')
    expect((await getRepositories({}).orders.getOrder(ORDER))?.status).toBe('reviewed')
    expect((await PATCH(bodyReq({ order_id: 'NOPE' }, 'PATCH'))).status).toBe(404)
  })

  it('POST generates packet + marks packet_ready; 404 unknown order', async () => {
    const res = await POST(bodyReq({ order_id: ORDER }, 'POST'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(json.download_url).toBe('https://signed/x.zip')
    expect(genPacket).toHaveBeenCalledTimes(1)
    expect((await getRepositories({}).orders.getOrder(ORDER))?.status).toBe('packet_ready')
    expect((await POST(bodyReq({ order_id: 'NOPE' }, 'POST'))).status).toBe(404)
  })
})
