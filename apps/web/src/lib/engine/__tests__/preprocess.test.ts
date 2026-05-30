/**
 * preprocess.test.ts — B3 D0 intake: sharp preprocessing + quality gate.
 * Uses sharp to synthesize real image buffers (no fixtures needed).
 */
import { describe, it, expect } from 'vitest'
import sharp from 'sharp'
import { preprocessImage, assessQuality } from '../preprocess'

async function solid(width: number, height: number, gray: number): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: { r: gray, g: gray, b: gray } } }).jpeg().toBuffer()
}

describe('B3 — preprocess + quality gate', () => {
  it('preprocessImage downscales + greyscales a large photo to JPEG', async () => {
    const big = await solid(4000, 3000, 128)
    const r = await preprocessImage(big, 'image/jpeg')
    expect(r.applied).toBe(true)
    const meta = await sharp(r.image).metadata()
    expect(Math.max(meta.width!, meta.height!)).toBeLessThanOrEqual(2000) // resized
    expect(r.mime).toBe('image/jpeg')
  })

  it('preprocess fails OPEN on garbage input (returns original, never throws)', async () => {
    const junk = Buffer.from('not an image')
    const r = await preprocessImage(junk, 'image/jpeg')
    expect(r.applied).toBe(false)
    expect(r.image).toBe(junk)
  })

  it('quality gate flags low resolution', async () => {
    const tiny = await solid(300, 200, 128)
    const q = await assessQuality(tiny)
    expect(q.ok).toBe(false)
    expect(q.reason).toBe('low_resolution')
  })

  it('quality gate flags too dark', async () => {
    const dark = await solid(1200, 1000, 10)
    const q = await assessQuality(dark)
    expect(q.ok).toBe(false)
    expect(q.reason).toBe('too_dark')
  })

  it('quality gate passes a normal photo', async () => {
    const good = await solid(1500, 1200, 140)
    const q = await assessQuality(good)
    expect(q.ok).toBe(true)
  })
})
