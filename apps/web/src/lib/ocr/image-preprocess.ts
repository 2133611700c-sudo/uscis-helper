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

// Down-cap for the long side. 2048 was a major "app reads but our API doesn't" cause: a 4–7MB
// document scan got crushed to 2048px → dense HANDWRITING fell to ~4–5 px/letter and read empty.
// The apps send full resolution. Raised to 3072 (≈2.25× more pixels; a 3072px q85 JPEG ≈ 1–2MB,
// still under the ~4MB edge body limit). Tune via OCR_MAX_IMAGE_DIMENSION; never below 2048.
// Pair this with Gemini media_resolution=HIGH (geminiVisionProvider) — both are needed.
const PREPROCESS_MAX_DIMENSION = Math.max(2048, Number(process.env.OCR_MAX_IMAGE_DIMENSION) || 3072)
const PREPROCESS_JPEG_QUALITY  = Math.max(70, Number(process.env.OCR_JPEG_QUALITY) || 90) // was 85; apps keep near-original

// ── Upscaling (R3) ──────────────────────────────────────────────────────────
// Non-technical 35-80yo users photograph documents at low DPI. A small scan
// (e.g. 600px short side) gives the model too few pixels per glyph, which hurts
// handwritten Cyrillic OCR badly. We ENLARGE such scans so the SHORT side reaches
// PREPROCESS_MIN_SHORT_SIDE, then apply a mild sharpen to recover edge contrast
// lost to interpolation. We DELIBERATELY do not greyscale/binarize — autoOrient.ts
// documents that tonal ops degrade handwriting; we keep full tone.
//
// Threshold rationale:
//   - 1500px short side ≈ the point where individual handwritten strokes have
//     enough pixels for the model to disambiguate (below ~1000px the failures
//     spike). 1500 stays well under the 2048 long-side DOWN-cap so a typical
//     ~1.4:1 document page (e.g. A4/passport) enlarged to 1500 short ≈ 2100 long
//     is then trimmed by the existing down-resize to ≤2048 — the two rules
//     compose without conflict.
//   - We cap the enlargement FACTOR at 3x so a tiny 200px thumbnail is not blown
//     up to a blurry 1500px mush that wastes payload/RPM without adding signal.
const PREPROCESS_MIN_SHORT_SIDE = 1500  // px — enlarge images whose short side is below this
const PREPROCESS_MAX_UPSCALE    = 3     // never enlarge more than 3x (avoid mush + payload bloat)

// ── Quality gate thresholds (LENIENT — only reject obviously bad images) ──
// These are intentionally low to avoid false rejections. Calibrate with real user photos.
const MIN_DIMENSION          = 200     // px — below this, OCR text is unreadable
const MIN_BRIGHTNESS         = 15      // 0-255 scale — below is near-black
const MAX_BRIGHTNESS         = 248     // 0-255 scale — above is near-white / overexposed
const MIN_BLUR_SCORE         = 2.5     // Laplacian stdev — below is severely out of focus

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
  scaleFactor: number   // < 1 if shrunk; > 1 if enlarged (R3 upscale); 1.0 if untouched
  /** Image quality metrics (for diagnostics and future threshold calibration) */
  quality: {
    brightness: number    // 0-255 mean across channels
    blurScore: number     // Laplacian stdev — higher = sharper
    assessment: 'good' | 'acceptable' | 'poor'
    warnings: string[]    // human-readable quality concerns
  }
}

export interface PreprocessError {
  ok: false
  code: 'unsupported_file_type' | 'corrupt_image' | 'too_small' | 'too_blurry' | 'too_dark' | 'too_bright'
  message: string          // user-safe message
  detail?: string          // internal detail (do NOT send to client)
}

export async function preprocessImage(
  buffer: Buffer,
  mimeType: string
): Promise<PreprocessResult | PreprocessError> {

  // ── 0. HEIC/HEIF (iPhone default) → JPEG ─────────────────────────────────
  // sharp's prebuilt libvips lacks the HEVC codec, so decode goes through
  // heicToJpeg (WASM libde265). Fail-open: an undecodable file keeps its
  // original mime and is rejected by step 1 with the standard message.
  // This single hook fixes HEIC for every caller (TPS, EAD, Reparole,
  // translation) — those routes already ACCEPTED heic by MIME but this
  // module then rejected it.
  {
    const { heicToJpeg } = await import('./heicToJpeg')
    const conv = await heicToJpeg(buffer, mimeType)
    if (conv.converted) {
      buffer = conv.buffer
      mimeType = conv.mimeType
    }
  }

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

    if (origW < MIN_DIMENSION || origH < MIN_DIMENSION) {
      return {
        ok: false,
        code: 'too_small',
        message: 'The image is too small to read. Please take a closer, higher-resolution photo.',
        detail: `Image dimensions: ${origW}×${origH}, minimum: ${MIN_DIMENSION}×${MIN_DIMENSION}`,
      }
    }

    // ── Sizing (R3): three regimes that compose without conflict ──────────────
    //   tiny  → ENLARGE so short side reaches PREPROCESS_MIN_SHORT_SIDE (capped 3x)
    //   huge  → SHRINK so long side ≤ PREPROCESS_MAX_DIMENSION (existing behaviour)
    //   mid   → untouched
    const longSide  = Math.max(origW, origH)
    const shortSide = Math.min(origW, origH)

    const needsDownResize = longSide > PREPROCESS_MAX_DIMENSION
    // Only consider upscaling when the image is NOT already large enough to be
    // down-resized (a small-short/large-long sliver should still be capped, not grown).
    const upscaleNeeded = !needsDownResize && shortSide < PREPROCESS_MIN_SHORT_SIDE

    let resizePipeline = pipeline.clone()
    let scaleFactor = 1.0
    let resized = false

    if (upscaleNeeded) {
      // Enlarge by the factor that brings the short side up to the target, capped.
      const rawFactor = PREPROCESS_MIN_SHORT_SIDE / shortSide
      let upFactor = Math.min(rawFactor, PREPROCESS_MAX_UPSCALE)
      // COMPOSE with the down-cap: a long, thin page (e.g. 600×900) enlarged to
      // short=1500 would be 1500×2250 — long side 2250 > 2048. Clamp the factor so
      // the resulting LONG side never exceeds PREPROCESS_MAX_DIMENSION. The short
      // side may then land slightly below the 1500 target — that's the correct
      // trade-off (the down-cap wins, exactly as for a huge image).
      const longCapFactor = PREPROCESS_MAX_DIMENSION / longSide
      upFactor = Math.min(upFactor, longCapFactor)
      scaleFactor = upFactor
      const targetShort = Math.round(shortSide * scaleFactor)
      // Drive the resize off the short side: enlarge the smaller dimension to
      // targetShort, let the longer one scale proportionally (fit:'outside' grows
      // until BOTH dims are >= the box, i.e. the short side hits targetShort).
      resizePipeline = resizePipeline
        .resize(targetShort, targetShort, { fit: 'outside', withoutEnlargement: false })
        // Contrast-stretch faded ink (ADR-026: proven lift on low-contrast handwritten Cyrillic —
        // raxtemur read the surname at CER 0.000 only after a contrast-stretch). normalise() is a
        // near no-op on already-full-range scans, so it targets exactly the faded/low-DPI case.
        // We DELIBERATELY do not binarize (Otsu/Sauvola destroy faded strokes).
        .normalise()
        // Mild sharpen to recover edge contrast lost to interpolation (handwriting).
        .sharpen({ sigma: 1 })
      resized = true
    } else if (needsDownResize) {
      scaleFactor = PREPROCESS_MAX_DIMENSION / longSide
      resizePipeline = resizePipeline.resize(PREPROCESS_MAX_DIMENSION, PREPROCESS_MAX_DIMENSION, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      resized = true
    }

    const outputBuffer = await resizePipeline
      .jpeg({ quality: PREPROCESS_JPEG_QUALITY, mozjpeg: false })
      .toBuffer({ resolveWithObject: true })

    const finalW = outputBuffer.info.width
    const finalH = outputBuffer.info.height

    // ── 5. Quality gate: brightness + blur ─────────────────────────────────
    // Run on the final JPEG buffer (post-resize) so we measure what Vision will see.
    const qualityWarnings: string[] = []
    let brightness = 128  // safe default
    let blurScore = 10    // safe default

    try {
      // Brightness: mean value across all channels (0-255)
      const stats = await sharp(outputBuffer.data).stats()
      brightness = stats.channels.reduce((s, c) => s + c.mean, 0) / stats.channels.length

      // Blur: standard deviation of Laplacian-filtered grayscale image.
      // High stdev = sharp edges = good image. Low stdev = few edges = blurry.
      const laplacianStats = await sharp(outputBuffer.data)
        .greyscale()
        .convolve({ width: 3, height: 3, kernel: [0, 1, 0, 1, -4, 1, 0, 1, 0] })
        .stats()
      blurScore = laplacianStats.channels[0].stdev
    } catch {
      // If quality analysis fails, proceed with safe defaults (don't block the upload)
      qualityWarnings.push('quality_analysis_fallback')
    }

    // Hard rejects (only for obviously unusable images)
    if (brightness < MIN_BRIGHTNESS) {
      return {
        ok: false,
        code: 'too_dark' as const,
        message: 'The photo is too dark to read. Please retake with better lighting.',
        detail: `brightness=${brightness.toFixed(1)}, threshold=${MIN_BRIGHTNESS}`,
      }
    }
    if (brightness > MAX_BRIGHTNESS) {
      return {
        ok: false,
        code: 'too_bright' as const,
        message: 'The photo is overexposed (too bright). Please retake without direct flash or glare.',
        detail: `brightness=${brightness.toFixed(1)}, threshold=${MAX_BRIGHTNESS}`,
      }
    }
    if (blurScore < MIN_BLUR_SCORE) {
      return {
        ok: false,
        code: 'too_blurry' as const,
        message: 'The photo is too blurry to read. Please hold the camera steady and retake.',
        detail: `blurScore=${blurScore.toFixed(2)}, threshold=${MIN_BLUR_SCORE}`,
      }
    }

    // Soft warnings (image is usable but quality might affect OCR accuracy)
    if (brightness < 40) qualityWarnings.push('low_brightness')
    if (brightness > 220) qualityWarnings.push('high_brightness')
    if (blurScore < 8) qualityWarnings.push('mild_blur')

    const assessment: 'good' | 'acceptable' | 'poor' =
      qualityWarnings.length === 0 ? 'good'
      : qualityWarnings.length <= 2 ? 'acceptable'
      : 'poor'

    return {
      ok: true,
      buffer: outputBuffer.data,
      mimeType: 'image/jpeg',
      originalMimeType: mimeType,
      width: finalW,
      height: finalH,
      resized,
      scaleFactor,
      quality: {
        brightness: Math.round(brightness * 10) / 10,
        blurScore: Math.round(blurScore * 100) / 100,
        assessment,
        warnings: qualityWarnings,
      },
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
        quality: { brightness: 0, blurScore: 0, assessment: 'acceptable', warnings: ['sharp_unavailable'] },
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
