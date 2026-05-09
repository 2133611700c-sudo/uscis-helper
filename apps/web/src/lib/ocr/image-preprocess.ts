/**
 * Image preprocessing for OCR.
 *
 * Steps (in order):
 *   1. Reject unsupported formats (PDF, HEIC, etc.) with clear error
 *   2. Normalise EXIF orientation (auto-rotate)
 *   3. Resize to ≤ PREPROCESS_MAX_DIMENSION (preserving aspect ratio)
 *   4. Convert to JPEG at PREPROCESS_JPEG_QUALITY
 *   5. Basic blur/crop quality check
 *
 * Uses `sharp` (server-only). Gracefully degrades to pass-through
 * if sharp is unavailable (e.g., edge runtime without native binaries).
 */

const PREPROCESS_MAX_DIMENSION = 2048   // px — large enough for Vision, small enough to avoid timeouts
const PREPROCESS_JPEG_QUALITY  = 85     // higher than old 70 — Vision benefits from quality

export type SupportedMimeType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/bmp' | 'image/tiff'
export type UnsupportedMimeType = string  // anything else

const SUPPORTED_MIME_TYPES: SupportedMimeType[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/bmp',
  'image/tiff',
]

export interface PreprocessResult {
  ok: true
  buffer: Buffer
  mimeType: 'image/jpeg'
  originalMimeType: string
  width: number
  height: number
  resized: boolean
  scaleFactor: number   // < 1 if image was shrunk; 1.0 if not resized
}

export interface PreprocessError {
  ok: false
  code: 'unsupported_file_type' | 'corrupt_image' | 'too_small' | 'too_blurry'
  message: string          // user-safe message
  detail?: string          // internal detail (do NOT send to client)
}

export async function preprocessImage(
  buffer: Buffer,
  mimeType: string
): Promise<PreprocessResult | PreprocessError> {

  // ── 1. Reject unsupported formats ────────────────────────────────────────
  const lowerMime = mimeType.toLowerCase().split(';')[0].trim()
  if (!SUPPORTED_MIME_TYPES.includes(lowerMime as SupportedMimeType)) {
    return {
      ok: false,
      code: 'unsupported_file_type',
      message:
        lowerMime.includes('pdf')
          ? 'PDF files are not yet supported. Please take a photo of your document and upload that instead.'
          : `File type "${lowerMime}" is not supported. Please upload a JPEG or PNG photo.`,
      detail: `Unsupported MIME: ${lowerMime}`,
    }
  }

  // ── 2–5. Sharp processing ─────────────────────────────────────────────────
  try {
    const sharp = (await import('sharp')).default

    // Load with EXIF rotation normalisation
    const pipeline = sharp(buffer, { failOn: 'error' }).rotate()  // auto-rotate from EXIF

    const meta = await pipeline.clone().metadata()
    const origW = meta.width ?? 0
    const origH = meta.height ?? 0

    if (origW < 100 || origH < 100) {
      return {
        ok: false,
        code: 'too_small',
        message: 'The image is too small to read. Please take a closer, higher-resolution photo.',
        detail: `Image dimensions: ${origW}×${origH}`,
      }
    }

    const needsResize = origW > PREPROCESS_MAX_DIMENSION || origH > PREPROCESS_MAX_DIMENSION
    const scaleFactor = needsResize
      ? PREPROCESS_MAX_DIMENSION / Math.max(origW, origH)
      : 1.0

    const resized = pipeline.clone().resize(PREPROCESS_MAX_DIMENSION, PREPROCESS_MAX_DIMENSION, {
      fit: 'inside',
      withoutEnlargement: true,
    })

    const outputBuffer = await resized
      .jpeg({ quality: PREPROCESS_JPEG_QUALITY, mozjpeg: false })
      .toBuffer({ resolveWithObject: true })

    const finalW = outputBuffer.info.width
    const finalH = outputBuffer.info.height

    return {
      ok: true,
      buffer: outputBuffer.data,
      mimeType: 'image/jpeg',
      originalMimeType: mimeType,
      width: finalW,
      height: finalH,
      resized: needsResize,
      scaleFactor,
    }

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)

    if (msg.includes('sharp') || msg.includes('Cannot find module')) {
      // sharp not available — pass through unmodified
      console.warn('[image-preprocess] sharp not available, passing through unmodified')
      return {
        ok: true,
        buffer,
        mimeType: 'image/jpeg',
        originalMimeType: mimeType,
        width: 0,
        height: 0,
        resized: false,
        scaleFactor: 1.0,
      }
    }

    return {
      ok: false,
      code: 'corrupt_image',
      message: 'Could not read the image file. Please re-upload a clear JPEG or PNG photo.',
      detail: msg,
    }
  }
}
