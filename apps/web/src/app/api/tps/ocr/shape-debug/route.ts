/**
 * Shape-only OCR debug endpoint.
 *
 * Why this exists:
 *   When a real user reports "passport_number / sex not extracted from my
 *   booklet", the agent has NO way to diagnose without raw OCR text.
 *   But raw OCR text contains PII (name, DOB, passport number) and the
 *   normal /api/tps/ocr/extract response strips raw_text to '' for that
 *   reason. We're stuck: can't diagnose, can't fix root cause.
 *
 * What this returns: STRUCTURE ONLY. Zero personally-identifiable values.
 *
 *   {
 *     raw_text_length: number,                 // chars
 *     lines_count: number,                     // OCR line count
 *     mrz_candidate_lines_count: number,       // lines that LOOK like TD3 MRZ
 *     mrz_first_line_has_p_uppercase: boolean, // P<UKR pattern present?
 *     labels_present: {                        // booklet-label markers
 *       has_label_surname: boolean,
 *       has_label_given: boolean,
 *       has_label_dob: boolean,
 *       has_label_sex: boolean,
 *       has_label_series_or_number: boolean,
 *       has_label_nationality: boolean,
 *     },
 *     module_run: 'td3' | 'booklet' | 'both' | 'none',
 *     module_match_reason: string,
 *     emitted_field_names: string[],           // FIELD NAMES, not values
 *     emitted_field_count: number,
 *     strict_validator_would_drop: string[],   // field names that fail shape
 *   }
 *
 * Caller workflow:
 *   1. Upload passport via this endpoint (same multipart shape as
 *      /api/tps/ocr/extract).
 *   2. Send the JSON response to the agent.
 *   3. Agent gets a structural picture of OCR quality WITHOUT seeing
 *      the user's real data.
 *
 * Privacy posture:
 *   - No values returned. Only counts and boolean presence checks.
 *   - Response cannot be reverse-engineered to a person.
 *   - Safe to share publicly (e.g. in a GitHub issue, chat message).
 */

import { NextResponse, type NextRequest } from 'next/server'
import { googleVisionProvider } from '@/lib/ocr/providers/google-vision'
import { runPassportModule } from '@/lib/tps/modules/passport'
import { runPassportBookletModule } from '@/lib/tps/modules/passportBooklet'
import { isStrictValidValue } from '@/lib/tps/strictValidators'
import type { OcrLine } from '@/lib/ocr/types'
import { isBlocked } from '@/lib/ocr/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Booklet labels we look for, in the EXACT casing the booklet prints.
const LABEL_PATTERNS = {
  has_label_surname: /Прізвище|Призвище|Surname|Фамилия/iu,
  has_label_given: /Ім'я|Імʼя|Ім’я|Имя|Given\s*Names?/iu,
  has_label_dob: /Дата\s*народження|Дата\s*рождения|Date\s*of\s*Birth/iu,
  has_label_sex: /Стать|Пол|Sex/iu,
  has_label_series_or_number: /Серія|Серия|Series|Номер|Number/iu,
  has_label_nationality: /Громадянство|Гражданство|Nationality/iu,
}

// Cheap "looks-like-MRZ" line detector: at least 5 fill chars '<' OR starts
// with P<UKR / P<XYZ. Not a parser — just a counter.
function looksLikeMrz(line: string): boolean {
  return /^P<[A-Z]{3}/.test(line) || (line.length >= 30 && (line.match(/</g) || []).length >= 5)
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const form = await req.formData()
    const file = form.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'missing_file' }, { status: 400 })
    }
    const buf = Buffer.from(await file.arrayBuffer())
    const mime = file.type || 'image/jpeg'

    const ocr = await googleVisionProvider.extractText({ imageBuffer: buf, mimeType: mime })
    if (isBlocked(ocr)) {
      return NextResponse.json({ blocked: true, blocked_reason: ocr.reason ?? 'unknown' }, { status: 200 })
    }
    const rawText = ocr.raw_text || ''
    const lines = (ocr.lines || []).map((l: OcrLine) => l.text || '')

    const labels_present: Record<string, boolean> = {}
    for (const [key, re] of Object.entries(LABEL_PATTERNS)) {
      labels_present[key] = re.test(rawText)
    }

    const mrzCandidates = lines.filter(looksLikeMrz)
    const mrz_first_line_has_p_uppercase = /\bP<[A-Z]{3}/.test(rawText)

    // Run both modules and see which fired.
    const document_id = `debug_${Date.now()}`
    const td3 = runPassportModule(ocr, { document_id })
    const booklet = runPassportBookletModule(ocr, { document_id })

    let module_run: 'td3' | 'booklet' | 'both' | 'none' = 'none'
    if (td3.matched && booklet.matched) module_run = 'both'
    else if (td3.matched) module_run = 'td3'
    else if (booklet.matched) module_run = 'booklet'

    // Use the module the production route.ts would actually use.
    const chosen = td3.matched ? td3 : booklet.matched ? booklet : td3
    const emitted_field_names = chosen.fields.map((f) => f.field)
    const strict_validator_would_drop = chosen.fields
      .filter((f) => {
        const value = f.normalized_value ?? f.raw_value ?? ''
        return value.length > 0 && !isStrictValidValue(f.field, value)
      })
      .map((f) => f.field)

    return NextResponse.json({
      raw_text_length: rawText.length,
      lines_count: lines.length,
      mrz_candidate_lines_count: mrzCandidates.length,
      mrz_first_line_has_p_uppercase,
      labels_present,
      module_run,
      module_match_reason: chosen.match_reason,
      emitted_field_names,
      emitted_field_count: emitted_field_names.length,
      strict_validator_would_drop,
      module_warnings: chosen.warnings.slice(0, 10),
    })
  } catch (e: unknown) {
    return NextResponse.json(
      { error: 'shape_debug_failed', detail: e instanceof Error ? e.message : 'unknown' },
      { status: 500 },
    )
  }
}
