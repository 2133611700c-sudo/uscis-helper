import { NextRequest, NextResponse } from 'next/server'
import { verifyDigestRelaySignature } from '@/lib/monitoring/digestRelayAuth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000
const MAX_BODY_BYTES = 200_000
const RESEND_TIMEOUT_MS = 15_000

type RelayPayload = {
  to: string
  subject: string
  html: string
}

function validPayload(value: unknown): value is RelayPayload {
  if (!value || typeof value !== 'object') return false
  const payload = value as Record<string, unknown>
  return (
    typeof payload.to === 'string' &&
    payload.to.length <= 320 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.to) &&
    typeof payload.subject === 'string' &&
    payload.subject.length > 0 &&
    payload.subject.length <= 998 &&
    typeof payload.html === 'string' &&
    payload.html.length > 0
  )
}

function json(
  body: Record<string, unknown>,
  status: number,
): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  })
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const relaySecret = process.env.SUPABASE_SERVICE_ROLE_KEY
  const resendKey = process.env.RESEND_API_KEY?.trim()
  if (!relaySecret || !resendKey) {
    console.error('[monitor-digest] relay configuration missing')
    return json({ ok: false, reason: 'not_configured' }, 503)
  }

  const rawBody = await request.text()
  if (Buffer.byteLength(rawBody, 'utf8') > MAX_BODY_BYTES) {
    return json({ ok: false, reason: 'payload_too_large' }, 413)
  }

  const timestamp = request.headers.get('x-monitor-timestamp') || ''
  const signature = request.headers.get('x-monitor-signature') || ''
  const issuedAt = Number(timestamp)
  if (
    !Number.isFinite(issuedAt) ||
    Math.abs(Date.now() - issuedAt) > MAX_CLOCK_SKEW_MS ||
    !verifyDigestRelaySignature(rawBody, timestamp, signature, relaySecret)
  ) {
    return json({ ok: false }, 401)
  }

  let payload: unknown
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return json({ ok: false, reason: 'invalid_json' }, 400)
  }
  if (!validPayload(payload)) {
    return json({ ok: false, reason: 'invalid_payload' }, 400)
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), RESEND_TIMEOUT_MS)
  let response: Response
  try {
    response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `monitor-digest-${signature.slice(0, 32)}`,
        'User-Agent': 'messenginfo-monitor-relay/1.0',
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM ?? 'Messenginfo <noreply@messenginfo.com>',
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
      }),
      signal: controller.signal,
    })
  } catch {
    const reason = controller.signal.aborted ? 'timeout' : 'network_error'
    console.warn(JSON.stringify({ event: 'monitor_digest_relay', status: 'degraded', reason }))
    return json({ ok: false, reason }, 502)
  } finally {
    clearTimeout(timeoutId)
  }

  if (!response.ok) {
    console.warn(
      JSON.stringify({
        event: 'monitor_digest_relay',
        status: 'degraded',
        reason: 'provider_error',
        httpStatus: response.status,
      }),
    )
    return json(
      { ok: false, reason: 'provider_error', http_status: response.status },
      502,
    )
  }

  console.log(JSON.stringify({ event: 'monitor_digest_relay', status: 'sent' }))
  return json({ ok: true, status: 'sent' }, 200)
}
