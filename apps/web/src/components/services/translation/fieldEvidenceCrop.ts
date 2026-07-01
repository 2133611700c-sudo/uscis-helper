import type { EvidenceRegion } from '@/lib/docintel/evidence/EvidenceRegion'

export interface EvidenceCropDecision {
  /** Whether the review row should show a located source crop at all. */
  render: boolean
  /** True when the located region is only an approximate (template) area, not a tight box. */
  approximate: boolean
  /** Client-facing English label (empty when render === false). */
  label: string
}

/**
 * Resolve the client image URL for an evidence region.
 *
 * HONESTY RULE: if the evidence points at page N and the client does not have
 * that exact page preview, render NO crop. Falling back to page 1 would show a
 * crop from the wrong page and create false confidence.
 */
export function resolveEvidenceImageUrl(
  region: EvidenceRegion | null | undefined,
  previewUrls: readonly string[],
): string | null {
  if (!region) return null
  const pageIndex = region.page - 1
  if (!Number.isInteger(pageIndex) || pageIndex < 0) return null
  return previewUrls[pageIndex] ?? null
}

/** Overlay rectangle in PERCENT of the rendered image (SVG-ready). */
export interface OverlayRect {
  xPct: number
  yPct: number
  wPct: number
  hPct: number
}

/**
 * The ONE coordinate-normalization function (prompt §15). EvidenceRegion.bbox is
 * contractually normalized 0..1 top-left [x0,y0,x1,y1]. This is the single place that
 * converts it to an overlay rectangle, so the conversion is never smeared across
 * components. It fails SAFE (returns null → draw nothing) rather than drawing a wrong box:
 *  - null / not a 4-number tuple / non-finite → null
 *  - coordinates are clamped into [0,1] (out-of-range never overflows the image)
 *  - a zero-or-negative-area box (after clamp) → null (never render a degenerate rect)
 * No rotation handling is needed: the page pixels are rotated pre-OCR (autoRotate) and the
 * SVG overlays the already-upright preview with preserveAspectRatio='none'.
 */
export function bboxOverlayRect(bbox: EvidenceRegion['bbox']): OverlayRect | null {
  if (!bbox || !Array.isArray(bbox) || bbox.length !== 4) return null
  if (!bbox.every((n) => typeof n === 'number' && Number.isFinite(n))) return null
  const clamp = (n: number) => Math.min(1, Math.max(0, n))
  const x0 = clamp(bbox[0]), y0 = clamp(bbox[1]), x1 = clamp(bbox[2]), y1 = clamp(bbox[3])
  const w = x1 - x0, h = y1 - y0
  if (w <= 0 || h <= 0) return null // degenerate / inverted → do not draw
  return { xPct: x0 * 100, yPct: y0 * 100, wPct: w * 100, hPct: h * 100 }
}

export function resolveRenderableEvidence(
  regions: readonly EvidenceRegion[] | null | undefined,
  previewUrls: readonly string[],
): Array<{ region: EvidenceRegion; imageUrl: string; overlay: OverlayRect }> {
  if (!regions?.length) return []
  const out: Array<{ region: EvidenceRegion; imageUrl: string; overlay: OverlayRect }> = []
  for (const region of regions) {
    if (!evidenceCropDecision(region).render) continue
    const overlay = bboxOverlayRect(region.bbox)
    if (!overlay) continue // invalid/out-of-range/zero-size bbox → render nothing (honesty)
    const imageUrl = resolveEvidenceImageUrl(region, previewUrls)
    if (!imageUrl) continue
    out.push({ region, imageUrl, overlay })
  }
  return out
}

/**
 * Pure decision for the STEP-E review-row source crop (One-Brain §3.6 HONESTY RULE).
 *
 * A region is shown as a located crop ONLY when it has a real field-level bbox. Regions
 * that don't tightly locate the field — `full_image` (LLM, no localization), `zone_fallback`
 * (coarse zone), `missing` — or any region without a bbox are NOT shown as a crop, so a
 * whole-page or zone box is never presented to a human reviewer as a precise field location.
 * Template evidence (`approximate`) is shown but labelled approximate; only `exact`/`combined`
 * may claim "the part we read".
 */
export function evidenceCropDecision(
  region: EvidenceRegion | null | undefined,
): EvidenceCropDecision {
  const none: EvidenceCropDecision = { render: false, approximate: false, label: '' }
  if (!region || !region.bbox) return none
  if (region.status === 'full_image' || region.status === 'missing' || region.status === 'zone_fallback') {
    return none
  }
  const exact = region.status === 'exact' || region.status === 'combined'
  return {
    render: true,
    approximate: !exact,
    label: exact
      ? 'The part of your document we read'
      : 'Approximate area we read this from — please compare with your document',
  }
}
