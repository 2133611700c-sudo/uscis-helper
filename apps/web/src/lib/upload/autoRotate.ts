/**
 * lib/upload/autoRotate — FREE client-side document auto-rotation.
 *
 * A photo placed upside-down or sideways (content rotated 90/180/270°) wrecks
 * OCR/vision reads. The paid path would ask Gemini for the angle; this does it
 * for ZERO money using Tesseract's OSD (Orientation & Script Detection), which
 * runs locally in the browser (WASM) — already a project dependency. We detect
 * the angle, rotate the pixels with a canvas, and hand an upright image to the
 * normal upload/downscale step.
 *
 * FAIL-OPEN: any error / low confidence / timeout → return the ORIGINAL file.
 * Auto-rotation must never block or corrupt an upload.
 *
 * Browser-only (createImageBitmap + canvas + tesseract worker). The OSD model
 * (~loaded once, cached by the browser) downloads lazily on first use.
 */
import { createWorker, OEM, type Worker } from 'tesseract.js'

const DETECT_MAX_EDGE = 1000 // OSD only needs a modest resolution; smaller = faster
const MIN_CONFIDENCE = 0.7 // Tesseract OSD confidence; below this we don't trust the angle (clear text scores ~1.0-1.5)
const TIMEOUT_MS = 12_000

let workerPromise: Promise<Worker> | null = null
function getOsdWorker(): Promise<Worker> {
  if (!workerPromise) {
    // OSD detect() needs the LEGACY engine + legacy osd model (the default LSTM
    // core throws "requires Legacy model"). legacyCore/legacyLang load the
    // legacy-capable build. 'osd' = orientation model only (no language OCR).
    workerPromise = createWorker('osd', OEM.TESSERACT_ONLY, { legacyCore: true, legacyLang: true }).catch((e) => {
      workerPromise = null // allow a later retry
      throw e
    })
  }
  return workerPromise
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('osd_timeout')), ms)
    p.then((v) => { clearTimeout(t); resolve(v) }, (e) => { clearTimeout(t); reject(e) })
  })
}

/** Draw a bitmap onto a canvas, downscaled to maxEdge. Returns the canvas. */
function bitmapToCanvas(bitmap: ImageBitmap, maxEdge: number): HTMLCanvasElement {
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bitmap, 0, 0, w, h)
  return canvas
}

/** Rotate a bitmap CLOCKWISE by deg (90/180/270) onto a new canvas. */
function rotateBitmap(bitmap: ImageBitmap, deg: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  const swap = deg === 90 || deg === 270
  canvas.width = swap ? bitmap.height : bitmap.width
  canvas.height = swap ? bitmap.width : bitmap.height
  const ctx = canvas.getContext('2d')!
  ctx.translate(canvas.width / 2, canvas.height / 2)
  ctx.rotate((deg * Math.PI) / 180)
  ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2)
  return canvas
}

function canvasToFile(canvas: HTMLCanvasElement, name: string): Promise<File> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(blob ? new File([blob], name, { type: 'image/jpeg' }) : new File([], name))
    }, 'image/jpeg', 0.92)
  })
}

/**
 * Detect the document's rotation and return a CLOCKWISE correction angle that
 * makes the text upright: 0, 90, 180, or 270. Returns 0 on any uncertainty.
 *
 * Tesseract OSD's `orientation_degrees` IS the CLOCKWISE angle to rotate the
 * image to make the text upright (verified empirically: an image rotated 90° CW
 * reports 270, i.e. rotate 270° CW to fix). So the correction = that value,
 * snapped to 0/90/180/270.
 */
async function detectCorrectionDeg(bitmap: ImageBitmap): Promise<number> {
  const canvas = bitmapToCanvas(bitmap, DETECT_MAX_EDGE)
  const worker = await getOsdWorker()
  const { data } = await withTimeout(worker.detect(canvas), TIMEOUT_MS)
  const od = data.orientation_degrees
  const conf = data.orientation_confidence
  if (od == null || conf == null || conf < MIN_CONFIDENCE) return 0
  const correction = ((Math.round(od / 90) * 90) % 360 + 360) % 360
  return correction === 90 || correction === 180 || correction === 270 ? correction : 0
}

/**
 * Return an upright version of `file` (rotated if the document was photographed
 * sideways/upside-down). Fail-open: returns the original on any problem.
 */
/**
 * Manual 90°-clockwise rotation (the user-override safety net for when auto
 * detection is wrong or didn't fire). Fail-open: returns the original on error.
 */
export async function rotateImage90(file: File): Promise<File> {
  if (typeof window === 'undefined' || typeof createImageBitmap !== 'function' || typeof document === 'undefined') return file
  if (!file.type.startsWith('image/')) return file
  let bitmap: ImageBitmap | null = null
  try {
    bitmap = await createImageBitmap(file)
    return await canvasToFile(rotateBitmap(bitmap, 90), file.name)
  } catch {
    return file
  } finally {
    bitmap?.close?.()
  }
}

export async function autoRotateImage(file: File): Promise<File> {
  if (typeof window === 'undefined' || typeof createImageBitmap !== 'function' || typeof document === 'undefined') return file
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml' || file.type === 'image/gif') return file
  let bitmap: ImageBitmap | null = null
  try {
    bitmap = await createImageBitmap(file) // applies EXIF orientation
    const deg = await detectCorrectionDeg(bitmap)
    if (deg === 0) return file
    const rotated = rotateBitmap(bitmap, deg)
    return await canvasToFile(rotated, file.name)
  } catch {
    return file // fail-open
  } finally {
    bitmap?.close?.()
  }
}
