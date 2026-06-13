/**
 * lib/upload/prepareImageForUpload — the SINGLE entry point every client upload
 * path uses, so image handling is identical across ALL products (translation /
 * TPS / EAD / re-parole). One free, client-side step:
 *   1. downscaleImageForUpload — keep the upload under Vercel's ~4.5MB body cap.
 *
 * Client-side OSD auto-rotation is DISABLED by default (2026-06-12). The Tesseract
 * OSD path had a wrong rotation direction (OSD returns the counter-clockwise
 * correction; the code applied it clockwise) so 90°/270° phone photos were rotated
 * 180° wrong — it corrupted more uploads than it fixed and fought the reader's own
 * "mentally rotate" instruction, which works on the original, undamaged pixels.
 * Orientation is now handled at READ time by the vision model. The MANUAL rotate
 * button (rotateImage90) is unaffected — a user can still fix a page by hand.
 * Pass autoRotate:true only to deliberately re-enable the (still-buggy) OSD path.
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
  const { autoRotate = false, ...downscaleOpts } = opts ?? {}
  // autoRotate default OFF: the OSD direction bug corrupted sideways photos. The
  // vision reader rotates mentally at read time on the undamaged original.
  const upright = autoRotate ? await autoRotateImage(file) : file
  const blob = await downscaleImageForUpload(upright, downscaleOpts)
  return { blob, name: upright.name }
}
