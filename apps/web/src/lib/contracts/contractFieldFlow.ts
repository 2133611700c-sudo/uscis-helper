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
  normalizePlace,
  normalizeOblastToNominative,
  settlementDesignatorEn,
  type NormalizationContext,
} from '@uscis-helper/knowledge'
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

// ── Phase 7: normalize/translate the split fields via the knowledge codex ───────
//
// Flag UNIFIED_DOC_CONTRACT_NORMALIZE_ENABLED (default OFF). Runs ONLY the split
// rows (review_reasons includes 'contract_split_field') through the EXISTING
// packages/knowledge functions — never a parallel dictionary (Constitution L2).
// Strict layering: raw_cyrillic stays the RAW segment (untouched); `value` becomes
// the NORMALIZED/TRANSLATED English. Confirmed value is the review layer (Phase 8).
// The normalizer NEVER guesses missing data or abbreviates district/oblast: when
// the codex cannot validate, the structural value is kept and review_required=true.

export function isUnifiedDocContractNormalizeEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.UNIFIED_DOC_CONTRACT_NORMALIZE_ENABLED === '1'
}

const SPLIT_REASON = 'contract_split_field'
const CTX: NormalizationContext = { mode: 'uscis_normalized', is_historical_document: true }

/** Knowledge-normalize one split row's raw Cyrillic into its English value. */
function normalizeSplitValue(field: string, rawCyr: string | null, latin: string | null): { value: string | null; review: boolean } {
  const raw = (rawCyr ?? '').trim()
  const keepLatin = latin?.trim() || null
  if (!raw) return { value: keepLatin, review: true }

  // oblast → genitive→nominative DMS-verified English (preserve full form)
  if (field === 'place_of_birth_oblast' || field === 'registry_office_oblast') {
    const o = normalizeOblastToNominative(raw)
    if (o?.transliterated) {
      const v = /\boblast$/i.test(o.transliterated) ? o.transliterated : `${o.transliterated} Oblast`
      return { value: v, review: false }
    }
    return { value: keepLatin, review: true }
  }
  // settlement type → designator (смт → "urban-type settlement", NEVER city/town).
  // settlementDesignatorEn matches a designator PREFIX of a fuller string, so the
  // bare type token is suffixed with a sentinel word to satisfy the regex.
  if (field === 'place_of_birth_settlement_type') {
    const d = settlementDesignatorEn(`${raw} Х`)
    return d ? { value: d, review: false } : { value: keepLatin ?? raw, review: true }
  }
  // district → place normalizer (settlement lookup; full form preserved, no abbrev)
  if (field === 'place_of_birth_district' || field === 'registry_office_district') {
    const n = normalizePlace(raw, field, 'birth_certificate', CTX)
    return { value: n.normalized_value || keepLatin, review: n.review_required }
  }
  // republic (УРСР), series, number → locked verbatim: never guess/translate. Keep
  // the structural value (Latin transliteration or printed), force review.
  return { value: keepLatin ?? raw, review: true }
}

/** Phase 7 — normalize split rows in place-ish (returns a new array). OFF → identity. */
export function normalizeContractSplitFields(
  fields: FieldOut[],
  env: Record<string, string | undefined> = process.env,
): FieldOut[] {
  if (!isUnifiedDocContractNormalizeEnabled(env)) return fields
  let touched = false
  const out = fields.map((f) => {
    if (!f.review_reasons?.includes(SPLIT_REASON)) return f
    const { value, review } = normalizeSplitValue(f.field, f.raw_cyrillic, f.value)
    if (value === f.value && review === f.review_required) return f
    touched = true
    // raw_cyrillic (RAW) untouched; value = NORMALIZED/TRANSLATED layer.
    return { ...f, value, review_required: f.review_required || review }
  })
  return touched ? out : fields
}
