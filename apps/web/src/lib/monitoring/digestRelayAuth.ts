import { createHmac, timingSafeEqual } from 'node:crypto'

const DIGEST_RELAY_CONTEXT = 'messenginfo-monitor-digest-relay-v1'

function derivedSigningKey(secret: string): Buffer {
  return createHmac('sha256', secret).update(DIGEST_RELAY_CONTEXT).digest()
}

export function signDigestRelayPayload(
  body: string,
  timestamp: string,
  secret: string,
): string {
  return createHmac('sha256', derivedSigningKey(secret))
    .update(`${timestamp}.${body}`)
    .digest('hex')
}

export function verifyDigestRelaySignature(
  body: string,
  timestamp: string,
  providedSignature: string,
  secret: string,
): boolean {
  if (!/^\d{13}$/.test(timestamp) || !/^[a-f0-9]{64}$/.test(providedSignature)) {
    return false
  }

  const expected = signDigestRelayPayload(body, timestamp, secret)
  return timingSafeEqual(
    Buffer.from(providedSignature, 'hex'),
    Buffer.from(expected, 'hex'),
  )
}
