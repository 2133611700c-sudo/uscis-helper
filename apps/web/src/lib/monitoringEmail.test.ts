import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sendDigest } from '../../../../scripts/monitoring/lib/email'

describe('sendDigest', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    process.env = { ...originalEnv }
    delete process.env.RESEND_API_KEY
    delete process.env.EMAIL_STRICT
    delete process.env.CONTACT_EMAIL_DESTINATION
    delete process.env.RESEND_TIMEOUT_MS
    vi.restoreAllMocks()
  })

  afterEach(() => {
    process.env = { ...originalEnv }
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('degrades without leaking the digest when the API key is missing', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    const result = await sendDigest('<p>private digest content</p>', 'Private subject')

    expect(result).toEqual({
      status: 'degraded',
      reason: 'missing_api_key',
      strict: false,
    })
    expect(fetchMock).not.toHaveBeenCalled()
    const output = [...log.mock.calls, ...warn.mock.calls].flat().join(' ')
    expect(output).not.toContain('private digest content')
    expect(output).not.toContain('Private subject')
  })

  it('trims surrounding secret whitespace before delivery', async () => {
    process.env.RESEND_API_KEY = '  re_test_key\n'
    process.env.CONTACT_EMAIL_DESTINATION = 'owner@example.com'
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    const result = await sendDigest('<p>digest</p>', 'Subject')

    expect(result).toEqual({ status: 'sent', strict: false })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit
    expect((request.headers as Record<string, string>).Authorization).toBe('Bearer re_test_key')
    expect(request.signal).toBeInstanceOf(AbortSignal)
  })

  it('returns a degraded provider status by default', async () => {
    process.env.RESEND_API_KEY = 're_test_key'
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
    })
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    await expect(sendDigest('<p>digest</p>', 'Subject')).resolves.toEqual({
      status: 'degraded',
      reason: 'provider_error',
      httpStatus: 401,
      strict: false,
    })
  })

  it('emits only allowlisted provider diagnostics without leaking the response message', async () => {
    process.env.RESEND_API_KEY = 're_test_key'
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: vi.fn().mockResolvedValue({
        name: 'validation_error',
        message: 'The `to` field contains private-owner@example.com and is invalid.',
      }),
    })
    vi.stubGlobal('fetch', fetchMock)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    await expect(sendDigest('<p>private digest</p>', 'Private subject')).resolves.toEqual({
      status: 'degraded',
      reason: 'provider_error',
      httpStatus: 400,
      providerErrorCode: 'validation_error',
      providerField: 'to',
      providerErrorHint: 'field_validation',
      strict: false,
    })

    const output = warn.mock.calls.flat().join(' ')
    expect(output).toContain('"providerErrorCode":"validation_error"')
    expect(output).toContain('"providerField":"to"')
    expect(output).toContain('"providerErrorHint":"field_validation"')
    expect(output).not.toContain('private-owner@example.com')
    expect(output).not.toContain('private digest')
    expect(output).not.toContain('Private subject')
  })

  it('classifies a testing-account restriction without logging its recipient', async () => {
    process.env.RESEND_API_KEY = 're_test_key'
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: vi.fn().mockResolvedValue({
          name: 'validation_error',
          error:
            'You can only send testing emails to your own email address (private-owner@example.com).',
        }),
      }),
    )
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    await expect(sendDigest('<p>digest</p>', 'Subject')).resolves.toEqual({
      status: 'degraded',
      reason: 'provider_error',
      httpStatus: 400,
      providerErrorCode: 'validation_error',
      providerErrorHint: 'testing_recipient_restriction',
      strict: false,
    })

    const output = warn.mock.calls.flat().join(' ')
    expect(output).toContain('"providerErrorHint":"testing_recipient_restriction"')
    expect(output).not.toContain('private-owner@example.com')
  })

  it('classifies Resend invalid-key text without logging the provider message', async () => {
    process.env.RESEND_API_KEY = 're_test_key'
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: vi.fn().mockResolvedValue({
          statusCode: 400,
          name: 'validation_error',
          message: 'API key is invalid',
        }),
      }),
    )
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    await expect(sendDigest('<p>digest</p>', 'Subject')).resolves.toEqual({
      status: 'degraded',
      reason: 'provider_error',
      httpStatus: 400,
      providerErrorCode: 'validation_error',
      providerErrorHint: 'invalid_api_key',
      strict: false,
    })

    const output = warn.mock.calls.flat().join(' ')
    expect(output).toContain('"providerErrorHint":"invalid_api_key"')
    expect(output).not.toContain('API key is invalid')
  })

  it('preserves a strict hard-fail mode for explicit runs', async () => {
    process.env.RESEND_API_KEY = 're_test_key'
    process.env.EMAIL_STRICT = '1'
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 401 })
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    await expect(sendDigest('<p>digest</p>', 'Subject')).rejects.toThrow(
      'Digest delivery failed: provider_error (HTTP 401)',
    )
  })

  it('lets each caller override the environment delivery policy explicitly', async () => {
    process.env.RESEND_API_KEY = 're_test_key'
    process.env.EMAIL_STRICT = '1'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }))
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    await expect(
      sendDigest('<p>digest</p>', 'Subject', { strict: false }),
    ).resolves.toEqual({
      status: 'degraded',
      reason: 'provider_error',
      httpStatus: 401,
      strict: false,
    })
  })

  it('degrades safely on a network failure', async () => {
    process.env.RESEND_API_KEY = 're_test_key'
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('socket failed')))
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    await expect(sendDigest('<p>digest</p>', 'Subject')).resolves.toEqual({
      status: 'degraded',
      reason: 'network_error',
      strict: false,
    })
  })

  it('aborts a hanging delivery and reports a timeout', async () => {
    process.env.RESEND_API_KEY = 're_test_key'
    process.env.RESEND_TIMEOUT_MS = '100'
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener(
            'abort',
            () => reject(new DOMException('aborted', 'AbortError')),
            { once: true },
          )
        }),
      ),
    )

    await expect(sendDigest('<p>digest</p>', 'Subject')).resolves.toEqual({
      status: 'degraded',
      reason: 'timeout',
      strict: false,
    })
  })
})
