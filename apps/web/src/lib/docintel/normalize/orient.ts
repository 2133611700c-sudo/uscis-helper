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

// Hard cap on the OSD attempt. tesseract.js OSD (worker + WASM + osd traineddata)
// does NOT finish within the Vercel serverless budget — a naked detect() hung the
// function to FUNCTION_INVOCATION_TIMEOUT (504) at ~90s (proven via /api/diag/normalize).
// This bound converts that hang into a fail-closed (rotation 0) so enabling
// DOC_NORMALIZE_ENABLED can never DoS the request. NOTE: in serverless this means the
// FREE OSD path effectively never orients (it times out) — real auto-orientation needs
// the paid vision path (DOC_NORMALIZE_PAID_ORIENT). Locally OSD finishes well within
// this bound, so deterministic tests still exercise real orientation.
const OSD_TIMEOUT_MS = 12_000

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
  // Race the ENTIRE tesseract op (worker create + WASM/traineddata load + detect)
  // against a hard bound. If it wins → real orientation; if the timeout wins (or any
  // error) → fail-closed (rotation 0). The lingering worker is terminated fire-and-forget
  // so it can never keep the request pending to the platform timeout.
  let worker: any = null
  const run = (async (): Promise<{ rotation: Orientation; confident: boolean }> => {
    const tesseract: any = await import('tesseract.js')
    // FORCE the legacy OSD engine (OEM 0 = TESSERACT_ONLY). OSD orientation lives ONLY
    // in the legacy engine; the default LSTM engine has no OSD and `detect()` returns
    // no orientation data ("LSTM requested, but not present"). Hardcode 0 so a missing
    // `tesseract.OEM` enum (bundler/serverless namespace shape) can't silently fall back
    // to LSTM and disable orientation. Verified: with OEM 0, detect() returns
    // orientation_degrees + orientation_confidence.
    worker = await tesseract.createWorker('osd', tesseract.OEM?.TESSERACT_ONLY ?? 0, {})
    const result: any = await worker.detect(buf)
    const data = result?.data ?? result
    const confidence: number =
      typeof data?.orientation_confidence === 'number'
        ? data.orientation_confidence
        : typeof data?.ocr_confidence === 'number'
          ? data.ocr_confidence
          : 0
    // tesseract's `orientation_degrees` IS the clockwise rotation to APPLY to bring the
    // page upright — feed it DIRECTLY to sharp.rotate (clockwise). (The old `360 - deg`
    // inverted 90↔270 and left those upside-down.) Verified on real 0/90/180/270 fixtures.
    const deg: number = typeof data?.orientation_degrees === 'number' ? data.orientation_degrees : 0
    const corrective = toOrientation(deg)
    const confident = confidence >= MIN_OSD_CONFIDENCE && corrective !== 0
    return { rotation: confident ? corrective : 0, confident }
  })()

  const timeout = new Promise<{ rotation: Orientation; confident: boolean }>((resolve) =>
    setTimeout(() => resolve({ rotation: 0, confident: false }), OSD_TIMEOUT_MS),
  )

  try {
    return await Promise.race([run, timeout])
  } catch {
    // tesseract/OSD unavailable or errored → fail-closed, no rotation.
    return { rotation: 0, confident: false }
  } finally {
    // Never await — a hung worker's terminate() could itself hang; fire-and-forget.
    void Promise.resolve(worker).then((w) => w && w.terminate && w.terminate()).catch(() => {})
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
