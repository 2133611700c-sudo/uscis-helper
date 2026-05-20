/**
 * U.S. Driver's License / State ID extraction module — REAL_DOC AUDIT R3.
 *
 * Built 2026-05-20 after the DL slot consistently triggered Brain
 * INVALID_JSON in production (DeepSeek appears to refuse JSON output on
 * card content that matches the US-DL safety filter). Even with
 * maxTokens=2500, the model returned an empty completion. We don't
 * control DeepSeek's safety classifier, but we DO control whether DL
 * extraction has to ride on a third party at all.
 *
 * The American DL has a stable, label-anchored layout (CA, NY, FL all
 * follow the AAMVA spec on the visible side). The rule module here
 * matches every field via narrow regex and never calls Brain.
 *
 * Labels recognized:
 *   DL <token>     → dl_number (state license ID)
 *   LN <surname>   → family_name
 *   FN <given>     → given_name
 *   DOB MM/DD/YYYY → dob
 *   SEX M|F|X      → sex
 *   HGT 6'-06"     → height (foot-inches literal)
 *   WGT 231 lb     → weight
 *   EYES BRN       → eye_color (3-letter)
 *   HAIR BRN       → hair_color (3-letter)
 *
 * Address heuristic:
 *   The address is two consecutive lines without an "Address:" label:
 *     line A: street + apartment ("4341 WILLOW BROOK AVE 111")
 *     line B: "CITY, ST ZIP"     ("LOS ANGELES, CA 90029")
 *   We find line B by regex `^[A-Z .'-]+, [A-Z]{2} \d{5}(-\d{4})?$`
 *   and take the preceding line as line A.
 *
 * Output convention:
 *   - family_name / given_name: title-cased Latin.
 *   - us_address_street / us_address_city: title-cased.
 *   - us_address_state: uppercase 2-letter USPS.
 *   - us_address_zip: digits (with optional -NNNN).
 *   - height / weight / eye_color / hair_color: literal as printed.
 *
 * The wizard's identity-conflict guard makes passport authoritative
 * for family_name / given_name / dob / sex regardless of what this
 * module returns. So DL identity fields are fine as cross-reference
 * even if the DL has a slight name variant.
 */

import type { OcrResult } from '@/lib/ocr/types'
import type { TpsExtractedField, TpsModuleResult } from '@/lib/tps/types'

const DL_MODULE = 'dl' as const

// MM/DD/YYYY → YYYY-MM-DD (ISO for TPSAnswers).
function usDateToIso(d: string): string | null {
  const m = d.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return null
  const mm = m[1].padStart(2, '0')
  const dd = m[2].padStart(2, '0')
  return `${m[3]}-${mm}-${dd}`
}

// Same title-case logic as the Brain post-processor, replicated here
// so the rule path doesn't need to share state with documentBrain.ts.
const POSTAL_KEEP_UPPER = new Set([
  'APT', 'PO', 'NE', 'NW', 'SE', 'SW', 'N', 'S', 'E', 'W', 'USA', 'US',
])
function titleCaseToken(tok: string): string {
  if (!tok) return tok
  if (/^[0-9][0-9-]*$/.test(tok)) return tok
  const upper = tok.toUpperCase()
  if (POSTAL_KEEP_UPPER.has(upper)) return upper
  const m = tok.match(/^([\p{L}'’]+)(.*)$/u)
  if (!m) return tok
  return m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase() + m[2]
}
function titleCaseString(s: string): string {
  return s
    .split(' ')
    .map((seg) =>
      seg.includes('-') ? seg.split('-').map(titleCaseToken).join('-') : titleCaseToken(seg),
    )
    .join(' ')
}

interface DlOptions {
  document_id: string
}

/**
 * Search every line for a regex match. Returns the FIRST match payload.
 */
function findOnAnyLine(
  ocr: OcrResult,
  pattern: RegExp,
): { value: string; bbox: OcrResult['lines'][number]['bbox']; confidence: number | null } | null {
  for (const line of ocr.lines) {
    const m = line.text.match(pattern)
    if (m) {
      return {
        value: m[1] ?? m[0],
        bbox: line.bbox,
        confidence: line.confidence ?? null,
      }
    }
  }
  return null
}

/**
 * Find the city/state/zip line ("LOS ANGELES, CA 90029") and return
 * both that line and the immediately-preceding line (the street).
 */
function findAddressPair(ocr: OcrResult): {
  street: string
  city: string
  state: string
  zip: string
} | null {
  // Match "CITY NAME, ST ZIP" with optional ZIP+4. Accept any uppercase
  // letters + spaces + .'- in city, exactly 2 uppercase state letters,
  // and 5-digit or 9-digit ZIP.
  const cityLineRe = /^([A-Z][A-Z .'\-]*[A-Z]),\s+([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/
  for (let i = 1; i < ocr.lines.length; i++) {
    const m = ocr.lines[i].text.match(cityLineRe)
    if (!m) continue
    const street = (ocr.lines[i - 1]?.text ?? '').trim()
    if (!street || street.length < 4) continue
    // Defensive: street line should NOT itself look like a city line,
    // otherwise we'd swallow two cities (unlikely on a DL but cheap).
    if (cityLineRe.test(street)) continue
    return {
      street: titleCaseString(street),
      city: titleCaseString(m[1]),
      state: m[2].toUpperCase(),
      zip: m[3],
    }
  }
  return null
}

export function runDlModule(ocr: OcrResult, opts: DlOptions): TpsModuleResult {
  const fields: TpsExtractedField[] = []
  const warnings: string[] = []

  const base = {
    extraction_source: 'ocr_keyword' as const,
    source_document_id: opts.document_id,
    language_layer: 'mixed' as const,
    user_corrected: false,
    bbox: null,
    confidence: 0.95,
    review_required: false,
    ocr_word_ids: [],
    passes: [],
    failures: [],
  }

  // ── DL number — letter + digits or digits-only; appears after "DL ".
  const dl = findOnAnyLine(ocr, /\bDL\s+([A-Z0-9]+)\b/)
  if (dl) {
    fields.push({ ...base, field: 'dl_number', raw_value: dl.value, normalized_value: dl.value, source_zone: 'dl_label', bbox: dl.bbox, confidence: dl.confidence })
  }

  // ── LN — last name (uppercase letters, may include apostrophe or dash).
  const ln = findOnAnyLine(ocr, /\bLN\s+([A-Z][A-Z'\-]+)\b/)
  if (ln) {
    fields.push({ ...base, field: 'family_name', raw_value: ln.value, normalized_value: titleCaseString(ln.value), source_zone: 'ln_label', bbox: ln.bbox, confidence: ln.confidence, review_required: true })
  }

  // ── FN — first name (allows space-separated middle names).
  const fn = findOnAnyLine(ocr, /\bFN\s+([A-Z][A-Z'\- ]+?)(?:\s{2,}|$)/)
  if (fn) {
    fields.push({ ...base, field: 'given_name', raw_value: fn.value.trim(), normalized_value: titleCaseString(fn.value.trim()), source_zone: 'fn_label', bbox: fn.bbox, confidence: fn.confidence, review_required: true })
  }

  // ── DOB — MM/DD/YYYY (US format).
  const dob = findOnAnyLine(ocr, /\bDOB\s+(\d{2}\/\d{2}\/\d{4})\b/)
  if (dob) {
    fields.push({ ...base, field: 'dob', raw_value: dob.value, normalized_value: usDateToIso(dob.value) ?? dob.value, source_zone: 'dob_label', bbox: dob.bbox, confidence: dob.confidence })
  }

  // ── SEX — single letter M / F / X. Pattern handles "SEX M" or "SEX: M".
  const sex = findOnAnyLine(ocr, /\bSEX\s*:?\s*([MFX])\b/)
  if (sex) {
    fields.push({ ...base, field: 'sex', raw_value: sex.value, normalized_value: sex.value, source_zone: 'sex_label', bbox: sex.bbox, confidence: sex.confidence })
  }

  // ── HGT — height in feet-inches. Accept both 6'-06" and 6'06" forms.
  // The literal apostrophes / quotes are preserved.
  const hgt = findOnAnyLine(ocr, /\bHGT\s+(\d['′][\s-]*\d{1,2}["″])/)
  if (hgt) {
    fields.push({ ...base, field: 'height', raw_value: hgt.value, normalized_value: hgt.value, source_zone: 'hgt_label', bbox: hgt.bbox, confidence: hgt.confidence })
  }

  // ── WGT — weight, e.g. "231 lb" or "78 kg".
  const wgt = findOnAnyLine(ocr, /\bWGT\s+(\d{2,3}\s*(?:lb|kg))/i)
  if (wgt) {
    fields.push({ ...base, field: 'weight', raw_value: wgt.value, normalized_value: wgt.value, source_zone: 'wgt_label', bbox: wgt.bbox, confidence: wgt.confidence })
  }

  // ── EYES — 3-letter color code (BRN, BLU, GRN, HZL, BLK, GRY).
  const eyes = findOnAnyLine(ocr, /\bEYES\s+([A-Z]{3})\b/)
  if (eyes) {
    fields.push({ ...base, field: 'eye_color', raw_value: eyes.value, normalized_value: eyes.value, source_zone: 'eyes_label', bbox: eyes.bbox, confidence: eyes.confidence })
  }

  // ── HAIR — 3-letter color code.
  const hair = findOnAnyLine(ocr, /\bHAIR\s+([A-Z]{3})\b/)
  if (hair) {
    fields.push({ ...base, field: 'hair_color', raw_value: hair.value, normalized_value: hair.value, source_zone: 'hair_label', bbox: hair.bbox, confidence: hair.confidence })
  }

  // ── Address pair — two consecutive lines, the second matches CITY, ST ZIP.
  const addr = findAddressPair(ocr)
  if (addr) {
    fields.push({ ...base, field: 'us_address_street', raw_value: addr.street, normalized_value: addr.street, source_zone: 'address_line_1', review_required: true })
    fields.push({ ...base, field: 'us_address_city',   raw_value: addr.city,   normalized_value: addr.city,   source_zone: 'address_line_2', review_required: true })
    fields.push({ ...base, field: 'us_address_state',  raw_value: addr.state,  normalized_value: addr.state,  source_zone: 'address_line_2' })
    fields.push({ ...base, field: 'us_address_zip',    raw_value: addr.zip,    normalized_value: addr.zip,    source_zone: 'address_line_2' })
  } else {
    warnings.push('DL address pair (street + CITY, ST ZIP) not detected.')
  }

  // Match requires at least 3 anchored fields — single hits are too
  // weak to confidently call this a DL (could be any text block with
  // an "LN" sequence). 3+ anchors is a reliable lower bound.
  const matched = fields.length >= 3

  if (!matched) {
    return {
      module: DL_MODULE,
      matched: false,
      match_reason: 'too_few_dl_anchors_matched',
      fields: [],
      warnings: ['Document does not look like a U.S. Driver\'s License. Tried DL / LN / FN / DOB / SEX anchors.'],
      manual_review_required: false,
      manual_review_reasons: [],
    }
  }

  return {
    module: DL_MODULE,
    matched: true,
    match_reason: 'dl_anchors_matched',
    fields,
    warnings,
    manual_review_required: false,
    manual_review_reasons: [],
  }
}
