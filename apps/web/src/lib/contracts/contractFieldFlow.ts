/**
 * Phase 6 — wire the unified-contract field split into the runtime OCR → canonical
 * → translation field flow (FieldOut rows), flag-gated and strictly additive.
 *
 * Insertion seam: vision-extract/route.ts, right after `toTranslationRows(...)`
 * produces the FieldOut[] (post-arbitration canonical → translation rows).
 *
 * Flag UNIFIED_DOC_CONTRACT_SPLIT_ENABLED (default OFF):
 *   OFF → returns the SAME array reference (zero behaviour change).
 *   ON  → returns original rows (UNTOUCHED, kept as raw evidence) + appended split
 *         rows for document.series/number, event.birth.place.*, registry.office.*.
 *
 * Both the Latin `value` and the original `raw_cyrillic` are split in lockstep so
 * raw evidence is preserved on each new row. Split rows are review_required=true
 * (best-effort structural segmentation must be human-confirmed). No OCR/model/HTR
 * call, no PDF layout change, no overwrite of any existing row.
 *
 * Phase 7 (normalizeContractSplitFields) fills the normalized/translated layers
 * via packages/knowledge; this module performs ONLY structural separation.
 */
import type { FieldOut } from '@/lib/canonical/core/translationAdapter'
import {
  splitSeriesNumber,
  splitBirthPlace,
  splitRegistryOffice,
  isUnifiedDocContractSplitEnabled,
} from './splitMergedFields'
import { BIRTH_CERT_LEGACY_DOCTYPE } from './birthCertSovietV1Contract'

type SplitRowSpec = { field: string; kind: string; latin?: string; cyr?: string }

function mkRow(spec: SplitRowSpec, srcConfidence: number): FieldOut {
  return {
    field: spec.field,
    value: spec.latin?.trim() || null,
    raw_cyrillic: spec.cyr?.trim() || null,
    confidence: srcConfidence,
    review_required: true, // synthetic structural split → always human-confirm
    kind: spec.kind,
    review_reasons: ['contract_split_field'],
  }
}

/** Append the contract split fields to a FieldOut[]; OFF → identity (same ref). */
export function applyContractSplitFlow(
  fields: FieldOut[],
  docType: string,
  env: Record<string, string | undefined> = process.env,
): FieldOut[] {
  if (!isUnifiedDocContractSplitEnabled(env) || docType !== BIRTH_CERT_LEGACY_DOCTYPE) return fields

  const by = new Map(fields.map((f) => [f.field, f]))
  const rows: FieldOut[] = []
  const existing = new Set(fields.map((f) => f.field))
  const add = (spec: SplitRowSpec, src: FieldOut) => {
    if (existing.has(spec.field)) return // never overwrite/duplicate an existing key
    if (!spec.latin?.trim() && !spec.cyr?.trim()) return
    rows.push(mkRow(spec, src.confidence))
    existing.add(spec.field)
  }

  // series / number — split both Latin value and the Cyrillic raw (if any)
  const seriesSrc = by.get('certificate_series_number') ?? by.get('series_number')
  if (seriesSrc) {
    const lat = splitSeriesNumber(seriesSrc.value ?? '')
    const cyr = splitSeriesNumber(seriesSrc.raw_cyrillic ?? '')
    add({ field: 'document_series', kind: 'doc_number', latin: lat.series, cyr: cyr.series }, seriesSrc)
    add({ field: 'document_number', kind: 'doc_number', latin: lat.number, cyr: cyr.number }, seriesSrc)
  }

  // place of birth
  const placeSrc = by.get('place_of_birth_city') ?? by.get('place_of_birth') ?? by.get('city_of_birth')
  if (placeSrc) {
    const lat = splitBirthPlace(placeSrc.value ?? '')
    const cyr = splitBirthPlace(placeSrc.raw_cyrillic ?? '')
    add({ field: 'place_of_birth_settlement_type', kind: 'text', latin: lat.settlement_type, cyr: cyr.settlement_type }, placeSrc)
    add({ field: 'place_of_birth_district', kind: 'place_city', latin: lat.district, cyr: cyr.district }, placeSrc)
    add({ field: 'place_of_birth_oblast', kind: 'place_city', latin: lat.oblast, cyr: cyr.oblast }, placeSrc)
    add({ field: 'place_of_birth_republic', kind: 'text', latin: lat.republic, cyr: cyr.republic }, placeSrc)
  }

  // registry office
  const officeSrc = by.get('issuing_authority')
  if (officeSrc) {
    const lat = splitRegistryOffice(officeSrc.value ?? '')
    const cyr = splitRegistryOffice(officeSrc.raw_cyrillic ?? '')
    add({ field: 'registry_office_district', kind: 'agency', latin: lat.district, cyr: cyr.district }, officeSrc)
    add({ field: 'registry_office_oblast', kind: 'agency', latin: lat.oblast, cyr: cyr.oblast }, officeSrc)
  }

  return rows.length ? [...fields, ...rows] : fields
}
