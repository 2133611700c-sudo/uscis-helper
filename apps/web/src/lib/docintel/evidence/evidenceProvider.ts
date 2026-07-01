/**
 * EvidenceProvider — the injectable, EVIDENCE-ONLY visual-geometry producer (One-Brain §7).
 *
 * A provider LOCATES already-decided field values on the page and returns EvidenceRegion[].
 * It is NOT a semantic reader: it never proposes/changes a value, never votes in arbitration,
 * never touches confidence/review, never becomes a second Decision Engine. It is injected into
 * the recognition spine so the production default performs NO external call, and tests inject a
 * prerecorded (offline) provider — the same seam that a real Google Vision client drops into
 * once billing/credentials exist.
 *
 * Flow: semantic reader (values) + provider (geometry) → ExtractedDocField.evidenceRegions →
 * existing carriage. Provider unavailable/error → fields are returned UNCHANGED (semantic
 * extraction is never harmed); template fallback then fills the geometry.
 */
import type { EvidenceRegion } from './EvidenceRegion'
import type { OcrResult } from '@/lib/ocr/types'
import { localizeFieldsInOcr } from './offlineFieldLocalizer'

export interface EvidenceProviderInput {
  document: { buffer: Buffer; mime: string; page?: number }
  /** the values the semantic reader already chose — the provider only LOCATES these. */
  fields: Array<{ key: string; value: string }>
}

export type EvidenceProviderResult =
  | { status: 'available'; regionsByField: Record<string, EvidenceRegion[]> }
  | { status: 'unavailable'; reason: 'disabled' | 'provider_error' | 'no_geometry' | 'unsupported_input' }

export interface EvidenceProvider {
  locateEvidence(input: EvidenceProviderInput): Promise<EvidenceProviderResult>
}

/**
 * Production DEFAULT: no external call, always unavailable. Keeps the pipeline byte-identical
 * and network-free until a real provider is injected (billing/credentials present).
 */
export const disabledEvidenceProvider: EvidenceProvider = {
  async locateEvidence() {
    return { status: 'unavailable', reason: 'disabled' }
  },
}

/**
 * OFFLINE provider backed by a prerecorded OcrResult (no network). This is what integration
 * tests inject, and it is the exact shape a live Google-Vision-backed provider produces after
 * `extractText` — so swapping in the real client later needs no seam change. Evidence-only:
 * it runs the deterministic value→token localizer over the supplied OCR layer.
 */
export function ocrResultEvidenceProvider(ocr: OcrResult): EvidenceProvider {
  return {
    async locateEvidence({ fields }) {
      const regions = localizeFieldsInOcr(fields, ocr)
      if (regions.length === 0) return { status: 'unavailable', reason: 'no_geometry' }
      const regionsByField: Record<string, EvidenceRegion[]> = {}
      for (const r of regions) (regionsByField[r.fieldKey] ??= []).push(r)
      return { status: 'available', regionsByField }
    },
  }
}

/** Group flat EvidenceRegion[] by fieldKey — shared helper for provider implementations. */
export function groupRegionsByField(regions: EvidenceRegion[]): Record<string, EvidenceRegion[]> {
  const out: Record<string, EvidenceRegion[]> = {}
  for (const r of regions) (out[r.fieldKey] ??= []).push(r)
  return out
}
