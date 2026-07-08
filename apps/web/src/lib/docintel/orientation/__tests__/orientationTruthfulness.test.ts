/**
 * orientationTruthfulness.test.ts — One Brain priority #1 (2026-07-07): enabled ≠ attempted ≠
 * measured ≠ trusted ≠ final.
 *
 * ROOT BUG this pins: documentFieldReader.ts used to compute
 * `contentOrientRan: isContentOrientEnabled()` and gate the ENTIRE orientation call behind a
 * second `if (apiKey)` check — so when the Gemini key was missing, orientToUpright() was never
 * even called, yet the posture envelope still reported `orientation_status: 'upright'` (medium
 * confidence) for a document that was NEVER checked. These tests assert CAUSALITY, not just the
 * final angle: which provider was attempted, which one actually produced the measurement, and
 * that `angle`/`provider` fields are never populated for a provider that didn't earn them.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import sharp from 'sharp'
import {
  orientToUpright,
  normalizeOrientationTelemetry,
  newRawOrientTelemetry,
  type RawOrientTelemetry,
} from '../detectOrientation'
import { PRIMARY_READER } from '../../modelMatrix'

afterEach(() => {
  vi.restoreAllMocks()
  delete process.env.OPENAI_API_KEY
})

/** Solid-color image: tesseract OSD reliably finds no script on it, so these tests exercise the
 *  Gemini/OpenAI provider layer specifically, not the free OSD shortcut. */
async function testImage(): Promise<Buffer> {
  return sharp({ create: { width: 200, height: 300, channels: 3, background: '#cc0000' } }).jpeg().toBuffer()
}

describe('normalizeOrientationTelemetry — pure status derivation (guardrail #2, no other code computes this)', () => {
  it('CONTENT_ORIENT_ENABLED=0 (disabled): enabled=false, attempted=false, measured=false, angle=null, status=disabled', () => {
    const t = normalizeOrientationTelemetry(newRawOrientTelemetry(), false)
    expect(t.enabled).toBe(false)
    expect(t.attempted).toBe(false)
    expect(t.measured).toBe(false)
    expect(t.trusted).toBe(false)
    expect(t.angle).toBeNull()
    expect(t.primaryProvider).toBeNull()
    expect(t.fallbackProvider).toBeNull()
    expect(t.status).toBe('disabled')
  })

  it('enabled but nothing was ever attempted: not_measured_no_provider, angle=null', () => {
    const t = normalizeOrientationTelemetry(newRawOrientTelemetry(), true)
    expect(t.enabled).toBe(true)
    expect(t.attempted).toBe(false)
    expect(t.measured).toBe(false)
    expect(t.angle).toBeNull()
    expect(t.status).toBe('not_measured_no_provider')
  })

  it('attempted but both providers hard-failed (no response at all): attempted_failed, angle=null', () => {
    const raw: RawOrientTelemetry = { ...newRawOrientTelemetry(), primaryAttempted: true, primaryErrorCode: 'network_error' }
    const t = normalizeOrientationTelemetry(raw, true)
    expect(t.attempted).toBe(true)
    expect(t.measured).toBe(false)
    expect(t.angle).toBeNull()
    expect(t.primaryProvider).toBeNull() // attempted ≠ earned the provider slot
    expect(t.status).toBe('attempted_failed')
  })

  it('attempted, a response came back but was unusable: uncertain_low_confidence, angle=null', () => {
    const raw: RawOrientTelemetry = { ...newRawOrientTelemetry(), primaryAttempted: true, anyResponseReceived: true, primaryErrorCode: 'unrecognized_position' }
    const t = normalizeOrientationTelemetry(raw, true)
    expect(t.measured).toBe(false)
    expect(t.angle).toBeNull()
    expect(t.status).toBe('uncertain_low_confidence')
  })

  it('primary measured 0° (upright): measured_upright, trusted=true, provider=gemini', () => {
    const raw: RawOrientTelemetry = { ...newRawOrientTelemetry(), primaryAttempted: true, primarySucceeded: true, angle: 0 }
    const t = normalizeOrientationTelemetry(raw, true)
    expect(t.measured).toBe(true)
    expect(t.trusted).toBe(true)
    expect(t.angle).toBe(0)
    expect(t.primaryProvider).toBe('gemini')
    expect(t.fallbackProvider).toBeNull()
    expect(t.status).toBe('measured_upright')
  })

  it('primary measured a real rotation: measured_rotated', () => {
    const raw: RawOrientTelemetry = { ...newRawOrientTelemetry(), primaryAttempted: true, primarySucceeded: true, angle: 270 }
    const t = normalizeOrientationTelemetry(raw, true)
    expect(t.angle).toBe(270)
    expect(t.status).toBe('measured_rotated')
  })

  it('fallback carried the measurement, primary never succeeded: fallback_measured, trusted=false', () => {
    const raw: RawOrientTelemetry = {
      ...newRawOrientTelemetry(),
      primaryAttempted: true, primaryErrorCode: 'http_5xx',
      fallbackAttempted: true, fallbackSucceeded: true, angle: 90,
    }
    const t = normalizeOrientationTelemetry(raw, true)
    expect(t.measured).toBe(true)
    expect(t.trusted).toBe(false) // ADR-018: fallback reads are never acceptance-grade
    expect(t.primaryProvider).toBeNull() // primary never earned it
    expect(t.fallbackProvider).toBe('openai')
    expect(t.status).toBe('fallback_measured')
  })
})

describe('orientToUpright — causal telemetry end-to-end (mocked fetch, real control flow)', () => {
  it('scenario 1: Gemini key exists + succeeds → primaryAttempted=true, primaryMeasured=true, trusted=true', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: '{"pos":"top-right"}' }] } }] }),
    })))
    const out = await orientToUpright(await testImage(), 'real-gemini-key', PRIMARY_READER)
    const t = out.orientationTelemetry
    expect(t.enabled).toBe(true)
    expect(t.attempted).toBe(true)
    expect(t.primaryAttempted).toBe(true)
    expect(t.primaryMeasured).toBe(true)
    expect(t.primaryProvider).toBe('gemini')
    expect(t.trusted).toBe(true)
    expect(t.measured).toBe(true)
    expect(t.angle).toBe(90)
    expect(t.status).toBe('measured_rotated')
    expect(out.applied).toBe(90)
  })

  it('scenario 2: Gemini key missing + no OpenAI key → primaryAttempted=false, fallbackAttempted=false, not_measured_no_provider, angle=null, NEVER upright', async () => {
    delete process.env.OPENAI_API_KEY
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const out = await orientToUpright(await testImage(), '', PRIMARY_READER)
    const t = out.orientationTelemetry
    expect(t.primaryAttempted).toBe(false)
    expect(t.fallbackAttempted).toBe(false)
    expect(t.attempted).toBe(false)
    expect(t.measured).toBe(false)
    expect(t.angle).toBeNull()
    expect(t.status).toBe('not_measured_no_provider')
    expect(fetchSpy).not.toHaveBeenCalled() // no doomed Gemini call wasted on an empty key
    expect(out.detected).toBe(false) // never silently "upright"
  })

  it('scenario 3 (fallback success): Gemini key missing, OpenAI key present + succeeds → fallback_measured, trusted=false', async () => {
    process.env.OPENAI_API_KEY = 'real-openai-key'
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (String(url).includes('openai')) {
        return { ok: true, json: async () => ({ choices: [{ message: { content: '{"pos":"bottom-right"}' } }] }) }
      }
      throw new Error('no Gemini call expected with an empty key')
    }))
    const out = await orientToUpright(await testImage(), '', PRIMARY_READER)
    const t = out.orientationTelemetry
    expect(t.primaryAttempted).toBe(false)
    expect(t.fallbackAttempted).toBe(true)
    expect(t.fallbackMeasured).toBe(true)
    expect(t.fallbackProvider).toBe('openai')
    expect(t.primaryProvider).toBeNull()
    expect(t.trusted).toBe(false)
    expect(t.measured).toBe(true)
    expect(t.angle).toBe(270)
    expect(t.status).toBe('fallback_measured')
    expect(out.applied).toBe(270)
  })

  it('scenario 4: provider throws a network error (real key, no OpenAI fallback available) → attempted_failed, angle=null', async () => {
    delete process.env.OPENAI_API_KEY
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('ECONNRESET') }))
    const out = await orientToUpright(await testImage(), 'real-gemini-key', PRIMARY_READER)
    const t = out.orientationTelemetry
    expect(t.primaryAttempted).toBe(true)
    expect(t.primaryMeasured).toBe(false)
    expect(t.primaryErrorCode).toBe('network_error')
    expect(t.measured).toBe(false)
    expect(t.angle).toBeNull()
    expect(t.status).toBe('attempted_failed')
    expect(out.detected).toBe(false)
  })

  it('0/90/180/270 fixtures: each angle is measured AND the telemetry proves a real provider attempt', async () => {
    const cases: Array<['top-left' | 'top-right' | 'bottom-left' | 'bottom-right', 0 | 90 | 180 | 270]> = [
      ['top-left', 0], ['top-right', 90], ['bottom-left', 180], ['bottom-right', 270],
    ]
    for (const [pos, expectedAngle] of cases) {
      vi.stubGlobal('fetch', vi.fn(async () => ({
        ok: true,
        json: async () => ({ candidates: [{ content: { parts: [{ text: `{"pos":"${pos}"}` }] } }] }),
      })))
      const out = await orientToUpright(await testImage(), 'real-gemini-key', PRIMARY_READER)
      expect(out.applied).toBe(expectedAngle)
      const t = out.orientationTelemetry
      expect(t.primaryAttempted).toBe(true)
      expect(t.primaryMeasured).toBe(true)
      expect(t.angle).toBe(expectedAngle)
      expect(t.status).toBe(expectedAngle === 0 ? 'measured_upright' : 'measured_rotated')
    }
  })
})
