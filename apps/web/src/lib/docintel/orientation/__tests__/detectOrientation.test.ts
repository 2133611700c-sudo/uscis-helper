/**
 * detectOrientation.test.ts — content-based orientation detector (grid compare).
 * Pure/deterministic: position→correction mapping, grid geometry, and fail-open contract
 * (a failed/awol Gemini call ⇒ original buffer, applied 0, never throws). No live Gemini.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import sharp from 'sharp'
import {
  positionToCorrectionCw,
  buildOrientationGrid,
  orientToUpright,
  detectUprightCw,
  isContentOrientEnabled,
} from '../detectOrientation'

afterEach(() => { vi.restoreAllMocks() })

/** A small valid test image (red 200x300 portrait) as a JPEG buffer. */
async function testImage(): Promise<Buffer> {
  return sharp({ create: { width: 200, height: 300, channels: 3, background: '#cc0000' } }).jpeg().toBuffer()
}

describe('positionToCorrectionCw', () => {
  it('maps each grid position to its rotation', () => {
    expect(positionToCorrectionCw('top-left')).toBe(0)
    expect(positionToCorrectionCw('top-right')).toBe(90)
    expect(positionToCorrectionCw('bottom-left')).toBe(180)
    expect(positionToCorrectionCw('bottom-right')).toBe(270)
  })
  it('tolerates case/whitespace', () => {
    expect(positionToCorrectionCw('  TOP-RIGHT ')).toBe(90)
  })
  it('returns null for anything unrecognized', () => {
    expect(positionToCorrectionCw('middle')).toBeNull()
    expect(positionToCorrectionCw(undefined)).toBeNull()
    expect(positionToCorrectionCw(90)).toBeNull()
    expect(positionToCorrectionCw(null)).toBeNull()
  })
})

describe('buildOrientationGrid', () => {
  it('produces a valid square JPEG of the expected size', async () => {
    const grid = await buildOrientationGrid(await testImage(), 480, 10)
    const meta = await sharp(grid).metadata()
    expect(meta.format).toBe('jpeg')
    expect(meta.width).toBe(480 * 2 + 10 * 3) // 990
    expect(meta.height).toBe(990)
  })
})

describe('orientToUpright — fail-open', () => {
  it('detection failure (fetch throws) ⇒ original buffer, applied 0, detected false', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network') }))
    const buf = await testImage()
    const out = await orientToUpright(buf, 'key', 'gemini-3.1-pro-preview')
    expect(out.applied).toBe(0)
    expect(out.detected).toBe(false)
    expect(out.buffer).toBe(buf) // unchanged reference
  })

  it('model picks top-right (90°) ⇒ buffer rotated, applied 90, detected true', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: '{"pos":"top-right"}' }] } }] }),
    })))
    const buf = await testImage() // 200x300 portrait
    const out = await orientToUpright(buf, 'key', 'gemini-3.1-pro-preview')
    expect(out.applied).toBe(90)
    expect(out.detected).toBe(true)
    const meta = await sharp(out.buffer).metadata()
    expect(meta.width).toBe(300) // dimensions swapped by the 90° rotation
    expect(meta.height).toBe(200)
  })

  it('model says top-left (0°) ⇒ no rotation, detected true', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: '{"pos":"top-left"}' }] } }] }),
    })))
    const buf = await testImage()
    const out = await orientToUpright(buf, 'key', 'gemini-3.1-pro-preview')
    expect(out.applied).toBe(0)
    expect(out.detected).toBe(true)
    expect(out.buffer).toBe(buf)
  })

  it('HTTP error ⇒ detectUprightCw null', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 429, json: async () => ({}) })))
    expect(await detectUprightCw(await testImage(), 'key', 'm')).toBeNull()
  })
})

describe('isContentOrientEnabled', () => {
  it('default OFF; only "1" enables', () => {
    expect(isContentOrientEnabled({})).toBe(false)
    expect(isContentOrientEnabled({ CONTENT_ORIENT_ENABLED: '0' })).toBe(false)
    expect(isContentOrientEnabled({ CONTENT_ORIENT_ENABLED: '1' })).toBe(true)
  })
})
