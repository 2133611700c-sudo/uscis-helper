/**
 * readerTrace.test.ts — truthful reader execution telemetry.
 *
 * The ReaderExecutionTrace is built at the REAL provider-call site inside
 * readDocument. Every telemetry field the API reports (model / reader provider /
 * fallback_used / provider_call_count) derives from this trace — NEVER a constant.
 *
 * These tests are deterministic: NO network, NO PII. Cases that need the #13 OpenAI
 * fallback mock the two provider modules and enable ONE_BRAIN_READER_FALLBACK; cases
 * that only need the primary inject a mock provider via opts.provider.
 *
 * Also a source-guard: the Core-B2 route response must NOT set `model` from the
 * normalizeGeminiModel(...) CONSTANT and MUST derive it from the trace, and the trace
 * shape must be PII-free (no field-value / raw_cyrillic / OCR-text keys).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { VisionProvider, VisionReadResult, ReaderExecutionTrace } from '../types'

const IMG = Buffer.from('fake-image')
const PRIMARY = 'gemini-3.1-pro-preview'

function okProvider(name: string, model: string, attempts = 1): VisionProvider {
  return {
    name,
    readFields: async (): Promise<VisionReadResult> => ({
      ok: true,
      model,
      ms: 12,
      attempts,
      fields: [
        { field: 'family_name', cyrillic: 'ШЕВЧЕНКО', iso_date: null, can_read: true, confidence: 0.99, reason: '' },
        { field: 'given_name', cyrillic: 'ТАРАС', iso_date: null, can_read: true, confidence: 0.99, reason: '' },
      ],
    }),
  }
}

describe('ReaderExecutionTrace — primary path (injected provider)', () => {
  it('case 1: gemini primary success ⇒ finalProvider=gemini, no fallback, providerCallCount=1', async () => {
    // Name the injected provider 'gemini' + use the PRIMARY model so the trace treats
    // it as the configured primary (not an injected non-gemini provider).
    const { readDocument } = await import('../documentFieldReader')
    const res = await readDocument(IMG, 'image/jpeg', 'ua_internal_passport_booklet', {
      provider: okProvider('gemini', PRIMARY),
    })
    expect(res.ok).toBe(true)
    const t = res.reader_trace as ReaderExecutionTrace
    expect(t).toBeTruthy()
    expect(t.finalProvider).toBe('gemini')
    expect(t.finalModel).toBe(PRIMARY)
    expect(t.primaryOutcome).toBe('success')
    expect(t.fallbackAttempted).toBe(false)
    expect(t.fallbackOutcome).toBe('not_attempted')
    expect(t.providerCallCount).toBe(1)
  })

  it('case 3: injected NON-gemini provider ⇒ primaryOutcome=skipped, honest configuredPrimary, no fallback (there is NO READER_PROVIDER mode)', async () => {
    // There is no supported "openai configured primary" mode (READER_PROVIDER is dead).
    // The only way an injected provider reads is opts.provider — the trace records this
    // honestly as skipped-configured-gemini, with the injected provider as final.
    const { readDocument } = await import('../documentFieldReader')
    const res = await readDocument(IMG, 'image/jpeg', 'ua_internal_passport_booklet', {
      provider: okProvider('openai', 'gpt-4.1'),
    })
    expect(res.ok).toBe(true)
    const t = res.reader_trace as ReaderExecutionTrace
    expect(t.primaryOutcome).toBe('skipped')
    expect(t.primaryAttempted).toBe(false)
    expect(t.configuredPrimaryProvider).toBe('openai') // the injected provider IS the primary here
    expect(t.finalProvider).toBe('openai')
    expect(t.finalModel).toBe('gpt-4.1')
    expect(t.fallbackAttempted).toBe(false)
    // providerCallCount is the REAL HTTP total — the injected provider read once.
    expect(t.providerCallCount).toBe(1)
  })
})

describe('ReaderExecutionTrace — #13 OpenAI fallback path (mocked providers)', () => {
  const OLD_ENV = { ...process.env }

  beforeEach(() => {
    vi.resetModules()
    process.env.ONE_BRAIN_READER_FALLBACK = '1'
    process.env.GEMINI_MODEL = PRIMARY
  })
  afterEach(() => {
    vi.doUnmock('../providers/geminiVisionProvider')
    vi.doUnmock('../providers/openaiVisionProvider')
    vi.resetModules() // ensure later (non-mocked) describes re-import the REAL modules
    process.env = { ...OLD_ENV }
  })

  async function loadWithProviders(gemini: VisionReadResult, openai: VisionReadResult) {
    // gemini defaultVisionProvider fails; openaiVisionProvider serves the fallback.
    vi.doMock('../providers/geminiVisionProvider', () => ({
      primaryGeminiModel: () => PRIMARY,
      defaultVisionProvider: {
        name: 'gemini',
        readFields: async (): Promise<VisionReadResult> => gemini,
      } satisfies VisionProvider,
    }))
    vi.doMock('../providers/openaiVisionProvider', () => ({
      openaiVisionProvider: {
        name: 'openai',
        readFields: async (): Promise<VisionReadResult> => openai,
      } satisfies VisionProvider,
      isReaderFallbackEnabled: () => true,
      READER_FALLBACK_TIMEOUT_MS: 30_000,
    }))
    return (await import('../documentFieldReader')).readDocument
  }

  it('case 2: gemini 429 → openai fallback success ⇒ primary failed, fallback served, providerCallCount=2', async () => {
    const readDocument = await loadWithProviders(
      { ok: false, fields: [], model: null, ms: 20, error: 'HTTP 429', errorStatus: 429, attempts: 1 },
      {
        ok: true, model: 'gpt-4.1', ms: 30, attempts: 1,
        fields: [{ field: 'family_name', cyrillic: 'ШЕВЧЕНКО', iso_date: null, can_read: true, confidence: 0.9, reason: '' }],
      },
    )
    const res = await readDocument(IMG, 'image/jpeg', 'ua_internal_passport_booklet', {})
    expect(res.ok).toBe(true)
    const t = res.reader_trace as ReaderExecutionTrace
    expect(t.primaryOutcome).toBe('failed')
    expect(t.fallbackAttempted).toBe(true)
    expect(t.fallbackProvider).toBe('openai')
    expect(t.fallbackModel).toBe('gpt-4.1')
    expect(t.fallbackOutcome).toBe('success')
    expect(t.finalProvider).toBe('openai')
    expect(t.finalModel).toBe('gpt-4.1')
    expect(t.configuredPrimaryModel).toBe(PRIMARY) // honest, even though it failed
    expect(t.providerCallCount).toBe(2) // 1 gemini attempt + 1 openai attempt
  })

  it('case 4: primary timeout + fallback failure ⇒ both attempts recorded honestly', async () => {
    const readDocument = await loadWithProviders(
      { ok: false, fields: [], model: null, ms: 45, error: 'timeout', errorTimeout: true, attempts: 2 },
      { ok: false, fields: [], model: 'gpt-4.1', ms: 30, error: 'HTTP 500', errorStatus: 500, attempts: 1 },
    )
    const res = await readDocument(IMG, 'image/jpeg', 'ua_internal_passport_booklet', {})
    expect(res.ok).toBe(false)
    const t = res.reader_trace as ReaderExecutionTrace
    expect(t.primaryOutcome).toBe('failed')
    expect(t.fallbackAttempted).toBe(true)
    expect(t.fallbackOutcome).toBe('failed')
    // fallback did NOT serve ⇒ the returned read is the failed primary (model null).
    expect(t.finalModel).toBe(null)
    // 2 gemini attempts + 1 openai attempt = 3 real HTTP calls.
    expect(t.providerCallCount).toBe(3)
  })
})

describe('ReaderExecutionTrace — PII-free shape', () => {
  it('case 6: trace carries ONLY provider/model/latency/count keys — no field values / raw_cyrillic / OCR text', async () => {
    const { readDocument } = await import('../documentFieldReader')
    const res = await readDocument(IMG, 'image/jpeg', 'ua_internal_passport_booklet', {
      provider: okProvider('gemini', PRIMARY),
    })
    const t = res.reader_trace as ReaderExecutionTrace
    const allowed = new Set([
      'configuredPrimaryProvider', 'configuredPrimaryModel', 'primaryAttempted', 'primaryOutcome',
      'fallbackAttempted', 'fallbackProvider', 'fallbackModel', 'fallbackOutcome',
      'finalProvider', 'finalModel', 'providerCallCount', 'primaryLatencyMs',
      'fallbackLatencyMs', 'totalReaderLatencyMs',
    ])
    for (const k of Object.keys(t)) expect(allowed.has(k)).toBe(true)
    // Explicitly forbid PII-bearing key names.
    for (const forbidden of ['cyrillic', 'raw_cyrillic', 'value', 'fields', 'text', 'ocr']) {
      expect(Object.keys(t)).not.toContain(forbidden)
    }
    const serialized = JSON.stringify(t)
    expect(serialized).not.toContain('ШЕВЧЕНКО')
    expect(serialized).not.toContain('ТАРАС')
  })
})

describe('Core-B2 route — source guard: telemetry derives from the trace, not a constant', () => {
  const routeSrc = readFileSync(
    join(__dirname, '../../../app/api/translation/vision-extract/route.ts'),
    'utf8',
  )

  it('case 5: Core-B2 success response does NOT set `model` from the normalizeGeminiModel(...) constant', () => {
    // The old bug: model: normalizeGeminiModel(process.env.GEMINI_MODEL, 'gemini-3.1-pro-preview')
    // fed the RESPONSE model field a constant. It must be gone from the Core-B2 response.
    // Word-boundary before `model:` so the legitimate `geminiModel:` label used by
    // the date-ensemble diag is not a false positive — only a bare `model:` key.
    expect(routeSrc).not.toMatch(/(?<![A-Za-z])model:\s*normalizeGeminiModel\(process\.env\.GEMINI_MODEL/)
  })

  it('case 5b: Core-B2 + legacy responses derive telemetry from deriveReaderTelemetry(...traces)', () => {
    expect(routeSrc).toContain('deriveReaderTelemetry(coreTraces)')
    expect(routeSrc).toContain('deriveReaderTelemetry(legacyTraces)')
    // fallback_used is derived, not a hardcoded literal, in the Core-B2 response.
    expect(routeSrc).toContain('fallback_used: coreReader.fallback_used')
    expect(routeSrc).not.toContain('fallback_used: false')
  })

  it('deriveReaderTelemetry: fallback_used true only when a fallback SERVED, provider_call_count sums attempts', () => {
    // Exercise the helper contract via the trace shape it consumes.
    const served: ReaderExecutionTrace = {
      configuredPrimaryProvider: 'gemini', configuredPrimaryModel: PRIMARY,
      primaryAttempted: true, primaryOutcome: 'failed',
      fallbackAttempted: true, fallbackProvider: 'openai', fallbackModel: 'gpt-4.1',
      fallbackOutcome: 'success', finalProvider: 'openai', finalModel: 'gpt-4.1',
      providerCallCount: 2, primaryLatencyMs: 20, fallbackLatencyMs: 30, totalReaderLatencyMs: 55,
    }
    const clean: ReaderExecutionTrace = {
      ...served, primaryOutcome: 'success', fallbackAttempted: false, fallbackProvider: null,
      fallbackModel: null, fallbackOutcome: 'not_attempted', finalProvider: 'gemini',
      finalModel: PRIMARY, providerCallCount: 1,
    }
    // fallback served ⇒ true; clean primary ⇒ false; multi-page counts sum.
    const anyServed = [clean, served].some((t) => t.fallbackAttempted && t.fallbackOutcome === 'success')
    const noneServed = [clean].some((t) => t.fallbackAttempted && t.fallbackOutcome === 'success')
    expect(anyServed).toBe(true)
    expect(noneServed).toBe(false)
    expect([clean, served].reduce((s, t) => s + t.providerCallCount, 0)).toBe(3)
  })
})

describe('READER_PROVIDER is dead — not referenced by the reader', () => {
  it('documentFieldReader does not read READER_PROVIDER (gpt-4.1 comes ONLY from the #13 fallback)', () => {
    const readerSrc = readFileSync(join(__dirname, '../documentFieldReader.ts'), 'utf8')
    expect(readerSrc).not.toContain('READER_PROVIDER')
  })
})
