/**
 * image-preprocess unit tests (R3).
 *
 * Proves the sizing regimes added in R3 without any network/Gemini call:
 *   - a SMALL scan (600px short side) is UPSCALED so its short side grows to ~1500px
 *   - a LARGE scan (4000px) is DOWNSCALED so its long side is ≤2048px
 *   - a MID scan is left untouched
 *   - output is always a valid JPEG
 *   - a corrupt buffer is handled (returns a typed corrupt_image error, never throws)
 *
 * Test images are generated in-memory with sharp (no fixtures). They use random
 * RGB noise so the blur/brightness quality gate passes (a flat color is "too_blurry").
 */
import { describe, it, expect } from 'vitest'
import sharp from 'sharp'
import { preprocessImage } from '../image-preprocess'

/** Generate a noisy JPEG of the given pixel dimensions (passes the blur/brightness gate). */
async function makeJpeg(width: number, height: number): Promise<Buffer> {
  const channels = 3
  const noise = Buffer.alloc(width * height * channels)
  for (let i = 0; i < noise.length; i++) {
    // Mid-range noise: avoids too_dark / too_bright, lots of edges → not too_blurry.
    noise[i] = 30 + Math.floor(Math.random() * 196)
  }
  return sharp(noise, { raw: { width, height, channels } })
    .jpeg({ quality: 90 })
    .toBuffer()
}

const MIN_SHORT_SIDE = 1500
const MAX_DIMENSION = 2048

describe('preprocessImage — R3 sizing', () => {
  it('UPSCALES a small near-square (600px) image so its short side reaches ~1500px', async () => {
    // 600x650 → short 600 < 1500, long after 2.5x = 1625 ≤ 2048 → short hits ~1500
    const input = await makeJpeg(600, 650)
    const res = await preprocessImage(input, 'image/jpeg')
    expect(res.ok).toBe(true)
    if (!res.ok) return
    const shortSide = Math.min(res.width, res.height)
    expect(shortSide).toBeGreaterThanOrEqual(MIN_SHORT_SIDE - 2) // ~1500 (allow rounding)
    expect(res.scaleFactor).toBeGreaterThan(1)
    expect(res.resized).toBe(true)
    expect(Math.max(res.width, res.height)).toBeLessThanOrEqual(MAX_DIMENSION)
  })

  it('UPSCALES a small long page but lets the down-cap clamp the long side ≤2048', async () => {
    // 600x900 → upscale toward short=1500 would give long=2250 > 2048; the long-cap
    // clamps the factor so long=2048 and short lands below the 1500 target.
    const input = await makeJpeg(600, 900)
    const res = await preprocessImage(input, 'image/jpeg')
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.scaleFactor).toBeGreaterThan(1)                     // still enlarged
    expect(Math.max(res.width, res.height)).toBeLessThanOrEqual(MAX_DIMENSION) // cap wins
    expect(Math.min(res.width, res.height)).toBeGreaterThan(600)   // short side grew
    expect(Math.min(res.width, res.height)).toBeLessThan(MIN_SHORT_SIDE) // but below 1500
  })

  it('caps upscale at 3x for a tiny thumbnail', async () => {
    // 300x300 → 3x cap → ~900px (NOT 1500, which would be 5x)
    const input = await makeJpeg(300, 300)
    const res = await preprocessImage(input, 'image/jpeg')
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.scaleFactor).toBeCloseTo(3, 1)
    expect(Math.min(res.width, res.height)).toBeLessThan(MIN_SHORT_SIDE)
    expect(Math.min(res.width, res.height)).toBeGreaterThanOrEqual(890)
  })

  it('DOWNSCALES a large (4000px) image to long side ≤2048px', async () => {
    const input = await makeJpeg(4000, 3000)
    const res = await preprocessImage(input, 'image/jpeg')
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(Math.max(res.width, res.height)).toBeLessThanOrEqual(MAX_DIMENSION)
    expect(res.scaleFactor).toBeLessThan(1)
    expect(res.resized).toBe(true)
  })

  it('leaves a mid-sized image (1600x1700) untouched in dimensions', async () => {
    // short 1600 ≥ 1500 (no upscale), long 1700 ≤ 2048 (no downscale)
    const input = await makeJpeg(1600, 1700)
    const res = await preprocessImage(input, 'image/jpeg')
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.scaleFactor).toBe(1.0)
    expect(res.resized).toBe(false)
    expect(res.width).toBe(1600)
    expect(res.height).toBe(1700)
  })

  it('always emits a valid JPEG buffer', async () => {
    const input = await makeJpeg(600, 800)
    const res = await preprocessImage(input, 'image/jpeg')
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.mimeType).toBe('image/jpeg')
    const meta = await sharp(res.buffer).metadata()
    expect(meta.format).toBe('jpeg')
    expect(meta.width).toBe(res.width)
    expect(meta.height).toBe(res.height)
  })

  it('handles a corrupt buffer without throwing (typed corrupt_image error)', async () => {
    const corrupt = Buffer.from('not-an-image-at-all', 'utf8')
    const res = await preprocessImage(corrupt, 'image/jpeg')
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.code).toBe('corrupt_image')
  })
})
