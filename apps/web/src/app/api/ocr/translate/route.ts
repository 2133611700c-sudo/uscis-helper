/**
 * POST /api/ocr/translate
 *
 * Translates OCR-extracted document field values to English.
 *
 * Context: After /api/ocr/extract returns fields in the source language
 * (Cyrillic for Russian/Ukrainian documents), this endpoint produces
 * English equivalents suitable for USCIS translation submission.
 *
 * Translation rules applied by the LLM:
 *   - NAME fields  → ICAO Doc-9303 transliteration (Cyrillic → Latin)
 *   - PLACE/COUNTRY fields → English translation
 *   - DATE fields  → US date format (MM/DD/YYYY)
 *   - ID/NUMBER fields → pass through unchanged
 *   - MRZ fields   → pass through unchanged
 *
 * Request body (JSON):
 *   fields       Record<string, string|null>  Fields from /api/ocr/extract
 *   doc_type     string                       Same doc_type sent to extract
 *   source_lang? string                       'ru' | 'uk' | 'uk-soviet' (default: 'ru')
 *
 * Response:
 *   ok                boolean
 *   translatedFields  Record<string, string|null>  English values
 *   confidence        number   0–1 (fraction of non-null source fields successfully translated)
 *   fallback_needed   boolean  true when confidence < 0.5 — trigger manual-review flow
 *   warnings          string[] Field-level warnings
 *   source_fields     Record<string, string|null>  Echo of input (for display diff)
 */

import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, getClientIP } from '@/lib/security/rate-limit'

// ─── Field classification ─────────────────────────────────────────────────────

/**
 * Fields that must be transliterated (ICAO Doc-9303), not translated.
 * Names on USCIS forms must match the document character-for-character
 * transliterated, not semantically translated.
 */
const NAME_FIELDS = new Set([
  'surname',
  'given_names',
  'full_name',
  'last_name',
  'first_name',
  'father_name',
  'mother_name',
  'applicant_name',
])

/**
 * Fields containing geographic names or legal terms requiring translation.
 */
const TRANSLATE_FIELDS = new Set([
  'nationality',
  'place_of_birth',
  'issuing_country',
  'country_of_citizenship',
  'country_of_birth',
  'address',
  'state',
  'issuing_authority',
  'admission_class',
  'class_of_admission',
  'case_type',
  'document_type',
])

/** Date strings — reformat to MM/DD/YYYY if not already. */
const DATE_FIELDS = new Set([
  'date_of_birth',
  'birth_date',
  'issue_date',
  'expiry_date',
  'valid_from',
  'valid_through',
  'card_expires',
  'admit_until_date',
  'notice_date',
  'priority_date',
])

/** Pass through unchanged (IDs, numbers, MRZ). */
const PASSTHROUGH_FIELDS = new Set([
  'passport_number',
  'i94_number',
  'receipt_number',
  'card_number',
  'a_number',
  'license_number',
  'registration_number',
  'mrz_line1',
  'mrz_line2',
])

// ─── Helpers ──────────────────────────────────────────────────────────────────

function classifyField(
  key: string
): 'name' | 'translate' | 'date' | 'passthrough' | 'unknown' {
  if (PASSTHROUGH_FIELDS.has(key)) return 'passthrough'
  if (NAME_FIELDS.has(key)) return 'name'
  if (DATE_FIELDS.has(key)) return 'date'
  if (TRANSLATE_FIELDS.has(key)) return 'translate'
  return 'unknown'
}

function hasNonNullFields(fields: Record<string, string | null>): boolean {
  return Object.values(fields).some((v) => v !== null && v !== undefined && v.trim() !== '')
}

// ─── LLM translation call ─────────────────────────────────────────────────────

interface TranslateResult {
  translatedFields: Record<string, string | null>
  confidence: number
  fallback_needed: boolean
  warnings: string[]
}

async function translateWithLLM(
  fields: Record<string, string | null>,
  docType: string,
  sourceLang: string
): Promise<TranslateResult> {
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) {
    console.error('[ocr/translate] DEEPSEEK_API_KEY not configured')
    return {
      translatedFields: Object.fromEntries(Object.keys(fields).map((k) => [k, null])),
      confidence: 0,
      fallback_needed: true,
      warnings: ['Translation service not configured. Manual review required.'],
    }
  }

  const baseURL = process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com'
  const model = process.env.DEEPSEEK_MODEL ?? 'deepseek-chat'

  const isUkrainian = sourceLang === 'uk' || sourceLang === 'uk-soviet'
  const langLabel = isUkrainian ? 'Ukrainian' : 'Russian'

  // Build per-field rule instructions for the prompt
  const fieldInstructions = Object.entries(fields)
    .filter(([, v]) => v !== null && v !== undefined && v.trim() !== '')
    .map(([key, value]) => {
      const type = classifyField(key)
      let rule: string
      switch (type) {
        case 'name':
          rule = isUkrainian
            ? 'Transliterate using Ukrainian KMU 2010 standard (Я→IA at start/after vowel else YA; Є→YE; Ю→YU; Г→H; Х→KH; Ц→TS; Ч→CH; Ш→SH; Щ→SHCH; ЬО→IO). Output ALL CAPS.'
            : 'Transliterate using ICAO Doc-9303 Russian standard (Я→IA; Ю→IU; Х→KH; Ж→ZH; Ш→SH; Щ→SHCH; Ч→CH; Ц→TS; Й→I; Ь→omit). Output ALL CAPS.'
          break
        case 'date':
          rule =
            'Reformat to MM/DD/YYYY. Input may use DD.MM.YYYY or YYYY-MM-DD. If already MM/DD/YYYY keep as-is.'
          break
        case 'passthrough':
          rule = 'Copy exactly as provided — no changes.'
          break
        case 'translate':
          rule =
            'Translate to English. Use recognized official English names (e.g. "Ukraine", "Ministry of Internal Affairs of Ukraine"). Capitalize properly.'
          break
        default:
          rule =
            'If a proper name, transliterate (ICAO). If a common word/phrase, translate. If unclear, use null.'
      }
      return `  - "${key}" (value: "${value}") → Rule: ${rule}`
    })
    .join('\n')

  const systemPrompt = `You are a USCIS document translation specialist.
You convert ${langLabel} government document fields to English for USCIS submissions.
Accuracy is critical. Never hallucinate or guess. Return ONLY valid JSON, no markdown fences, no commentary.
Use null for any field you cannot confidently convert.`

  const userPrompt = `Document type: ${docType}
Source language: ${langLabel}

Apply these rules to each field:
${fieldInstructions}

Return a JSON object with ALL of the following keys. For fields listed above apply the rule; for all other keys use null:
${JSON.stringify(
    Object.fromEntries(Object.keys(fields).map((k) => [k, null])),
    null,
    2
  )}`

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 25_000)

    const res = await fetch(`${baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: 800,
        temperature: 0.05,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
      signal: controller.signal,
    })

    clearTimeout(timer)

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      console.error(`[ocr/translate] API error ${res.status}:`, errText.slice(0, 200))
      return {
        translatedFields: Object.fromEntries(Object.keys(fields).map((k) => [k, null])),
        confidence: 0,
        fallback_needed: true,
        warnings: [`Translation API error (HTTP ${res.status}). Manual review required.`],
      }
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const content = data.choices?.[0]?.message?.content ?? ''

    // Parse JSON — strip markdown fences if present
    let translated: Record<string, unknown>
    try {
      const clean = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
      translated = JSON.parse(clean) as Record<string, unknown>
    } catch {
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        console.error('[ocr/translate] no JSON in response:', content.slice(0, 300))
        return {
          translatedFields: Object.fromEntries(Object.keys(fields).map((k) => [k, null])),
          confidence: 0,
          fallback_needed: true,
          warnings: ['Could not parse translation response. Manual review required.'],
        }
      }
      translated = JSON.parse(jsonMatch[0]) as Record<string, unknown>
    }

    // Build typed output — coerce to string | null per field
    const translatedFields: Record<string, string | null> = {}
    const warnings: string[] = []

    for (const key of Object.keys(fields)) {
      const raw = translated[key]
      if (raw === null || raw === undefined || raw === '') {
        translatedFields[key] = null
      } else if (typeof raw === 'string') {
        translatedFields[key] = raw.trim() || null
      } else {
        translatedFields[key] = String(raw).trim() || null
        warnings.push(`"${key}": unexpected type ${typeof raw} in LLM response`)
      }
    }

    // Confidence = fraction of non-null source fields that got a non-null translation
    const sourceNonNull = Object.values(fields).filter(
      (v) => v !== null && v !== undefined && v.trim() !== ''
    ).length
    const translatedNonNull = Object.entries(translatedFields).filter(
      ([k, v]) => {
        const src = fields[k]
        return src !== null && src !== undefined && src.trim() !== '' && v !== null
      }
    ).length

    const confidence = sourceNonNull > 0 ? Math.min(1, translatedNonNull / sourceNonNull) : 0

    return {
      translatedFields,
      confidence,
      fallback_needed: confidence < 0.5,
      warnings,
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[ocr/translate] call failed:', msg)
    return {
      translatedFields: Object.fromEntries(Object.keys(fields).map((k) => [k, null])),
      confidence: 0,
      fallback_needed: true,
      warnings: [`Translation error: ${msg}. Manual review required.`],
    }
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const ip = getClientIP(req)
  const rl = await rateLimit(`ocr-translate:${ip}`, 20, 60_000)
  if (!rl.allowed) {
    return NextResponse.json(
      { ok: false, error: 'Too many requests. Please try again in a minute.' },
      { status: 429 }
    )
  }

  try {
    const body = (await req.json()) as {
      fields?: unknown
      doc_type?: unknown
      source_lang?: unknown
    }

    if (
      !body.fields ||
      typeof body.fields !== 'object' ||
      Array.isArray(body.fields)
    ) {
      return NextResponse.json(
        { ok: false, error: '"fields" must be a non-null object' },
        { status: 400 }
      )
    }

    const fields = body.fields as Record<string, string | null>

    if (typeof body.doc_type !== 'string' || !body.doc_type) {
      return NextResponse.json(
        { ok: false, error: '"doc_type" string is required' },
        { status: 400 }
      )
    }

    const doc_type = body.doc_type
    const validLangs = new Set(['ru', 'uk', 'uk-soviet'])
    const source_lang =
      typeof body.source_lang === 'string' && validLangs.has(body.source_lang)
        ? body.source_lang
        : 'ru'

    // Fast path — nothing to translate
    if (!hasNonNullFields(fields)) {
      return NextResponse.json({
        ok: true,
        translatedFields: { ...fields },
        confidence: 0,
        fallback_needed: true,
        warnings: ['All source fields are null — nothing to translate.'],
        source_fields: fields,
      })
    }

    const result = await translateWithLLM(fields, doc_type, source_lang)

    return NextResponse.json({
      ok: true,
      translatedFields: result.translatedFields,
      confidence: result.confidence,
      fallback_needed: result.fallback_needed,
      warnings: result.warnings,
      source_fields: fields,
    })
  } catch (e: unknown) {
    console.error('[ocr/translate] handler error:', String(e))
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}
