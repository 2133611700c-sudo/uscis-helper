export type DigestDeliveryResult = {
  status: 'sent' | 'degraded'
  reason?:
    | 'missing_api_key'
    | 'invalid_api_key'
    | 'provider_error'
    | 'network_error'
    | 'timeout'
  httpStatus?: number
  strict: boolean
}

export type DigestDeliveryOptions = {
  strict?: boolean
}

const DEFAULT_RESEND_TIMEOUT_MS = 15_000
const MIN_RESEND_TIMEOUT_MS = 100
const MAX_RESEND_TIMEOUT_MS = 30_000

function strictEmailDelivery(): boolean {
  return process.env.EMAIL_STRICT === '1'
}

function resendTimeoutMs(): number {
  const configured = Number.parseInt(process.env.RESEND_TIMEOUT_MS || '', 10)
  if (!Number.isFinite(configured)) return DEFAULT_RESEND_TIMEOUT_MS
  return Math.min(MAX_RESEND_TIMEOUT_MS, Math.max(MIN_RESEND_TIMEOUT_MS, configured))
}

function emitDeliveryEvent(result: DigestDeliveryResult): void {
  const payload = JSON.stringify({ event: 'digest_delivery', ...result })
  if (result.status === 'degraded') {
    console.warn(payload)
    return
  }
  console.log(payload)
}

function degraded(
  reason: NonNullable<DigestDeliveryResult['reason']>,
  strict: boolean,
  httpStatus?: number,
): DigestDeliveryResult {
  const result: DigestDeliveryResult = {
    status: 'degraded',
    reason,
    strict,
    ...(typeof httpStatus === 'number' ? { httpStatus } : {}),
  }

  emitDeliveryEvent(result)

  if (strict) {
    const suffix = typeof httpStatus === 'number' ? ` (HTTP ${httpStatus})` : ''
    throw new Error(`Digest delivery failed: ${reason}${suffix}`)
  }

  return result
}

export async function sendDigest(
  html: string,
  subject: string,
  options: DigestDeliveryOptions = {},
): Promise<DigestDeliveryResult> {
  const strict = options.strict ?? strictEmailDelivery()
  const rawApiKey = process.env.RESEND_API_KEY || ''
  const apiKey = rawApiKey.trim()
  const to = (process.env.CONTACT_EMAIL_DESTINATION || '2133611700uscis@gmail.com').trim()

  if (!apiKey) {
    return degraded('missing_api_key', strict)
  }

  if (/\s/.test(apiKey)) {
    return degraded('invalid_api_key', strict)
  }

  if (rawApiKey !== apiKey) {
    console.warn(
      JSON.stringify({
        event: 'digest_delivery_config',
        status: 'normalized',
        field: 'RESEND_API_KEY',
        action: 'trimmed_surrounding_whitespace',
      }),
    )
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), resendTimeoutMs())

  let response: Response
  try {
    response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'monitor@messenginfo.com',
        to,
        subject,
        html,
      }),
      signal: controller.signal,
    })
  } catch {
    return degraded(controller.signal.aborted ? 'timeout' : 'network_error', strict)
  } finally {
    clearTimeout(timeoutId)
  }

  if (!response.ok) {
    return degraded('provider_error', strict, response.status)
  }

  const result: DigestDeliveryResult = { status: 'sent', strict }
  emitDeliveryEvent(result)
  return result
}
