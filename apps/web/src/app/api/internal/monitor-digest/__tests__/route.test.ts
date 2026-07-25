import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '../route'
import { signDigestRelayPayload } from '@/lib/monitoring/digestRelayAuth'

const URL = 'http://localhost/api/internal/monitor-digest'
const NOW = 1_784_991_600_000
const SECRET = 'test-service-role-key-with-sufficient-length'

function request(body: string, signature?: string): NextRequest {
  const timestamp = String(NOW)
  return new NextRequest(URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-monitor-timestamp': timestamp,
      'x-monitor-signature':
        signature ?? signDigestRelayPayload(body, timestamp, SECRET),
    },
    body,
  })
}

describe('POST /api/internal/monitor-digest', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      SUPABASE_SERVICE_ROLE_KEY: SECRET,
      RESEND_API_KEY: 're_valid_production_key',
      RESEND_FROM: 'Messenginfo <noreply@messenginfo.com>',
    }
    vi.spyOn(Date, 'now').mockReturnValue(NOW)
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  afterEach(() => {
    process.env = { ...originalEnv }
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('rejects an invalid signature before calling Resend', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const body = JSON.stringify({
      to: 'owner@example.com',
      subject: 'Digest',
      html: '<p>private digest</p>',
    })

    const response = await POST(request(body, '0'.repeat(64)))

    expect(response.status).toBe(401)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('relays a signed digest through the production Resend configuration', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    vi.stubGlobal('fetch', fetchMock)
    const body = JSON.stringify({
      to: 'owner@example.com',
      subject: 'Digest',
      html: '<p>private digest</p>',
    })

    const response = await POST(request(body))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true, status: 'sent' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer re_valid_production_key',
    )
    expect((init.headers as Record<string, string>)['Idempotency-Key']).toMatch(
      /^monitor-digest-[a-f0-9]{32}$/,
    )
    expect(init.body).toContain('"to":"owner@example.com"')
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })

  it('returns a safe provider failure without exposing the provider response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: vi.fn().mockResolvedValue({
          message: 'private-owner@example.com rejected',
        }),
      }),
    )
    const body = JSON.stringify({
      to: 'owner@example.com',
      subject: 'Digest',
      html: '<p>private digest</p>',
    })

    const response = await POST(request(body))

    expect(response.status).toBe(502)
    const responseText = await response.text()
    expect(responseText).toContain('"reason":"provider_error"')
    expect(responseText).not.toContain('private-owner@example.com')
    expect(responseText).not.toContain('private digest')
  })
})
