/**
 * lib/upload/prepareImageForUpload — the SINGLE entry point every client upload
 * path uses, so image handling is identical across ALL products (translation /
 * TPS / EAD / re-parole). Two free, client-side steps:
 *   1. autoRotateImage — Tesseract OSD turns a sideways/upside-down photo upright
 *      (no API cost). Fail-open.
 *   2. downscaleImageForUpload — keep the upload under Vercel's ~4.5MB body cap.
 *
 * Returns the prepared blob plus the (possibly rotated) file name. Always use
 * this instead of calling the two steps separately, so a fix here applies to
 * every wizard at once.
 */
import { autoRotateImage } from './autoRotate'
import { downscaleImageForUpload, type DownscaleOptions } from './downscaleImage'

export async function prepareImageForUpload(
  file: File,
  opts?: DownscaleOptions,
): Promise<{ blob: Blob; name: string }> {
  const upright = await autoRotateImage(file)
  const blob = await downscaleImageForUpload(upright, opts)
  return { blob, name: upright.name }
}
