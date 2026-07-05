/**
 * blankCropGate — plan §7 mandatory gate. FICTIONAL/synthetic images only.
 * Pins: blank/near-blank crops are gated; real-looking strokes pass; gate failure
 * fails OPEN toward reading (never blocks a doc on a decode hiccup).
 */
import { describe, it, expect } from 'vitest'
import sharp from 'sharp'
import { judgeBlankCrop } from '../blankCropGate'

const blankCrop = () =>
  sharp({ create: { width: 600, height: 90, channels: 3, background: '#f4f1ea' } }).png().toBuffer()

/** synthetic "handwriting": a few dark strokes on paper */
const strokedCrop = async () => {
  const svg = `<svg width="600" height="90">
    <rect width="600" height="90" fill="#f4f1ea"/>
    <path d="M40 60 C 90 20, 140 70, 190 40 S 290 65, 340 35" stroke="#2a2a33" stroke-width="4" fill="none"/>
    <path d="M370 55 q 30 -35 60 0 t 60 0" stroke="#2a2a33" stroke-width="4" fill="none"/>
  </svg>`
  return sharp(Buffer.from(svg)).png().toBuffer()
}

describe('judgeBlankCrop', () => {
  it('blank paper crop → gated (blank_crop_or_low_ink)', async () => {
    const v = await judgeBlankCrop(await blankCrop())
    expect(v.blank).toBe(true)
    expect(v.reason).toBe('blank_crop_or_low_ink')
  })

  it('crop with handwriting-like strokes → passes to the reader', async () => {
    const v = await judgeBlankCrop(await strokedCrop())
    expect(v.blank).toBe(false)
    expect(v.inkRatio).toBeGreaterThan(0.004)
  })

  it('undecodable buffer → fail-OPEN toward reading (never blocks the doc)', async () => {
    const v = await judgeBlankCrop(Buffer.from('not an image'))
    expect(v.blank).toBe(false)
    expect(v.inkRatio).toBe(-1)
  })
})
