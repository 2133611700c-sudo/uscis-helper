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
