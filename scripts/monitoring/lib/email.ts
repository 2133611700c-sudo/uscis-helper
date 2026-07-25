export type DigestDeliveryResult = {
  status: 'sent' | 'degraded'
  reason?:
    | 'missing_api_key'
    | 'invalid_api_key'
    | 'provider_error'
    | 'network_error'
    | 'timeout'
  httpStatus?: number
  providerErrorCode?: string
  providerField?: string
  providerErrorHint?: string
  strict: boolean
}

export type DigestDeliveryOptions = {
  strict?: boolean
}

const DEFAULT_RESEND_TIMEOUT_MS = 15_000
const MIN_RESEND_TIMEOUT_MS = 100
const MAX_RESEND_TIMEOUT_MS = 30_000
const SAFE_PROVIDER_FIELDS = [
  'from',
  'to',
  'subject',
  'html',
  'text',
  'reply_to',
  'cc',
  'bcc',
  'attachments',
  'headers',
  'tags',
  'scheduled_at',
] as const

type SafeProviderDetails = Pick<
  DigestDeliveryResult,
  'providerErrorCode' | 'providerField' | 'providerErrorHint'
>

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
  providerDetails: SafeProviderDetails = {},
): DigestDeliveryResult {
  const result: DigestDeliveryResult = {
    status: 'degraded',
    reason,
    strict,
    ...(typeof httpStatus === 'number' ? { httpStatus } : {}),
    ...providerDetails,
  }

  emitDeliveryEvent(result)

  if (strict) {
    const suffix = typeof httpStatus === 'number' ? ` (HTTP ${httpStatus})` : ''
    throw new Error(`Digest delivery failed: ${reason}${suffix}`)
  }

  return result
}

async function safeProviderDetails(response: Response): Promise<SafeProviderDetails> {
  try {
    const body: unknown = await response.json()
    if (!body || typeof body !== 'object') return {}

    const record = body as Record<string, unknown>
    const rawCode =
      typeof record.name === 'string'
        ? record.name
        : typeof record.type === 'string'
          ? record.type
          : typeof record.code === 'string'
            ? record.code
            : ''
    const providerErrorCode = /^[a-z][a-z0-9_]{0,63}$/.test(rawCode)
      ? rawCode
      : undefined

    const message = typeof record.message === 'string' ? record.message : ''
    const providerField = SAFE_PROVIDER_FIELDS.find((field) => {
      const quoted = new RegExp(`(?:\`|'|")${field}(?:\`|'|")`, 'i')
      const named = new RegExp(
        `(?:\\b${field}\\b\\s+(?:field|address|parameter|property)|(?:field|parameter|property)\\s+\\b${field}\\b)`,
        'i',
      )
      return quoted.test(message) || named.test(message)
    })
    const providerErrorHint =
      /only send testing emails to your own email address/i.test(message)
        ? 'testing_recipient_restriction'
        : /(?:verify|verified|verification).{0,40}domain|domain.{0,40}(?:verify|verified|verification)/i.test(
              message,
            )
          ? 'domain_verification'
          : /\b(?:daily )?quota\b/i.test(message)
            ? 'quota_exceeded'
            : providerField
              ? 'field_validation'
              : undefined

    return {
      ...(providerErrorCode ? { providerErrorCode } : {}),
      ...(providerField ? { providerField } : {}),
      ...(providerErrorHint ? { providerErrorHint } : {}),
    }
  } catch {
    return {}
  }
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
    return degraded(
      'provider_error',
      strict,
      response.status,
      await safeProviderDetails(response),
    )
  }

  const result: DigestDeliveryResult = { status: 'sent', strict }
  emitDeliveryEvent(result)
  return result
}
