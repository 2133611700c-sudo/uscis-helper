/**
 * googleVisionEvidenceProvider — the REAL (drop-in) Google-Vision-backed EvidenceProvider.
 *
 * EVIDENCE-ONLY LOCATOR (One-Brain §7). Given the field VALUES a semantic reader already
 * decided, it runs Google Vision OCR (network) and LOCATES those values among the OCR tokens,
 * emitting EvidenceRegion geometry. It is NOT a semantic reader: it never returns or mutates a
 * field value, never creates a semantic candidate, never votes in arbitration, never touches
 * confidence/review. Producing EvidenceRegion bbox geometry is its ONLY output.
 *
 * FAIL-OPEN: a blocked (missing creds / 403 billing), a typed provider error (429/5xx/403/
 * timeout), or a thrown error → { status: 'unavailable', reason: 'provider_error' }. It NEVER
 * throws. A successful read that locates no field values → { status: 'unavailable',
 * reason: 'no_geometry' }.
 *
 * DISABLED BY DEFAULT AT RUNTIME: Google Vision billing is 403 in this environment, so this
 * provider is NOT wired as the default of resolveEvidenceProvider yet — the default stays
 * `disabledEvidenceProvider`. This file exists so the swap is a one-line change once billing/IAM
 * exist, with no seam change (same EvidenceProvider interface + same offline localizer).
 */
import { googleVisionProvider } from '@/lib/ocr/providers/google-vision'
import { isUnusableOcr } from '@/lib/ocr/types'
import type { EvidenceProvider } from './evidenceProvider'
import { groupRegionsByField } from './evidenceProvider'
import { localizeFieldsInOcr } from './offlineFieldLocalizer'

export const googleVisionEvidenceProvider: EvidenceProvider = {
  async locateEvidence({ document, fields }) {
    let ocrRaw
    try {
      ocrRaw = await googleVisionProvider.extractText({
        imageBuffer: document.buffer,
        mimeType: document.mime,
      })
    } catch {
      // FAIL-OPEN: a thrown provider error must never escape a pure evidence locator.
      return { status: 'unavailable', reason: 'provider_error' }
    }

    // Blocked (missing creds / 403 billing) OR typed provider error (429/5xx/403/timeout)
    // → no usable OcrResult → no evidence. Never throw.
    if (isUnusableOcr(ocrRaw)) {
      return { status: 'unavailable', reason: 'provider_error' }
    }

    // Deterministic, offline value→token localization over the OCR layer. This NEVER reads a
    // value: it only locates the already-chosen values the caller supplied.
    const regions = localizeFieldsInOcr(fields, ocrRaw)
    if (regions.length === 0) {
      return { status: 'unavailable', reason: 'no_geometry' }
    }

    return { status: 'available', regionsByField: groupRegionsByField(regions) }
  },
}
