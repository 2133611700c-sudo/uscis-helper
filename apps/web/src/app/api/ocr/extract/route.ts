/**
 * POST /api/ocr/extract
 *
 * Document field extraction endpoint.
 *
 * Architecture (priority order):
 *   1. "text_parse"  — raw_text provided (Tesseract.js client-side OCR) →
 *                      DeepSeek-V3 text model parses fields (DEFAULT, ~$0.001/doc)
 *   2. "ocr"         — vision API call (ENABLE_OPENAI_VISION=true + image_base64)
 *   3. "manual_review_required" — fallback, returns empty field template
 *
 * Request body (JSON):
 *   session_id?    string   Optional wizard session ID
 *   member_id?     string   Optional family member ID
 *   doc_type       string   'passport' | 'i94' | 'i797' | 'ead' | 'drivers_license' | 'birth_cert' | 'other'
 *   raw_text?      string   Raw OCR text from Tesseract.js (preferred path)
 *   image_base64?  string   Base64 image — used ONLY if ENABLE_OPENAI_VISION=true
 *
 * Response:
 *   ok:              boolean
 *   mode:            'text_parse' | 'ocr' | 'manual_review_required'
 *   provider:        'deepseek' | 'openai' | null
 *   extractedFields: Record<string, string | null>
 *   confidence:      number (0–1)
 *   warnings:        string[]
 */

import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, getClientIP } from '@/lib/security/rate-limit'
import { isOcrFieldSafetyEnabled } from '@/lib/documentSafety/applyOcrFieldSafety'

// ─── Document field templates ─────────────────────────────────────────────────

type DocType =
  | 'passport'
  | 'i94'
  | 'i797'
  | 'ead'
  | 'drivers_license'
  | 'birth_cert'
  | 'other'

const FIELD_TEMPLATES: Record<DocType, string[]> = {
  passport: [
    'surname', 'given_names', 'nationality', 'date_of_birth', 'place_of_birth',
    'passport_number', 'issue_date', 'expiry_date', 'issuing_country',
    'mrz_line1', 'mrz_line2',
  ],
  i94: [
    'i94_number', 'last_name', 'first_name', 'birth_date',
    'country_of_citizenship', 'admission_class', 'admit_until_date',
  ],
  i797: [
    'receipt_number', 'case_type', 'priority_date', 'notice_date',
    'applicant_name', 'a_number', 'valid_from', 'valid_through',
    'class_of_admission',
  ],
  ead: [
    'card_number', 'category', 'last_name', 'first_name', 'date_of_birth',
    'country_of_birth', 'valid_from', 'card_expires', 'a_number',
  ],
  drivers_license: [
    'last_name', 'first_name', 'address', 'date_of_birth', 'issue_date',
    'expiry_date', 'license_number', 'state',
  ],
  birth_cert: [
    'full_name', 'date_of_birth', 'place_of_birth', 'father_name',
    'mother_name', 'registration_number', 'issue_date', 'issuing_authority',
  ],
  other: [
    'document_type', 'document_number', 'full_name',
    'date_of_birth', 'issue_date', 'expiry_date',
  ],
}

const VALID_DOC_TYPES = new Set<string>(Object.keys(FIELD_TEMPLATES))

function emptyFields(docType: DocType): Record<string, string | null> {
  const fields = FIELD_TEMPLATES[docType] ?? FIELD_TEMPLATES.other
  return Object.fromEntries(fields.map((f) => [f, null]))
}

// ─── Shared: merge extracted fields with template ─────────────────────────────

function mergeExtracted(
  extracted: Record<string, unknown>,
  template: Record<string, string | null>
): { fields: Record<string, string | null>; confidence: number } {
  const merged: Record<string, string | null> = { ...template }
  for (const key of Object.keys(template)) {
    const v = extracted[key]
    if (v !== undefined && v !== '') {
      merged[key] = typeof v === 'string' ? v : null
    }
  }
  const total = Object.keys(template).length
  const filled = Object.values(merged).filter((v) => v !== null && v !== '').length
  return { fields: merged, confidence: total > 0 ? filled / total : 0 }
}

// ─── Mode 1 (DEFAULT): DeepSeek text parser from Tesseract raw text ───────────

async function parseTextWithDeepSeek(
  rawText: string,
  docType: DocType
): Promise<{ ok: boolean; fields: Record<string, string | null>; confidence: number }> {
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) {
    return { ok: false, fields: emptyFields(docType), confidence: 0 }
  }

  const baseURL = process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com'
  const model = process.env.DEEPSEEK_MODEL ?? 'deepseek-chat'
  const fieldList = (FIELD_TEMPLATES[docType] ?? FIELD_TEMPLATES.other).join(', ')

  const systemPrompt = `You are a government document parser.
You receive raw OCR text extracted from a ${docType.replace(/_/g, ' ')} document.
Extract EXACTLY these fields: ${fieldList}.
Rules:
- Return ONLY valid JSON, no markdown, no explanation
- Use null for any field you cannot find in the text
- Never guess or hallucinate — accuracy is critical for USCIS submissions
- Dates format: MM/DD/YYYY when possible
- Names: as printed (ALL CAPS if so printed)
- For MRZ lines: copy exactly as found, character-perfect`

  const userPrompt = `OCR text:\n\`\`\`\n${rawText.slice(0, 3000)}\n\`\`\`\n\nExtract the fields as JSON.`

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 20_000)

    const res = await fetch(`${baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: 500,
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
      const err = await res.text().catch(() => '')
      console.error(`[ocr/deepseek] error ${res.status}:`, err.slice(0, 200))
      return { ok: false, fields: emptyFields(docType), confidence: 0 }
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const content = data.choices?.[0]?.message?.content ?? ''

    // Parse JSON from content
    let extracted: Record<string, unknown>
    try {
      // Strip markdown fences if present
      const clean = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
      extracted = JSON.parse(clean) as Record<string, unknown>
    } catch {
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        console.error('[ocr/deepseek] no JSON in response:', content.slice(0, 200))
        return { ok: false, fields: emptyFields(docType), confidence: 0 }
      }
      extracted = JSON.parse(jsonMatch[0]) as Record<string, unknown>
    }

    const { fields, confidence } = mergeExtracted(extracted, emptyFields(docType))
    return { ok: true, fields, confidence }
  } catch (err) {
    console.error('[ocr/deepseek] parse call failed:', err)
    return { ok: false, fields: emptyFields(docType), confidence: 0 }
  }
}

// ─── Mode 2 (EXPLICIT FLAG): OpenAI vision — only if ENABLE_OPENAI_VISION=true ─

async function attemptOpenAIVision(
  imageBase64: string,
  docType: DocType
): Promise<{ ok: boolean; fields: Record<string, string | null>; confidence: number }> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return { ok: false, fields: emptyFields(docType), confidence: 0 }

  const model = process.env.OPENAI_VISION_MODEL ?? 'gpt-4o-mini'
  const fieldList = (FIELD_TEMPLATES[docType] ?? FIELD_TEMPLATES.other).join(', ')
  const prompt = `Extract these fields from this ${docType.replace(/_/g, ' ')} image: ${fieldList}.
Return ONLY valid JSON. Use null for unreadable fields. Never hallucinate.
Dates: MM/DD/YYYY. Names: as printed.`

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 35_000)

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: 600,
        temperature: 0.05,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: { url: `data:image/jpeg;base64,${imageBase64}`, detail: 'high' },
              },
              { type: 'text', text: prompt },
            ],
          },
        ],
      }),
      signal: controller.signal,
    })

    clearTimeout(timer)

    if (!res.ok) {
      const err = await res.text().catch(() => '')
      console.error(`[ocr/openai] error ${res.status}:`, err.slice(0, 200))
      return { ok: false, fields: emptyFields(docType), confidence: 0 }
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const content = data.choices?.[0]?.message?.content ?? ''

    let extracted: Record<string, unknown>
    try {
      extracted = JSON.parse(content) as Record<string, unknown>
    } catch {
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (!jsonMatch) return { ok: false, fields: emptyFields(docType), confidence: 0 }
      extracted = JSON.parse(jsonMatch[0]) as Record<string, unknown>
    }

    const { fields, confidence } = mergeExtracted(extracted, emptyFields(docType))
    return { ok: true, fields, confidence }
  } catch (err) {
    console.error('[ocr/openai] vision call failed:', err)
    return { ok: false, fields: emptyFields(docType), confidence: 0 }
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // Rate limit: 15 OCR requests / minute per IP
    const ip = getClientIP(req)
    const rl = await rateLimit(`ocr:${ip}`, 15, 60_000)
    if (!rl.allowed) {
      return NextResponse.json(
        { ok: false, error: 'Too many requests', mode: 'rate_limited' },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((rl.resetAt.getTime() - Date.now()) / 1000)),
          },
        }
      )
    }

    const body = (await req.json()) as {
      session_id?: string
      member_id?: string
      doc_type?: string
      raw_text?: string
      image_base64?: string
    }

    const { doc_type, raw_text, image_base64 } = body

    if (!doc_type || typeof doc_type !== 'string') {
      return NextResponse.json({ ok: false, error: 'doc_type is required' }, { status: 400 })
    }

    const normalizedDocType = doc_type.toLowerCase().replace(/[-\s]/g, '_') as DocType
    if (!VALID_DOC_TYPES.has(normalizedDocType)) {
      return NextResponse.json(
        { ok: false, error: `Invalid doc_type. Valid: ${[...VALID_DOC_TYPES].join(', ')}` },
        { status: 400 }
      )
    }

    const warnings: string[] = []
    const hasRawText = typeof raw_text === 'string' && raw_text.trim().length > 20
    const hasImage = typeof image_base64 === 'string' && image_base64.length > 100
    const openAIVisionEnabled = process.env.ENABLE_OPENAI_VISION === 'true'

    // ── C3: legacy reader = UNTRUSTED for final critical values (OCR_FIELD_SAFETY_ENABLED, default OFF) ──
    // OFF ⇒ {} ⇒ byte-identical. ON ⇒ annotate the response so consumers treat critical identity/document
    // fields from this legacy (DeepSeek/OpenAI, ungated) path as candidate-only, never auto-final.
    const legacySafety = isOcrFieldSafetyEnabled()
      ? { ocr_field_safety: { legacy_reader: true, critical_fields_candidate_only: true,
          policy: 'legacy reader — critical identity/document values are candidates; confirm before final use' } }
      : {}

    // ── Priority 1: DeepSeek text parse (Tesseract.js path) ──────────────────
    if (hasRawText) {
      const result = await parseTextWithDeepSeek(raw_text!, normalizedDocType)
      if (result.ok) {
        return NextResponse.json({
          ok: true,
          mode: 'text_parse',
          provider: 'deepseek',
          extractedFields: result.fields,
          confidence: result.confidence,
          ...legacySafety,
          warnings:
            result.confidence < 0.4
              ? ['Low confidence — OCR text may be unclear, please verify fields']
              : [],
        })
      }
      warnings.push('DeepSeek text parse failed — falling back')
    }

    // ── Priority 2: OpenAI vision (explicit feature flag only) ───────────────
    if (hasImage && openAIVisionEnabled) {
      const result = await attemptOpenAIVision(image_base64!, normalizedDocType)
      if (result.ok) {
        return NextResponse.json({
          ok: true,
          mode: 'ocr',
          provider: 'openai',
          extractedFields: result.fields,
          confidence: result.confidence,
          ...legacySafety,
          warnings:
            result.confidence < 0.5
              ? ['Low confidence OCR — please verify all fields']
              : warnings,
        })
      }
      warnings.push('OpenAI vision OCR failed — switching to manual review')
    }

    // ── Fallback: manual review ───────────────────────────────────────────────
    if (hasImage && !openAIVisionEnabled && !hasRawText) {
      warnings.push(
        'Image received but vision OCR is disabled. ' +
        'Use Tesseract.js in the browser to extract text first, ' +
        'then send raw_text. ' +
        'To enable vision: set ENABLE_OPENAI_VISION=true in Vercel env vars.'
      )
    }

    return NextResponse.json({
      ok: true,
      mode: 'manual_review_required',
      provider: null,
      extractedFields: emptyFields(normalizedDocType),
      confidence: 1.0,
      warnings:
        warnings.length > 0
          ? warnings
          : ['Please enter all fields manually'],
      fieldList: FIELD_TEMPLATES[normalizedDocType],
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[ocr/extract] error:', msg)
    return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 500 })
  }
}
