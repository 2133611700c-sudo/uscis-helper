/**
 * POST /api/ocr/extract
 *
 * Document field extraction endpoint.
 *
 * Modes:
 *   1. "ocr"            — Vision API call (if DEEPSEEK_VISION_MODEL is set and image_base64 provided)
 *   2. "manual_review_required" — Returns field template for manual entry (default/fallback)
 *
 * Request body:
 *   session_id?    string   Optional wizard session ID for audit trail
 *   member_id?     string   Optional family member ID
 *   doc_type       string   Required: 'passport' | 'i94' | 'i797' | 'ead' | 'drivers_license' | 'birth_cert' | 'other'
 *   image_base64?  string   Optional: base64-encoded image (JPEG/PNG/WEBP)
 *
 * Response:
 *   ok:              boolean
 *   mode:            'ocr' | 'manual_review_required'
 *   extractedFields: Record<string, string | null>   — field name → extracted value or null
 *   confidence:      number (0–1) — 1.0 if manual review, AI-reported if OCR
 *   warnings:        string[]
 */

import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, getClientIP } from '@/lib/security/rate-limit'

// ─── Document field templates ─────────────────────────────────────────────────

type DocType = 'passport' | 'i94' | 'i797' | 'ead' | 'drivers_license' | 'birth_cert' | 'other'

const FIELD_TEMPLATES: Record<DocType, string[]> = {
  passport: [
    'surname',
    'given_names',
    'nationality',
    'date_of_birth',
    'place_of_birth',
    'passport_number',
    'issue_date',
    'expiry_date',
    'issuing_country',
    'mrz_line1',
    'mrz_line2',
  ],
  i94: [
    'i94_number',
    'last_name',
    'first_name',
    'birth_date',
    'country_of_citizenship',
    'admission_class',
    'admit_until_date',
  ],
  i797: [
    'receipt_number',
    'case_type',
    'priority_date',
    'notice_date',
    'applicant_name',
    'a_number',
    'valid_from',
    'valid_through',
    'class_of_admission',
  ],
  ead: [
    'card_number',
    'category',
    'last_name',
    'first_name',
    'date_of_birth',
    'country_of_birth',
    'valid_from',
    'card_expires',
    'a_number',
  ],
  drivers_license: [
    'last_name',
    'first_name',
    'address',
    'date_of_birth',
    'issue_date',
    'expiry_date',
    'license_number',
    'state',
  ],
  birth_cert: [
    'full_name',
    'date_of_birth',
    'place_of_birth',
    'father_name',
    'mother_name',
    'registration_number',
    'issue_date',
    'issuing_authority',
  ],
  other: [
    'document_type',
    'document_number',
    'full_name',
    'date_of_birth',
    'issue_date',
    'expiry_date',
  ],
}

const VALID_DOC_TYPES = new Set<string>(Object.keys(FIELD_TEMPLATES))

// ─── Helper: build empty field map ───────────────────────────────────────────

function emptyFields(docType: DocType): Record<string, string | null> {
  const fields = FIELD_TEMPLATES[docType] ?? FIELD_TEMPLATES.other
  return Object.fromEntries(fields.map((f) => [f, null]))
}

// ─── Helper: vision OCR via DeepSeek ─────────────────────────────────────────

async function attemptVisionOCR(
  imageBase64: string,
  docType: DocType
): Promise<{ ok: boolean; fields: Record<string, string | null>; confidence: number; rawContent?: string }> {
  const apiKey = process.env.DEEPSEEK_API_KEY
  const baseURL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com'
  const visionModel = process.env.DEEPSEEK_VISION_MODEL

  if (!apiKey || !visionModel) {
    return { ok: false, fields: emptyFields(docType), confidence: 0 }
  }

  const fieldList = FIELD_TEMPLATES[docType]?.join(', ') ?? 'document fields'
  const prompt = `You are a document OCR assistant. Extract the following fields from this ${docType.replace(/_/g, ' ')} document image: ${fieldList}.

Return ONLY a JSON object with these exact keys. Use null for any field you cannot read clearly. Do NOT guess or hallucinate values. Example: {"surname": "DOE", "given_names": "JOHN", "passport_number": null}`

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 30_000)

    const res = await fetch(`${baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: visionModel,
        max_tokens: 500,
        temperature: 0.1,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: { url: `data:image/jpeg;base64,${imageBase64}` },
              },
            ],
          },
        ],
      }),
      signal: controller.signal,
    })

    clearTimeout(timer)

    if (!res.ok) {
      return { ok: false, fields: emptyFields(docType), confidence: 0 }
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const content = data.choices?.[0]?.message?.content ?? ''

    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return { ok: false, fields: emptyFields(docType), confidence: 0, rawContent: content }
    }

    const extracted = JSON.parse(jsonMatch[0]) as Record<string, string | null>
    // Compute confidence: fraction of fields that are non-null
    const totalFields = Object.keys(emptyFields(docType)).length
    const filledFields = Object.values(extracted).filter((v) => v !== null && v !== '').length
    const confidence = totalFields > 0 ? filledFields / totalFields : 0

    return { ok: true, fields: extracted, confidence, rawContent: content }
  } catch {
    return { ok: false, fields: emptyFields(docType), confidence: 0 }
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // Rate limit: 10 OCR requests per minute per IP (more expensive than chat)
    const ip = getClientIP(req)
    const rl = await rateLimit(`ocr:${ip}`, 10, 60_000)
    if (!rl.allowed) {
      return NextResponse.json(
        { ok: false, error: 'Too many requests', mode: 'rate_limited' },
        {
          status: 429,
          headers: { 'Retry-After': String(Math.ceil((rl.resetAt.getTime() - Date.now()) / 1000)) },
        }
      )
    }

    const body = (await req.json()) as {
      session_id?: string
      member_id?: string
      doc_type?: string
      image_base64?: string
    }

    const { doc_type, image_base64 } = body

    // Validate doc_type
    if (!doc_type || typeof doc_type !== 'string') {
      return NextResponse.json(
        { ok: false, error: 'doc_type is required' },
        { status: 400 }
      )
    }

    const normalizedDocType = doc_type.toLowerCase().replace(/[-\s]/g, '_') as DocType
    if (!VALID_DOC_TYPES.has(normalizedDocType)) {
      return NextResponse.json(
        {
          ok: false,
          error: `Invalid doc_type. Valid values: ${[...VALID_DOC_TYPES].join(', ')}`,
        },
        { status: 400 }
      )
    }

    const warnings: string[] = []

    // Attempt OCR if image provided and vision model configured
    const hasImage = image_base64 && typeof image_base64 === 'string' && image_base64.length > 100
    const hasVisionModel = !!process.env.DEEPSEEK_VISION_MODEL

    if (hasImage && hasVisionModel) {
      const ocrResult = await attemptVisionOCR(image_base64!, normalizedDocType)

      if (ocrResult.ok) {
        return NextResponse.json({
          ok: true,
          mode: 'ocr',
          extractedFields: ocrResult.fields,
          confidence: ocrResult.confidence,
          warnings: ocrResult.confidence < 0.5
            ? ['Low confidence OCR result — please verify all fields manually']
            : warnings,
        })
      } else {
        warnings.push('Vision OCR failed or model unavailable — switching to manual review mode')
      }
    }

    // Manual review mode: return empty field template
    if (hasImage && !hasVisionModel) {
      warnings.push('Vision model (DEEPSEEK_VISION_MODEL) not configured — manual review required')
    }

    return NextResponse.json({
      ok: true,
      mode: 'manual_review_required',
      extractedFields: emptyFields(normalizedDocType),
      confidence: 1.0, // 1.0 = "user will fill manually, no AI guessing"
      warnings: warnings.length > 0 ? warnings : ['Please enter all fields manually'],
      fieldList: FIELD_TEMPLATES[normalizedDocType],
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[ocr/extract] error:', msg)
    return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 500 })
  }
}
