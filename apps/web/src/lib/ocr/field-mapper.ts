/**
 * DeepSeek Text field mapper — ID-based OCR evidence
 *
 * Sends the OCR token list (with stable IDs) to the DeepSeek Text API.
 * DeepSeek returns structured fields that reference OCR IDs — it NEVER
 * calculates or returns raw x/y coordinates.
 *
 * The backend then resolves those IDs to exact bboxes from the OcrResult.
 *
 * Required env var: DEEPSEEK_API_KEY
 * Do NOT use DeepSeek Vision — use deepseek-chat (text only).
 */
import type { OcrResult, OcrLine, OcrWord } from './types'
import type { DocumentType } from '@/lib/translation/types'

const DEEPSEEK_TEXT_URL = 'https://api.deepseek.com/chat/completions'
const FIELD_MAPPER_TIMEOUT_MS = 30_000
const MAX_TOKENS_INPUT = 6000   // characters; Vision result text is typically 200–800 chars

// ── Field mapper result ───────────────────────────────────────────────────────

export interface MappedField {
  field: string
  raw_value: string
  normalized_value: string
  ocr_ids: string[]             // IDs from OcrWord or OcrLine
  source_label_ids?: string[]   // IDs of the label token(s) if identifiable
  confidence: number            // 0.0–1.0
  review_required: boolean
  language_layer?: 'uk' | 'ru' | 'mixed' | 'unknown'
  source_label?: string         // human label as printed (for display)
  source_zone?: string          // rough zone description
}

export interface FieldMapperResult {
  ok: boolean
  fields: MappedField[]
  image_quality?: { overall: number; issues: string[] }
  warnings: string[]
  raw_response?: string   // for debugging only; never send to client
}

// ── Build OCR token prompt ────────────────────────────────────────────────────

/**
 * Formats OCR tokens as a compact ID-tagged list for the prompt.
 * Lines are prefixed [LINE l_NNNN], words within each line by [WORD w_NNNN].
 */
function buildOcrTokenPrompt(ocrResult: OcrResult): string {
  const parts: string[] = []
  let charCount = 0

  for (const line of ocrResult.lines) {
    if (charCount > MAX_TOKENS_INPUT) {
      parts.push('... [truncated]')
      break
    }
    const linePart = `[LINE ${line.id}] ${line.text}`
    parts.push(linePart)
    charCount += linePart.length

    for (const word of line.words) {
      const wordPart = `  [WORD ${word.id}] ${word.text}`
      parts.push(wordPart)
      charCount += wordPart.length
    }
  }

  return parts.join('\n')
}

// ── Field definitions per doc type ───────────────────────────────────────────

// All 11 critical fields for internal passport:
// document_type, series, number, surname, given_names, patronymic,
// date_of_birth, place_of_birth, sex, issued_by, date_of_issue
const UA_INTERNAL_FIELDS = [
  'document_type',    // ПАСПОРТ / PASSPORT
  'series',           // серія (АА, ВВ, etc.)
  'number',           // 6-digit number
  'surname',          // ПРІЗВИЩЕ
  'given_names',      // ІМ'Я (first name)
  'patronymic',       // ПО БАТЬКОВІ / PATRONYMIC
  'date_of_birth',    // ДАТА НАРОДЖЕННЯ
  'place_of_birth',   // МІСЦЕ НАРОДЖЕННЯ
  'sex',              // СТАТЬ / SEX
  'issued_by',        // ОРГАН ВИДАЧІ / ISSUED BY
  'date_of_issue',    // ДАТА ВИДАЧІ / DATE OF ISSUE
  // extended fields (not critical but extract if present)
  'nationality',      // ГРОМАДЯНСТВО
  'date_of_expiry',   // ДІЙСНИЙ ДО
  'record_number',    // РНОКПП / tax number
]

const FIELD_TARGETS: Record<string, string[]> = {
  ua_passport_booklet:   UA_INTERNAL_FIELDS,
  ua_passport_internal:  UA_INTERNAL_FIELDS,
  ua_passport_id_card:   ['surname','given_names','date_of_birth','place_of_birth','sex','number','issued_by','date_of_issue','date_of_expiry','record_number'],
  ua_birth_certificate:  ['full_name','date_of_birth','place_of_birth','father_name','mother_name','registration_number','issue_date','issuing_authority'],
  ua_marriage_certificate: ['bride_name','groom_name','marriage_date','marriage_place','registration_number','issue_date','issuing_authority'],
}

function getFieldTargets(docType: DocumentType): string[] {
  return FIELD_TARGETS[docType] ?? ['full_name','document_number','date_of_birth','issue_date','issuing_authority']
}

// ── Main mapper function ──────────────────────────────────────────────────────

export async function mapFieldsWithDeepSeek(params: {
  ocrResult: OcrResult
  docType: DocumentType
  glossaryJson: string
}): Promise<FieldMapperResult> {
  const { ocrResult, docType, glossaryJson } = params

  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) {
    return { ok: false, fields: [], warnings: ['DEEPSEEK_API_KEY not configured'], }
  }

  if (ocrResult.words.length === 0) {
    return { ok: false, fields: [], warnings: ['OCR returned no words — cannot map fields'] }
  }

  const tokenPrompt = buildOcrTokenPrompt(ocrResult)
  const fieldTargets = getFieldTargets(docType)

  const systemPrompt = `You are a Ukrainian government document field extractor for USCIS submissions.
You receive OCR tokens with stable IDs extracted from a "${docType}" document.
Each token is prefixed [LINE l_NNNN] or [WORD w_NNNN].

Your task: identify which OCR tokens correspond to each document field.
Return ONLY a JSON object — no markdown, no explanation.
NEVER invent coordinates. NEVER calculate positions. Only return IDs from the provided token list.
For each field, list the IDs of the word tokens that make up the field VALUE (not the label).

Field mapping rules for Ukrainian internal passport (ua_passport_internal / ua_passport_booklet):
- document_type: the word ПАСПОРТ or PASSPORT (normalized: "Ukrainian Internal Passport")
- series: 2-letter Cyrillic series (e.g. АА, ВВ) — from document header or серія field. Normalized to Latin transliteration.
- number: 6-digit number following the series
- surname: value after label ПРІЗВИЩЕ (one or more words)
- given_names: value after label ІМ'Я or ІМЯ (first name only, not patronymic)
- patronymic: value after label ПО БАТЬКОВІ or PATRONYMIC (middle/father's name in Ukrainian tradition)
- date_of_birth: value after ДАТА НАРОДЖЕННЯ — format DD місяць YYYY; normalize month to English (лютого=February, жовтня=October, etc.)
- place_of_birth: value after МІСЦЕ НАРОДЖЕННЯ (city, oblast)
- sex: value after СТАТЬ (Ч→Male, Ж→Female; also M→Male, F→Female)
- issued_by: value after ОРГАН ВИДАЧІ or ВИДАНИЙ (issuing authority name, may be multiple words)
- date_of_issue: value after ДАТА ВИДАЧІ — same date format rules as date_of_birth
- nationality: value after ГРОМАДЯНСТВО (normalized: "Ukrainian")
- date_of_expiry: value after ДІЙСНИЙ ДО
- record_number: 10-digit РНОКПП / taxpayer number

IMPORTANT: Extract ALL found fields. Do not skip any field that is visible in the OCR. If a field label is present but value is unreadable, still include the field with review_required: true.`

  const userPrompt = `Document type: ${docType}

Approved glossary (use for normalized English values):
${glossaryJson.slice(0, 2000)}

OCR tokens:
${tokenPrompt}

Extract these fields: ${fieldTargets.join(', ')}

For each found field return an object. For multi-word values, list all word IDs.
Return format:
{
  "fields": [
    {
      "field": "surname",
      "raw_value": "Куропятник",
      "normalized_value": "Kuropiatnyk",
      "ocr_ids": ["w_0012"],
      "source_label": "ПРІЗВИЩЕ",
      "source_zone": "top_personal_data",
      "confidence": 0.96,
      "review_required": false,
      "language_layer": "uk"
    },
    {
      "field": "date_of_issue",
      "raw_value": "19 лютого 2003",
      "normalized_value": "19 February 2003",
      "ocr_ids": ["w_0020", "w_0021", "w_0022"],
      "source_label": "ДАТА ВИДАЧІ",
      "source_zone": "issuance_block",
      "confidence": 0.94,
      "review_required": false,
      "language_layer": "uk"
    }
  ],
  "image_quality": { "overall": 0.9, "issues": [] }
}`

  try {
    const res = await fetch(DEEPSEEK_TEXT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.DEEPSEEK_MODEL ?? 'deepseek-chat',
        max_tokens: 3000,
        temperature: 0.05,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userPrompt },
        ],
      }),
      signal: AbortSignal.timeout(FIELD_MAPPER_TIMEOUT_MS),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      console.error(`[field-mapper] DeepSeek HTTP ${res.status}:`, errText.slice(0, 200))
      return { ok: false, fields: [], warnings: [`DeepSeek HTTP ${res.status}`] }
    }

    const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> }
    const content = data.choices?.[0]?.message?.content ?? ''
    const clean = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()

    let parsed: { fields?: unknown[]; image_quality?: { overall: number; issues: string[] } }
    try {
      parsed = JSON.parse(clean)
    } catch {
      const match = clean.match(/\{[\s\S]*\}/)
      if (!match) return { ok: false, fields: [], warnings: ['DeepSeek returned invalid JSON'], raw_response: clean.slice(0, 500) }
      parsed = JSON.parse(match[0])
    }

    const rawFields = (parsed.fields ?? []) as Array<Record<string, unknown>>

    const fields: MappedField[] = rawFields
      .filter(f => typeof f.field === 'string' && f.field)
      .map(f => {
        const conf = typeof f.confidence === 'number' ? Math.min(1, Math.max(0, f.confidence)) : 0.5
        const ocrIds = Array.isArray(f.ocr_ids) ? f.ocr_ids.filter(id => typeof id === 'string') : []
        return {
          field:            String(f.field),
          raw_value:        String(f.raw_value ?? ''),
          normalized_value: String(f.normalized_value ?? ''),
          ocr_ids:          ocrIds as string[],
          source_label_ids: Array.isArray(f.source_label_ids) ? f.source_label_ids as string[] : undefined,
          confidence:       conf,
          review_required:  conf < 0.70 || Boolean(f.review_required),
          language_layer:   (['uk','ru','mixed','unknown'].includes(String(f.language_layer)) ? f.language_layer : 'uk') as MappedField['language_layer'],
          source_label:     typeof f.source_label === 'string' ? f.source_label : undefined,
          source_zone:      typeof f.source_zone === 'string' ? f.source_zone : undefined,
        }
      })

    return {
      ok: fields.length > 0,
      fields,
      image_quality: parsed.image_quality,
      warnings: [],
    }

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[field-mapper] call failed:', msg)
    return { ok: false, fields: [], warnings: [`Field mapper error: ${msg}`] }
  }
}
