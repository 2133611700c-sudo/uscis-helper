/**
 * orient.test.ts — deterministic regression for the OSD orientation bug.
 *
 * BUG (shipped in #19, found in P0/P1): detectOrientationOsd computed the corrective
 * rotation as (360 - orientation_degrees), which INVERTS 90↔270 and leaves those
 * variants upside-down; and it did not force the legacy OSD engine. Verified on real
 * 0/90/180/270 fixtures that the fix (apply `orientation_degrees` directly + OEM 0)
 * corrects every rotation to upright. This test locks the corrective mapping and the
 * fail-closed behavior WITHOUT needing the real tesseract engine/traineddata in CI.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import sharp from 'sharp'

// Mocked OSD output the fake tesseract worker returns; set per test.
let osdDegrees = 0
let osdConfidence = 0

vi.mock('tesseract.js', () => ({
  OEM: { TESSERACT_ONLY: 0 },
  createWorker: vi.fn(async () => ({
    detect: vi.fn(async () => ({
      data: { orientation_degrees: osdDegrees, orientation_confidence: osdConfidence },
    })),
    terminate: vi.fn(async () => {}),
  })),
}))

import { detectOrientationOsd, applyOrientation } from '../orient'

const IMG = Buffer.from('fake') // detect() is mocked, so bytes are irrelevant here

beforeEach(() => { osdDegrees = 0; osdConfidence = 0 })
afterEach(() => { vi.clearAllMocks() })

describe('detectOrientationOsd — corrective = orientation_degrees (direct, not 360-deg)', () => {
  // The core regression: a 90°-CW-rotated page makes tesseract report orientation_degrees=270;
  // the corrective must be 270 (proven upright), NOT 90 (the old inverted value).
  const cases: Array<[number, number]> = [
    [0, 0],
    [90, 90],
    [180, 180],
    [270, 270],
  ]
  for (const [deg, expected] of cases) {
    it(`orientation_degrees=${deg} ⇒ rotation ${expected}`, async () => {
      osdDegrees = deg
      osdConfidence = 13 // above MIN_OSD_CONFIDENCE
      const r = await detectOrientationOsd(IMG)
      expect(r.rotation).toBe(expected)
      // confident only when a real corrective rotation is needed
      expect(r.confident).toBe(expected !== 0)
    })
  }

  it('never returns the inverted (360-deg) value: deg=270 ⇒ 270, not 90', async () => {
    osdDegrees = 270; osdConfidence = 13
    const r = await detectOrientationOsd(IMG)
    expect(r.rotation).toBe(270)
    expect(r.rotation).not.toBe(90)
  })

  it('low confidence ⇒ fail-closed (rotation 0, not confident)', async () => {
    osdDegrees = 90; osdConfidence = 0.4 // below MIN_OSD_CONFIDENCE (1.0)
    const r = await detectOrientationOsd(IMG)
    expect(r).toEqual({ rotation: 0, confident: false })
  })

  it('upright page (deg=0) ⇒ no rotation, not confident', async () => {
    osdDegrees = 0; osdConfidence = 20
    const r = await detectOrientationOsd(IMG)
    expect(r).toEqual({ rotation: 0, confident: false })
  })
})

describe('detectOrientationOsd — source guard: forces legacy OSD engine', () => {
  it('does not pass `?? undefined` for OEM (would silently fall back to LSTM = no OSD)', async () => {
    const { readFileSync } = await import('node:fs')
    const { fileURLToPath } = await import('node:url')
    const { dirname, resolve } = await import('node:path')
    const dir = dirname(fileURLToPath(import.meta.url))
    const src = readFileSync(resolve(dir, '..', 'orient.ts'), 'utf8')
    expect(src).not.toMatch(/TESSERACT_ONLY\s*\?\?\s*undefined/)
    expect(src).toMatch(/TESSERACT_ONLY\s*\?\?\s*0/)
    // and the corrective must be the direct degrees, not the inverted form
    expect(src).not.toMatch(/toOrientation\(\(360 - deg\)/)
    expect(src).toMatch(/const corrective = toOrientation\(deg\)/)
  })
})

describe('applyOrientation — physical rotation mechanism (real sharp)', () => {
  it('rotation 0 ⇒ same buffer reference (no work)', async () => {
    const buf = await sharp({ create: { width: 60, height: 40, channels: 3, background: { r: 200, g: 200, b: 200 } } }).jpeg().toBuffer()
    const out = await applyOrientation(buf, 0)
    expect(out).toBe(buf)
  })

  it('rotation 90 ⇒ dimensions physically swap', async () => {
    const buf = await sharp({ create: { width: 60, height: 40, channels: 3, background: { r: 200, g: 200, b: 200 } } }).jpeg().toBuffer()
    const out = await applyOrientation(buf, 90)
    const meta = await sharp(out).metadata()
    expect(meta.width).toBe(40)
    expect(meta.height).toBe(60)
  })
})
