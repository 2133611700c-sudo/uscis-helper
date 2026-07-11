/**
 * docintel/normalize/flags — env flag gates for the normalization layer.
 *
 * DOC_NORMALIZE_ENABLED='1'      → the FREE, deterministic normalization path
 *                                  (EXIF, deterministic OSD orientation, deskew,
 *                                  PDF raster). Default OFF ⇒ byte-identical.
 * DOC_NORMALIZE_PAID_ORIENT='1'  → separate opt-in for the PAID LLM orientation
 *                                  refinement. PR A default path MUST NOT call it.
 */

export function isDocNormalizeEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.DOC_NORMALIZE_ENABLED === '1'
}

// Separate opt-in for the PAID LLM orientation refinement (default OFF). PR A default path must NOT call it.
export function isPaidOrientEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.DOC_NORMALIZE_PAID_ORIENT === '1'
}
