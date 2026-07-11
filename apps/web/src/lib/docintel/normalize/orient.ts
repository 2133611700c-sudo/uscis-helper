/**
 * docintel/normalize/orient — deterministic, FREE coarse orientation using
 * tesseract.js OSD (orientation & script detection). NO LLM, NO paid call.
 *
 * detectOrientationOsd → the 0/90/180/270 rotation needed to make text upright.
 * Fail-closed: any error / low confidence / missing tesseract ⇒ { rotation: 0,
 * confident: false }, never throws.
 *
 * applyOrientation physically rotates the BYTES with sharp — this is the
 * mechanism the CI test verifies with a known rotation.
 */

import sharp from 'sharp'
import type { Orientation } from './types'

// OSD confidence below this is treated as "not confident" → no rotation applied.
const MIN_OSD_CONFIDENCE = 1.0

function toOrientation(deg: number): Orientation {
  const n = ((Math.round(deg / 90) * 90) % 360 + 360) % 360
  if (n === 90 || n === 180 || n === 270) return n
  return 0
}

/**
 * Detect the corrective rotation (0/90/180/270) that makes text upright.
 * Uses tesseract.js OSD. Never throws; never a paid call.
 */
export async function detectOrientationOsd(
  buf: Buffer,
): Promise<{ rotation: Orientation; confident: boolean }> {
  try {
    const tesseract: any = await import('tesseract.js')
    // OSD needs the osd traineddata. detectOrientation returns the angle the
    // image is rotated BY; the corrective rotation is the same magnitude applied
    // to bring it upright (tesseract already reports the deg to rotate to correct).
    const worker = await tesseract.createWorker('osd', tesseract.OEM?.TESSERACT_ONLY ?? undefined, {
      // no logger — keep CI/logs quiet
    })
    try {
      // Newer tesseract.js exposes worker.detect(); it returns OSD data.
      const result: any = await worker.detect(buf)
      const data = result?.data ?? result
      const confidence: number =
        typeof data?.orientation_confidence === 'number'
          ? data.orientation_confidence
          : typeof data?.ocr_confidence === 'number'
            ? data.ocr_confidence
            : 0
      // tesseract reports orientation_degrees = the clockwise rotation applied to
      // the page; to correct we rotate by (360 - deg). Guard both conventions by
      // normalizing to the nearest 90.
      const deg: number = typeof data?.orientation_degrees === 'number' ? data.orientation_degrees : 0
      const corrective = toOrientation((360 - deg) % 360)
      const confident = confidence >= MIN_OSD_CONFIDENCE && corrective !== 0
      return { rotation: confident ? corrective : 0, confident }
    } finally {
      await worker.terminate().catch(() => {})
    }
  } catch {
    // tesseract/OSD unavailable or errored → fail-closed, no rotation.
    return { rotation: 0, confident: false }
  }
}

/**
 * Physically rotate the image bytes. rotation 0 ⇒ input returned unchanged
 * (same reference). This is deterministic and the CI-verifiable mechanism.
 */
export async function applyOrientation(buf: Buffer, rotation: Orientation): Promise<Buffer> {
  if (rotation === 0) return buf
  return sharp(buf).rotate(rotation).toBuffer()
}
