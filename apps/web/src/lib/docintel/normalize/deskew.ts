/**
 * docintel/normalize/deskew — deterministic, FREE (sharp only, no LLM) skew
 * estimation + correction via projection-profile variance.
 *
 * Idea: text lines make horizontal row-sums peak when the page is level. Rotating
 * the page and measuring the VARIANCE of the row-sum projection is maximal at the
 * true skew angle. Bounded to ±8° and cheap (downscaled grayscale).
 */

import sharp from 'sharp'

const MAX_SKEW_DEG = 8
const STEP_DEG = 0.5
const TARGET_WIDTH = 600
const APPLY_THRESHOLD_DEG = 0.3

/**
 * Estimate skew in degrees (signed). Positive/negative follow sharp.rotate()
 * convention (the value you pass to applyDeskew to correct it). Returns 0 when
 * the image is too small or the projection signal is flat (guard against noise).
 */
export async function estimateSkewDeg(buf: Buffer): Promise<number> {
  let raw: { data: Buffer; info: sharp.OutputInfo }
  try {
    raw = await sharp(buf)
      .greyscale()
      .resize({ width: TARGET_WIDTH, fit: 'inside', withoutEnlargement: true })
      .raw()
      .toBuffer({ resolveWithObject: true })
  } catch {
    return 0
  }

  const { data, info } = raw
  const width = info.width
  const height = info.height
  if (width < 40 || height < 40) return 0

  // Precompute per-pixel "ink" intensity (dark = ink). Use 255 - gray so text rows peak.
  const ink = new Float64Array(width * height)
  for (let i = 0; i < width * height; i++) {
    ink[i] = 255 - data[i * (info.channels ?? 1)]
  }

  let bestAngle = 0
  let bestVariance = -1
  let flatCheckVarianceAtZero = 0

  for (let deg = -MAX_SKEW_DEG; deg <= MAX_SKEW_DEG + 1e-9; deg += STEP_DEG) {
    const variance = projectionVariance(ink, width, height, deg)
    if (Math.abs(deg) < 1e-9) flatCheckVarianceAtZero = variance
    if (variance > bestVariance) {
      bestVariance = variance
      bestAngle = deg
    }
  }

  // Guard against flat/noisy images: if the best angle barely beats level, treat
  // it as no skew. A real skew produces a clearly higher variance than at 0°.
  if (bestVariance <= 0) return 0
  if (flatCheckVarianceAtZero > 0 && bestVariance < flatCheckVarianceAtZero * 1.02) {
    return 0
  }

  const clamped = Math.max(-MAX_SKEW_DEG, Math.min(MAX_SKEW_DEG, bestAngle))
  return Math.round(clamped * 10) / 10
}

/**
 * Variance of the horizontal projection (row sums) after rotating the ink map by
 * `deg`. We sample via a shear-free rotation of coordinates (nearest-neighbour)
 * which is enough for angle scoring and stays cheap.
 */
function projectionVariance(
  ink: Float64Array,
  width: number,
  height: number,
  deg: number,
): number {
  const rad = (deg * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const cx = width / 2
  const cy = height / 2
  const rowSums = new Float64Array(height)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = x - cx
      const dy = y - cy
      // Inverse-map the destination row `y` back to a source pixel.
      const sy = Math.round(cy + dx * sin + dy * cos)
      if (sy < 0 || sy >= height) continue
      rowSums[y] += ink[sy * width + x]
    }
  }

  let mean = 0
  for (let y = 0; y < height; y++) mean += rowSums[y]
  mean /= height
  let variance = 0
  for (let y = 0; y < height; y++) {
    const d = rowSums[y] - mean
    variance += d * d
  }
  return variance / height
}

/**
 * Apply the skew correction. Below the threshold the input buffer is returned
 * UNCHANGED (same reference) — no image processing at all.
 */
export async function applyDeskew(buf: Buffer, deg: number): Promise<Buffer> {
  if (Math.abs(deg) < APPLY_THRESHOLD_DEG) return buf
  return sharp(buf).rotate(deg, { background: '#ffffff' }).jpeg().toBuffer()
}
