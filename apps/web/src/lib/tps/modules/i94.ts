/**
 * I-94 extraction module — CBP Arrival/Departure record.
 *
 * Source: https://i94.cbp.dhs.gov — printout or screenshot.
 *
 * The I-94 is a non-standard layout document (CBP changes formats), so
 * we anchor extraction to labelled keywords rather than positional zones:
 *
 *   "Admission (I-94) Number"          → 11-digit identifier
 *   "Class of Admission" / "COA"       → e.g. "UH" (Uniting for Ukraine parolee),
 *                                              "B2" (visitor), "F1" (student)
 *   "Date of Entry" / "Most Recent…"   → MM/DD/YYYY
 *   "Admit Until Date" / "Admit Until" → MM/DD/YYYY or "D/S"
 *
 * Reuse: lib/ocr/types for OcrResult shape. No external library needed.
 */

import type { OcrResult } from '@/lib/ocr/types'
import type { TpsExtractedField, TpsModuleResult } from '@/lib/tps/types'

const I94_MODULE = 'i94' as const

// MM/DD/YYYY → YYYY-MM-DD (ISO for TPSAnswers)
function usDateToIso(d: string): string | null {
  const m = d.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return null
  const mm = m[1].padStart(2, '0')
  const dd = m[2].padStart(2, '0')
  return `${m[3]}-${mm}-${dd}`
}

interface I94Options {
  document_id: string
}

/**
 * Search OcrResult for a labelled value. Returns the first match found
 * anywhere in the document text along with the line that contained it
 * (for bbox provenance).
 */
function findLabelledValue(
  ocr: OcrResult,
  labelPatterns: RegExp[],
  valuePattern: RegExp,
): { value: string; lineId: string; bbox: OcrResult['lines'][number]['bbox']; confidence: number | null } | null {
  // Build full text with line metadata so we can backtrack to bbox.
  // Strategy: look in each line; if line contains label, try to extract
  // value either from same line or next line.
  for (let i = 0; i < ocr.lines.length; i++) {
    const line = ocr.lines[i]
    if (!labelPatterns.some((p) => p.test(line.text))) continue
    // Same-line value first
    const sameLine = line.text.match(valuePattern)
    if (sameLine) {
      return {
        value: sameLine[1] ?? sameLine[0],
        lineId: line.id,
        bbox: line.bbox,
        confidence: line.confidence ?? null,
      }
    }
    // Next-line value (CBP printouts often put label above value)
    const next = ocr.lines[i + 1]
    if (next) {
      const nextLine = next.text.match(valuePattern)
      if (nextLine) {
        return {
          value: nextLine[1] ?? nextLine[0],
          lineId: next.id,
          bbox: next.bbox,
          confidence: next.confidence ?? null,
        }
      }
    }
  }
  return null
}

export function runI94Module(ocr: OcrResult, opts: I94Options): TpsModuleResult {
  const fields: TpsExtractedField[] = []
  const warnings: string[] = []
  const manual_review_reasons: string[] = []

  const base = {
    extraction_source: 'ocr_keyword' as const,
    source_document_id: opts.document_id,
    language_layer: 'mixed' as const,
    user_corrected: false,
  }

  // ── 1. Admission (I-94) Number — 11 digits ────────────────────────────────
  const adm = findLabelledValue(
    ocr,
    [
      /admission\s*\(\s*[I1]\s*[-\s]?\s*94\s*\)\s*number/i,
      /[I1]\s*[-\s]?\s*94\s*number/i,
      /\badmission\s+number\b/i,
    ],
    /\b(\d{11})\b/,
  )
  if (adm) {
    fields.push({
      ...base,
      field: 'i94_admission_number',
      raw_value: adm.value,
      normalized_value: adm.value,
      source_zone: 'i94_admission_number',
      bbox: adm.bbox,
      confidence: adm.confidence,
      review_required: false,
      ocr_word_ids: [],
      passes: ['i94_admission_number_11_digits'],
      failures: [],
    })
  } else {
    warnings.push('I-94 admission number (11 digits) not detected near label.')
  }

  // ── 2. Class of Admission ─────────────────────────────────────────────────
  // CBP classes: 1-3 alphanumeric (e.g. UH, B2, F1, K3). Allow optional
  // dash like B-2 / F-1.
  const coa = findLabelledValue(
    ocr,
    [/class\s*of\s*admission/i, /\bCOA\b/i, /admission\s*class/i],
    /\b([A-Z]{1,2}[-\s]?[0-9]?[A-Z]?)\b/,
  )
  if (coa) {
    const normalized = coa.value.replace(/[-\s]/g, '').toUpperCase()
    fields.push({
      ...base,
      field: 'i94_class_of_admission',
      raw_value: coa.value,
      normalized_value: normalized,
      source_zone: 'i94_coa',
      bbox: coa.bbox,
      confidence: coa.confidence,
      review_required: false,
      ocr_word_ids: [],
      passes: ['i94_coa_present'],
      failures: [],
    })
  } else {
    warnings.push('I-94 Class of Admission not detected.')
  }

  // ── 3. Date of Entry ──────────────────────────────────────────────────────
  const entry = findLabelledValue(
    ocr,
    [/(?:most\s*recent\s*)?date\s*of\s*(?:entry|admission)/i, /admit(?:ted)?\s*on/i],
    /\b(\d{1,2}\/\d{1,2}\/\d{4})\b/,
  )
  if (entry) {
    const iso = usDateToIso(entry.value)
    fields.push({
      ...base,
      field: 'last_entry_date',
      raw_value: entry.value,
      normalized_value: iso,
      source_zone: 'i94_date_of_entry',
      bbox: entry.bbox,
      confidence: entry.confidence,
      review_required: !iso,
      ocr_word_ids: [],
      passes: iso ? ['us_date_to_iso'] : [],
      failures: iso ? [] : ['date_parse_failed'],
    })
  } else {
    warnings.push('I-94 Date of Entry not detected.')
  }

  // ── 4. Admit Until ────────────────────────────────────────────────────────
  // Can be MM/DD/YYYY or "D/S" (duration of status).
  const admitUntilDate = findLabelledValue(
    ocr,
    [/admit\s*until/i],
    /\b(\d{1,2}\/\d{1,2}\/\d{4}|D\/S)\b/,
  )
  if (admitUntilDate) {
    const iso = admitUntilDate.value === 'D/S' ? null : usDateToIso(admitUntilDate.value)
    fields.push({
      ...base,
      field: 'i94_admit_until',
      raw_value: admitUntilDate.value,
      normalized_value: iso ?? admitUntilDate.value,
      source_zone: 'i94_admit_until',
      bbox: admitUntilDate.bbox,
      confidence: admitUntilDate.confidence,
      review_required: false,
      ocr_word_ids: [],
      passes: admitUntilDate.value === 'D/S' ? ['admit_until_ds'] : iso ? ['us_date_to_iso'] : [],
      failures: [],
    })
  }

  const matched = fields.length >= 2  // need at least admission# + COA OR entry date
  if (!matched) {
    return {
      module: I94_MODULE,
      matched: false,
      match_reason: 'too_few_i94_anchors_matched',
      fields: [],
      warnings: ['Document does not look like an I-94 record. Tried admission#, COA, date of entry.'],
      manual_review_required: false,
      manual_review_reasons: [],
    }
  }

  return {
    module: I94_MODULE,
    matched: true,
    match_reason: 'i94_anchors_matched',
    fields,
    warnings,
    manual_review_required: manual_review_reasons.length > 0,
    manual_review_reasons,
  }
}
