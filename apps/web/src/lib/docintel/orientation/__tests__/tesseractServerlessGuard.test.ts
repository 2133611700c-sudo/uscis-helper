/**
 * tesseractServerlessGuard.test.ts — 2026-07-08 INCIDENT regression.
 *
 * ROOT BUG this pins: tesseract.js's Node worker cannot run on Vercel's serverless build — the
 * platform's file-tracing does not bundle `tesseract.js`'s worker-thread script, so
 * `createWorker`/`.detect()` throws `Cannot find module '.../worker-script/node/index.js'` as an
 * UNCAUGHT EXCEPTION (not a rejected promise the existing try/catch could stop). Live-confirmed
 * on Preview: a real translation-route request hung until the platform's 120s maxDuration killed
 * it (504 FUNCTION_INVOCATION_TIMEOUT at ~120-245s), with the crash happening ~674ms in, long
 * before any Gemini call. Predates the 2026-07-07 orientation-truthfulness fix — always broken on
 * Vercel, never previously exercised end-to-end against a real deployment with a real document.
 *
 * FIX under test: `isTesseractOsdRuntimeSafe()` gates `detectTesseractOrientation()` so
 * tesseract.js is NEVER touched when `VERCEL` is set (Preview and Production share the build).
 * This is honest by construction — a skipped OSD is exactly the existing `null` "OSD
 * unavailable" contract `detectUprightCwVotedMeta` already falls through on; no telemetry claim
 * changes meaning.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import sharp from 'sharp'

const detectMock = vi.fn(async () => {
  throw new Error("Cannot find module '/var/task/apps/web/.next/worker-script/node/index.js'")
})

vi.mock('tesseract.js', () => ({ default: { detect: detectMock } }))

import { isTesseractOsdRuntimeSafe, detectUprightCwVotedMeta } from '../detectOrientation'

afterEach(() => {
  vi.restoreAllMocks()
  detectMock.mockClear()
  delete process.env.VERCEL
  delete process.env.TESSERACT_OSD_ENABLED
})

async function testImage(): Promise<Buffer> {
  return sharp({ create: { width: 200, height: 300, channels: 3, background: '#cc0000' } }).jpeg().toBuffer()
}

describe('isTesseractOsdRuntimeSafe — pure environment gate', () => {
  it('safe (true) when VERCEL is unset — local/dev/CI, where tesseract.js works fine', () => {
    expect(isTesseractOsdRuntimeSafe({})).toBe(true)
  })
  it('unsafe (false) when VERCEL=1 — Preview and Production share this build/bug', () => {
    expect(isTesseractOsdRuntimeSafe({ VERCEL: '1' })).toBe(false)
  })
  it('explicit TESSERACT_OSD_ENABLED=1 overrides VERCEL=1 (escape hatch once bundling is fixed)', () => {
    expect(isTesseractOsdRuntimeSafe({ VERCEL: '1', TESSERACT_OSD_ENABLED: '1' })).toBe(true)
  })
  it('explicit TESSERACT_OSD_ENABLED=0 disables even off Vercel', () => {
    expect(isTesseractOsdRuntimeSafe({ TESSERACT_OSD_ENABLED: '0' })).toBe(false)
  })
})

describe('incident regression: missing tesseract.js worker must never hang/crash the request', () => {
  it('VERCEL=1: tesseract.js is never invoked — no throw, no hang, vote falls through to the sampler', async () => {
    process.env.VERCEL = '1'
    const buf = await testImage()
    const sampler = vi.fn(async () => 0 as const)
    const result = await detectUprightCwVotedMeta(buf, 'fake-key', 'fake-model', { sampler, runs: 1 })
    expect(result.cw).toBe(0)
    expect(detectMock).not.toHaveBeenCalled()
  })

  it('off Vercel (VERCEL unset): the same code path DOES reach tesseract.js — proves the gate, not '
    + 'something else, is what skips it on Vercel; a rejected detect() is still caught (pre-existing '
    + 'contract) and does not throw', async () => {
    const buf = await testImage()
    const sampler = vi.fn(async () => 0 as const)
    const result = await detectUprightCwVotedMeta(buf, 'fake-key', 'fake-model', { sampler, runs: 1 })
    expect(result.cw).toBe(0)
    expect(detectMock).toHaveBeenCalled()
  })
})
