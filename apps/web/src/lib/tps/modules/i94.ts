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

// CBP I-94 printouts often show dates as "2022 September 09" or
// "2022 Sep 09". Normalize to MM/DD/YYYY so the rest of the pipeline
// (which only knows US date) keeps working unchanged.
const MONTHS_LONG: Record<string, string> = {
  january: '01', february: '02', march: '03', april: '04',
  may: '05', june: '06', july: '07', august: '08',
  september: '09', october: '10', november: '11', december: '12',
  jan: '01', feb: '02', mar: '03', apr: '04', jun: '06', jul: '07',
  aug: '08', sep: '09', sept: '09', oct: '10', nov: '11', dec: '12',
}

function yyyyMonthDdToUs(s: string): string | null {
  // "2022 September 09" or "2022 Sep 9" — case-insensitive.
  const m = s.match(/\b(\d{4})\s+([A-Za-z]{3,9})\s+(\d{1,2})\b/)
  if (!m) return null
  const mm = MONTHS_LONG[m[2].toLowerCase()]
  if (!mm) return null
  const dd = m[3].padStart(2, '0')
  return `${mm}/${dd}/${m[1]}`
}

// Try MM/DD/YYYY first (whitelisted by valuePattern), fall back to
// YYYY Month DD if the caller passes a raw line.
function anyDateToUs(s: string): string | null {
  const us = s.match(/\b(\d{1,2}\/\d{1,2}\/\d{4})\b/)
  if (us) return us[1]
  return yyyyMonthDdToUs(s)
}

interface I94Options {
  document_id: string
}

/**
 * Like findLabelledValue, but takes a free predicate over line text
 * instead of an array of patterns. Lets the caller compose positive
 * AND negative checks (e.g. matches "Date of Entry" AND NOT contains
 * "until") so anchors stay strictly disjoint.
 */
function findLabelledValueStrict(
  ocr: OcrResult,
  labelPredicate: (text: string) => boolean,
  valuePattern: RegExp,
): { value: string; lineId: string; bbox: OcrResult['lines'][number]['bbox']; confidence: number | null } | null {
  for (let i = 0; i < ocr.lines.length; i++) {
    const line = ocr.lines[i]
    if (!labelPredicate(line.text)) continue
    const sameLine = line.text.match(valuePattern)
    if (sameLine) {
      return {
        value: sameLine[1] ?? sameLine[0],
        lineId: line.id,
        bbox: line.bbox,
        confidence: line.confidence ?? null,
      }
    }
    const next = ocr.lines[i + 1]
    if (next) {
      const nextLine = next.text.match(valuePattern)
      if (nextLine) {
        // Sanity: the next-line value cannot itself carry a different
        // strict label (e.g. don't let "Date of Entry:" steal the
        // value sitting on the next line if that next line is actually
        // "Admit Until Date: 09/07/2024").
        if (labelPredicate(next.text) || /until/i.test(next.text)) {
          continue
        }
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
  //
  // STRICT anchors per T3PS_ROBUST_OCR spec — only match label lines that
  // explicitly say "Date of Entry" (or its variants). NEVER match lines
  // containing the word "until" — that's a different field.
  //
  // CBP's web printout uses "2022 September 09" (YYYY Month DD); the
  // travel-history table uses "MM/DD/YYYY". Both accepted.
  const ENTRY_LABEL_PATTERNS = [
    /(?:most\s*recent\s*)?date\s*of\s*(?:entry|admission)/i,
    /admit(?:ted)?\s*on/i,
  ]
  const isEntryLabel = (text: string): boolean =>
    ENTRY_LABEL_PATTERNS.some((p) => p.test(text)) && !/until/i.test(text)

  const entry =
    findLabelledValueStrict(ocr, isEntryLabel, /\b(\d{1,2}\/\d{1,2}\/\d{4})\b/) ??
    findLabelledValueStrict(ocr, isEntryLabel, /\b(\d{4}\s+[A-Za-z]{3,9}\s+\d{1,2})\b/)
  if (entry) {
    const usForm = anyDateToUs(entry.value) ?? entry.value
    const iso = usDateToIso(usForm)
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
  //
  // STRICT anchor: require the word "until" in the label. This is the only
  // CBP field that uses it, so it's a positive disambiguator. Accept
  // MM/DD/YYYY, "YYYY Month DD" (CBP web format), or "D/S" (duration of
  // status).
  const isAdmitUntilLabel = (text: string): boolean =>
    /admit\s*until/i.test(text)

  const admitUntilDate =
    findLabelledValueStrict(ocr, isAdmitUntilLabel, /\b(\d{1,2}\/\d{1,2}\/\d{4}|D\/S)\b/) ??
    findLabelledValueStrict(ocr, isAdmitUntilLabel, /\b(\d{4}\s+[A-Za-z]{3,9}\s+\d{1,2})\b/)
  if (admitUntilDate) {
    const isDS = admitUntilDate.value === 'D/S'
    const usForm = isDS ? null : (anyDateToUs(admitUntilDate.value) ?? admitUntilDate.value)
    const iso = !usForm ? null : usDateToIso(usForm)
    fields.push({
      ...base,
      field: 'i94_admit_until',
      raw_value: admitUntilDate.value,
      normalized_value: iso ?? (isDS ? 'D/S' : usForm ?? admitUntilDate.value),
      source_zone: 'i94_admit_until',
      bbox: admitUntilDate.bbox,
      confidence: admitUntilDate.confidence,
      review_required: false,
      ocr_word_ids: [],
      passes: isDS ? ['admit_until_ds'] : iso ? ['us_date_to_iso'] : [],
      failures: [],
    })
  }

  // ── 5. Sanity guard: last_entry_date should NEVER equal admit_until ─────
  // If they did match, our anchor parser collapsed two different CBP fields
  // onto the same source date — this is a strong signal something is wrong
  // with the OCR layout. We don't drop the values (they may legitimately
  // match in rare cases like an expiring parolee re-entry), but we mark
  // both as requires_review so the wizard's amber 'verify' badge fires
  // and the user looks twice before generating the PDF.
  const entryField = fields.find((f) => f.field === 'last_entry_date')
  const admitField = fields.find((f) => f.field === 'i94_admit_until')
  if (
    entryField && admitField &&
    entryField.normalized_value && admitField.normalized_value &&
    entryField.normalized_value === admitField.normalized_value
  ) {
    entryField.review_required = true
    admitField.review_required = true
    entryField.failures = [...(entryField.failures ?? []), 'collision_with_admit_until']
    admitField.failures = [...(admitField.failures ?? []), 'collision_with_last_entry_date']
    warnings.push('I-94 last_entry_date matches admit_until — verify manually.')
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
