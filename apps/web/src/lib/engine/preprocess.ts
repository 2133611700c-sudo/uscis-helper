/**
 * engine/preprocess.ts — D0 Intake: pixel preprocessing + quality gate.
 *
 * The audit's #1 accuracy lever: raw 1980s photos (skew, shadow, low contrast)
 * went byte-for-byte into Gemini + Google Vision, hurting both reads (and the GV
 * presence gate amplified the damage). One sharp pass (auto-orient, grayscale,
 * contrast-normalize, downscale) cleans the input before any model sees it.
 *
 * sharp is a native module → imported LAZILY (server-only, never in a client
 * bundle). Every function fails OPEN: on any error we return the original image /
 * an ok quality so the pipeline is never broken by preprocessing.
 */

export interface QualityReport {
  ok: boolean
  reason: 'ok' | 'low_resolution' | 'too_dark' | 'overexposed' | 'unknown'
  width: number
  height: number
  brightness: number // 0..255 mean
}

/** Clean the image before recognition. Returns the processed JPEG (or the original on failure). */
export async function preprocessImage(image: Buffer, mime: string): Promise<{ image: Buffer; mime: string; applied: boolean }> {
  try {
    const sharp = (await import('sharp')).default
    const out = await sharp(image, { failOn: 'none' })
      .rotate()        // auto-orient from EXIF
      .grayscale()
      .normalize()     // stretch contrast (helps faded ink)
      .resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 90 })
      .toBuffer()
    return { image: out, mime: 'image/jpeg', applied: true }
  } catch {
    return { image, mime, applied: false }
  }
}

/** Cheap pre-flight: is the photo good enough to spend two paid vision calls on? */
export async function assessQuality(image: Buffer): Promise<QualityReport> {
  try {
    const sharp = (await import('sharp')).default
    const img = sharp(image, { failOn: 'none' })
    const meta = await img.metadata()
    const stats = await img.stats()
    const width = meta.width ?? 0
    const height = meta.height ?? 0
    const brightness = stats.channels.length
      ? stats.channels.reduce((a, c) => a + c.mean, 0) / stats.channels.length
      : 0
    if (Math.min(width, height) < 600) return { ok: false, reason: 'low_resolution', width, height, brightness }
    if (brightness < 40) return { ok: false, reason: 'too_dark', width, height, brightness }
    if (brightness > 245) return { ok: false, reason: 'overexposed', width, height, brightness }
    return { ok: true, reason: 'ok', width, height, brightness }
  } catch {
    return { ok: true, reason: 'unknown', width: 0, height: 0, brightness: 0 }
  }
}
