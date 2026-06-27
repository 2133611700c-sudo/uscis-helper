/**
 * orientationConvention.test.ts — Step-5b DETERMINISTIC orientation-geometry proof (NO Gemini).
 * Uses a synthetic asymmetric marker (black bar at TOP) + pixel sampling as ground truth, to settle
 * the angle convention and the EXIF interaction independently of model intelligence.
 * Proves: (1) preprocessImage applies EXIF exactly ONCE and strips the tag (no double-rotate downstream);
 *         (2) applying correction = the grid cell's cw restores upright for any content rotation.
 */
import { describe, it, expect } from 'vitest'
import sharp from 'sharp'
import { preprocessImage } from '../../../ocr/image-preprocess'
import { positionToCorrectionCw } from '../detectOrientation'

// upright reference: white landscape with a HEAVY black band across the TOP edge (asymmetry for
// ground-truth orientation) + scattered black squares as texture (so the quality/blur gate passes).
async function uprightMarker(): Promise<Buffer> {
  const W = 300, H = 200
  const band = await sharp({ create: { width: W, height: 44, channels: 3, background: { r: 0, g: 0, b: 0 } } }).png().toBuffer()
  const dot = await sharp({ create: { width: 6, height: 6, channels: 3, background: { r: 0, g: 0, b: 0 } } }).png().toBuffer()
  const comps: sharp.OverlayOptions[] = [{ input: band, top: 0, left: 0 }]
  let seed = 1; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff }
  for (let i = 0; i < 90; i++) comps.push({ input: dot, top: 56 + Math.floor(rnd() * (H - 64)), left: Math.floor(rnd() * (W - 6)) })
  return sharp({ create: { width: W, height: H, channels: 3, background: { r: 255, g: 255, b: 255 } } }).composite(comps).jpeg().toBuffer()
}

// which edge holds the dark bar — ground truth orientation, by pixel sampling
async function barEdge(buf: Buffer): Promise<'top' | 'bottom' | 'left' | 'right'> {
  const N = 60
  const { data } = await sharp(buf).removeAlpha().grayscale().resize(N, N, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true })
  const px = (x: number, y: number) => data[y * N + x]
  const band = 9
  let top = 0, bottom = 0, left = 0, right = 0
  for (let y = 0; y < band; y++) for (let x = 0; x < N; x++) { top += px(x, y); bottom += px(x, N - 1 - y) }
  for (let x = 0; x < band; x++) for (let y = 0; y < N; y++) { left += px(x, y); right += px(N - 1 - x, y) }
  return (Object.entries({ top, bottom, left, right }).sort((a, b) => a[1] - b[1])[0][0]) as any
}

describe('Step-5b: orientation geometry convention (deterministic, no Gemini)', () => {
  it('sanity: upright marker has the bar at TOP', async () => {
    expect(await barEdge(await uprightMarker())).toBe('top')
  })

  it('preprocessImage applies EXIF EXACTLY ONCE and strips the orientation tag', async () => {
    const U = await uprightMarker()
    // store pixels rotated 270° CW with EXIF tag 6 (= "rotate 90° CW to display"): 270+90=360=upright.
    const sideways = await sharp(U).rotate(270).withMetadata({ orientation: 6 }).jpeg().toBuffer()
    const pre = await preprocessImage(sideways, 'image/jpeg')
    expect(pre.ok).toBe(true)
    if (!pre.ok) return
    // EXIF applied EXACTLY ONCE → upright. (zero → sideways; twice → over-rotated; only once → top.)
    expect(await barEdge(pre.buffer)).toBe('top')
    // tag stripped → a later sharp() will NOT re-apply EXIF (no double rotation downstream)
    const meta = await sharp(pre.buffer).metadata()
    expect(meta.orientation === undefined || meta.orientation === 1).toBe(true)
  })

  it('correction = grid cell cw restores upright for every content rotation (apply ONCE)', async () => {
    const U = await uprightMarker()
    for (const R of [0, 90, 180, 270] as const) {
      // content physically rotated R° CW, no EXIF
      const input = await sharp(U).rotate(R).jpeg().toBuffer()
      // the grid cell that looks upright is the one whose extra rotation cancels R: cw=(360-R)%360
      const uprightCw = (360 - R) % 360
      const correction = positionToCorrectionCw(
        ({ 0: 'top-left', 90: 'top-right', 180: 'bottom-left', 270: 'bottom-right' } as Record<number, string>)[uprightCw],
      )
      expect(correction).toBe(uprightCw) // CELLS mapping is consistent
      // orientToUpright applies sharp(input).rotate(correction) — verify it lands upright
      const corrected = await sharp(input).rotate(correction!).jpeg().toBuffer()
      expect(await barEdge(corrected), `R=${R} cw=${correction}`).toBe('top')
    }
  })
})
