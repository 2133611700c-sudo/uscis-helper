/**
 * visionBboxLocator — PURE Vision-OCR → EvidenceRegion locator (One-Brain STEP E).
 *
 * Extracted from the dark `ocr-from-storage` route (the
 * Vision.extractText → buildOcrLookup → resolveOcrIds sequence) so the live wizard
 * can later obtain field-level bbox evidence via a reader-evidence pass WITHOUT
 * touching that route.
 *
 * Contract (deliberately narrow):
 *   - It is a LOCATOR ONLY: given an image and a per-field map of OCR token IDs,
 *     it returns WHERE each field sits (EvidenceRegion[]) — coordinates/evidence only.
 *   - NO DeepSeek, NO field-value mapping, NO acceptance/review DECISION. It never
 *     reads or asserts a field's VALUE. The caller owns deciding what those IDs mean
 *     and which model produced them.
 *   - FAIL-OPEN: if Vision is blocked (missing creds), returns a typed provider error,
 *     yields an empty/no-text result, or throws — this returns [] and NEVER throws.
 *     The caller treats "no evidence" as "no localization", not as a hard failure.
 *
 * It does NOT call any route; wiring into the pipeline is a separate gated step.
 */
import { googleVisionProvider } from '@/lib/ocr/providers/google-vision'
import { isUnusableOcr } from '@/lib/ocr/types'
import { buildOcrLookup, resolveOcrIds } from '@/lib/ocr/bbox-resolver'
import type { EvidenceRegion } from './EvidenceRegion'
import { missingRegion } from './EvidenceRegion'
import { assertHonest } from './evidenceAdapters'

export interface LocateFieldEvidenceInput {
  imageBuffer: Buffer
  mimeType: string
  /**
   * field key → OCR token IDs (e.g. { family_name: ['w_0012', 'w_0013'] }).
   * These IDs are produced upstream (by the reader/mapper); this locator only
   * resolves them to coordinates. Omit / empty → returns [].
   */
  fieldOcrIds?: Record<string, string[]>
}

/**
 * Resolve each field's OCR token IDs to a normalized field-level bbox.
 *
 * Mapping of resolver status → EvidenceRegion:
 *   - 'exact'    → status 'exact',    source 'ocr_token', bbox = resolved tuple
 *   - 'combined' → status 'combined', source 'ocr_token', bbox = union tuple
 *   - 'missing'  → missingRegion(...) (bbox null, source 'none')
 *
 * Returns [] (fail-open) if Vision is unusable (blocked/provider error),
 * returns no text, or throws. No field map → [].
 */
export async function locateFieldEvidence(
  input: LocateFieldEvidenceInput,
): Promise<EvidenceRegion[]> {
  const { imageBuffer, mimeType, fieldOcrIds } = input

  if (!fieldOcrIds || Object.keys(fieldOcrIds).length === 0) {
    return []
  }

  let ocrRaw
  try {
    ocrRaw = await googleVisionProvider.extractText({ imageBuffer, mimeType })
  } catch {
    // FAIL-OPEN: a thrown provider error must never propagate out of a pure locator.
    return []
  }

  // Blocked (missing creds) OR typed provider error (429/5xx/403 billing/timeout)
  // → no usable OcrResult → no evidence. Never throw.
  if (isUnusableOcr(ocrRaw)) {
    return []
  }

  const ocrResult = ocrRaw

  // Successful-but-empty read (no words detected) → no tokens to resolve against.
  if (ocrResult.words.length === 0 && ocrResult.lines.length === 0) {
    return []
  }

  const lookup = buildOcrLookup(ocrResult)

  const regions: EvidenceRegion[] = []
  for (const [fieldKey, ocrIds] of Object.entries(fieldOcrIds)) {
    const resolved = resolveOcrIds(ocrIds ?? [], lookup)

    if (resolved.bbox_status === 'exact' || resolved.bbox_status === 'combined') {
      // OCR token boxes are the only TRUE field-level geometry → 'exact'/'combined'
      // with source 'ocr_token'. assertHonest enforces the §3.6 invariant (a real
      // bbox must back an exact/combined claim) before the region escapes.
      regions.push(
        assertHonest({
          fieldKey,
          bbox: resolved.bbox,
          page: 1,
          status: resolved.bbox_status,
          source: 'ocr_token',
          cropPath: null,
        }),
      )
    } else {
      // 'missing' → no field-level box (bbox null, source 'none') per §3.6.
      regions.push(missingRegion(fieldKey, 1))
    }
  }

  return regions
}
