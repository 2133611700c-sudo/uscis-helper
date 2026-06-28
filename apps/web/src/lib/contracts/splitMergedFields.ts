/**
 * Phase 5 — split the merged semantic fields of the unified birth-cert contract.
 *
 * Some legacy extraction keys pack SEVERAL canonical values into one string:
 *   certificate_series_number  → document.series + document.number
 *   place_of_birth_city        → settlement (+ type) + district + oblast + republic
 *   issuing_authority          → registry.office.name (+ district + oblast)
 *
 * This module turns one merged ExtractedFieldLite into ADDITIVE split fields,
 * keyed by the contract's runtimeKeys, WITHOUT modifying the original field.
 *
 * STRICTLY ADDITIVE + FLAG-GATED behind UNIFIED_DOC_CONTRACT_SPLIT_ENABLED
 * (default OFF, independent of the Phase 3/4 master flag):
 *   - OFF → splitMergedFields returns the input array unchanged (identity).
 *   - ON  → returns the original fields (untouched) + the derived split fields.
 *
 * It is NOT wired into the mirror/PDF/review pipeline, so the golden output and
 * PDF are byte-identical regardless of the flag. It only STRUCTURALLY segments a
 * string (no transliteration, no term→English mapping — normalization/translation
 * stays in packages/knowledge per Constitution L2). No OCR/model/handwriting/layout
 * is touched. No data is lost (merged field preserved) or duplicated (split fields
 * use NEW runtimeKeys distinct from the merged key).
 */
import type { ExtractedFieldLite } from '@/lib/translation/pdf/buildMirrorValues'

export function isUnifiedDocContractSplitEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.UNIFIED_DOC_CONTRACT_SPLIT_ENABLED === '1'
}

export interface SplitField {
  runtimeKey: string
  canonicalKey: string
  value: string
  /** the merged extraction key this value was derived from (provenance). */
  sourceMergedKey: string
  /** structural split is best-effort — flag uncertain results for human review. */
  review: boolean
}

const firstValue = (f: ExtractedFieldLite): string =>
  (f.final_value ?? f.normalized_value ?? f.value ?? '').trim()

// ── series + number ───────────────────────────────────────────────────────────
// Format on the blank: "<Roman series>-<1-3 Cyrillic/Latin letters> № <digits>",
// e.g. "II-BK 530174" / "III-ВВ № 123456". Series = letters block, number = digits.
const SERIES_NUMBER_RE =
  /^\s*([IVXLCDM]+\s*[-–—]\s*[A-ZЀ-ӿ]{1,3})\s*(?:№|N|#)?\s*([0-9]{4,8})\s*$/i

export function splitSeriesNumber(raw: string): { series?: string; number?: string } {
  const m = SERIES_NUMBER_RE.exec(raw)
  if (!m) return {}
  return { series: m[1].replace(/\s+/g, ''), number: m[2] }
}

// ── place of birth ──────────────────────────────────────────────────────────
// STRUCTURAL segmentation only (markers, not a terminology dictionary). The merged
// string is a comma list "<settlement>, <district>, <oblast>, <republic>"; each
// component is classified by a role marker. Unmatched leading segment = settlement.
const SETTLEMENT_TYPE_RE = /^(смт|с-?ще|пгт|с\.|село|м\.|місто|город|хутір|хут\.)\s*\.?\s*/iu
const DISTRICT_MARKER = /(р-?н|район|district)/iu
const OBLAST_MARKER = /(обл\.?|область|області|oblast|край)/iu
const REPUBLIC_MARKER = /(УРСР|УССР|РРФСР|РСФСР|UkrSSR|Ukrainian SSR|U[\.\s]?S[\.\s]?S[\.\s]?R|SSR)/iu

export interface PlaceParts {
  settlement_type?: string
  settlement?: string
  district?: string
  oblast?: string
  republic?: string
}

export function splitBirthPlace(raw: string): PlaceParts {
  const segs = raw.split(',').map((s) => s.trim()).filter(Boolean)
  if (segs.length === 0) return {}
  const out: PlaceParts = {}
  for (const seg of segs) {
    if (!out.settlement && !DISTRICT_MARKER.test(seg) && !OBLAST_MARKER.test(seg) && !REPUBLIC_MARKER.test(seg)) {
      const tm = SETTLEMENT_TYPE_RE.exec(seg)
      if (tm) {
        out.settlement_type = tm[1]
        out.settlement = seg.slice(tm[0].length).trim() || undefined
      } else {
        out.settlement = seg
      }
      continue
    }
    if (!out.district && DISTRICT_MARKER.test(seg) && !OBLAST_MARKER.test(seg)) { out.district = seg; continue }
    if (!out.oblast && OBLAST_MARKER.test(seg)) { out.oblast = seg; continue }
    if (!out.republic && REPUBLIC_MARKER.test(seg)) { out.republic = seg; continue }
  }
  return out
}

// ── registry office ───────────────────────────────────────────────────────────
// "<office name>, <oblast>" (district sometimes a standalone trailing segment).
// Conservative: a STANDALONE oblast/district segment is peeled off; the office
// name keeps everything else verbatim (district words inside the name are NOT
// mangled). Best-effort → review=true on the parts.
export interface RegistryParts { name?: string; district?: string; oblast?: string }

export function splitRegistryOffice(raw: string): RegistryParts {
  const segs = raw.split(',').map((s) => s.trim()).filter(Boolean)
  if (segs.length === 0) return {}
  const out: RegistryParts = {}
  const nameParts: string[] = []
  for (const seg of segs) {
    if (!out.oblast && OBLAST_MARKER.test(seg) && seg.split(/\s+/).length <= 3) { out.oblast = seg; continue }
    if (!out.district && DISTRICT_MARKER.test(seg) && seg.split(/\s+/).length <= 3) { out.district = seg; continue }
    nameParts.push(seg)
  }
  if (nameParts.length) out.name = nameParts.join(', ')
  return out
}

/**
 * Produce the additive split fields for a single document's extracted fields.
 * Flag OFF → returns `extracted` unchanged (same reference). Flag ON → returns a
 * NEW array = original fields (untouched) + derived split fields appended.
 */
export function splitMergedFields(
  extracted: ExtractedFieldLite[],
  env: Record<string, string | undefined> = process.env,
): ExtractedFieldLite[] {
  if (!isUnifiedDocContractSplitEnabled(env)) return extracted
  return [...extracted, ...computeSplitFields(extracted).map((s) => ({
    field: s.runtimeKey,
    value: s.value,
    review_required: s.review,
  }))]
}

/** The derived split fields (structured), for tests and downstream consumers. */
export function computeSplitFields(extracted: ExtractedFieldLite[]): SplitField[] {
  const byKey = new Map(extracted.map((f) => [f.field, f]))
  const out: SplitField[] = []
  const push = (runtimeKey: string, canonicalKey: string, value: string | undefined, src: string, review: boolean) => {
    if (value && value.trim()) out.push({ runtimeKey, canonicalKey, value: value.trim(), sourceMergedKey: src, review })
  }

  // series / number
  const seriesField = byKey.get('certificate_series_number') ?? byKey.get('series_number')
  if (seriesField) {
    const { series, number } = splitSeriesNumber(firstValue(seriesField))
    push('document_series', 'document.series', series, seriesField.field, false)
    push('document_number', 'document.number', number, seriesField.field, false)
  }

  // place of birth
  const placeField = byKey.get('place_of_birth_city') ?? byKey.get('place_of_birth') ?? byKey.get('city_of_birth')
  if (placeField) {
    const p = splitBirthPlace(firstValue(placeField))
    push('place_of_birth_settlement_type', 'event.birth.settlement_type', p.settlement_type, placeField.field, false)
    push('place_of_birth_district', 'event.birth.district', p.district, placeField.field, true)
    push('place_of_birth_oblast', 'event.birth.oblast', p.oblast, placeField.field, true)
    push('place_of_birth_republic', 'event.birth.republic', p.republic, placeField.field, true)
  }

  // registry office
  const officeField = byKey.get('issuing_authority')
  if (officeField) {
    const r = splitRegistryOffice(firstValue(officeField))
    push('registry_office_district', 'registry.office.district', r.district, officeField.field, true)
    push('registry_office_oblast', 'registry.office.oblast', r.oblast, officeField.field, true)
  }

  return out
}
