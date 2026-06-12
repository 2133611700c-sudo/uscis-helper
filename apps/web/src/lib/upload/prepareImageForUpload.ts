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
  opts?: DownscaleOptions & { autoRotate?: boolean },
): Promise<{ blob: Blob; name: string }> {
  const { autoRotate = true, ...downscaleOpts } = opts ?? {}
  // autoRotate:false when the user already rotated this page by hand — their
  // choice is final, the OSD must not override it.
  const upright = autoRotate ? await autoRotateImage(file) : file
  const blob = await downscaleImageForUpload(upright, downscaleOpts)
  return { blob, name: upright.name }
}
