/**
 * POST /api/translation/[sessionId]/ocr-from-storage
 *
 * Real OCR adapter — production path that does NOT require manually typed raw_text.
 *
 * Pipeline:
 *   1. Load latest uploaded document from translation_documents table
 *   2. Download image bytes from Supabase Storage
 *   3. Convert to base64
 *   4. Send to DeepSeek Vision (deepseek-chat with image_url) OR
 *      fall back to Tesseract.js server-side OCR → DeepSeek text parse
 *   5. Post-process fields (glossary, transliteration, date normalization)
 *   6. Persist extracted_fields, update session status → extracted
 *   7. Return fields + image_quality
 *
 * Body (optional): {
 *   doc_type?: DocumentType    — defaults to session.doc_type or 'ua_passport_booklet'
 *   document_id?: string       — specific doc ID; defaults to latest for session
 *   controlling_spelling?: Record<string,string>
 * }
 *
 * Hard rule: This is the ONLY server path that should run OCR in production.
 * The manual raw_text path (/api/translation/extract) is for testing only.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { loadGlossary, lookupTerm } from '@/lib/translation/glossary/glossaryLoader'
import { transliterateName } from '@/lib/translation/glossary/nominativeCaseRestorer'
import { normalizeDateUkrainian } from '@/lib/translation/numericAccuracy/dateFieldLockValidator'
import { persistExtractedFields, writeAuditLog } from '@/lib/translation/packetStateManager'
import { DocumentType, ExtractedField } from '@/lib/translation/types'

export const dynamic = 'force-dynamic'
// Large images may take time — give DeepSeek up to 60s
export const maxDuration = 60

// ── Ukrainian passport booklet field template ────────────────────────────────
const UA_PASSPORT_BOOKLET_FIELDS = [
  'surname', 'given_names', 'nationality', 'date_of_birth', 'place_of_birth',
  'sex', 'series', 'number', 'issued_by', 'date_of_issue', 'date_of_expiry',
  'record_number', 'tax_number',
]

function getFieldTemplate(docType: DocumentType): string[] {
  switch (docType) {
    case 'ua_passport_booklet':
    case 'ua_passport_internal':
      return UA_PASSPORT_BOOKLET_FIELDS
    case 'ua_passport_id_card':
      return ['surname','given_names','date_of_birth','place_of_birth','sex','number','issued_by','date_of_issue','date_of_expiry','record_number']
    case 'ua_birth_certificate':
      return ['full_name','date_of_birth','place_of_birth','father_name','mother_name','registration_number','issue_date','issuing_authority']
    case 'ua_marriage_certificate':
      return ['bride_name','groom_name','marriage_date','marriage_place','registration_number','issue_date','issuing_authority']
    default:
      return ['full_name','document_number','date_of_birth','issue_date','issuing_authority']
  }
}

// ── DeepSeek Vision extraction ───────────────────────────────────────────────
async function extractWithDeepSeekVision(params: {
  imageBase64: string
  mimeType: string
  docType: DocumentType
  glossaryJson: string
  fieldTemplate: string[]
}): Promise<{ ok: boolean; fields: ExtractedField[]; imageQuality?: { overall: number; issues: string[] } }> {
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) return { ok: false, fields: [] }

  const fieldList = params.fieldTemplate.join(', ')
  const systemPrompt = `You are a Ukrainian government document translator and field extractor for USCIS submissions.
Extract ALL visible fields from the provided document image.
Use ONLY the approved glossary terms for translation.
Return ONLY valid JSON — no markdown, no explanation.`

  const userPrompt = `Document type: ${params.docType}

Approved glossary:
${params.glossaryJson}

Extract these fields: ${fieldList}

For each field found, return:
{
  "field": "snake_case_field_name",
  "source_label": "exact label as printed in Ukrainian",
  "source_zone": "zone_description",
  "bbox": [x0, y0, x1, y1],
  "raw_value": "verbatim from document",
  "normalized_value": "English normalized value",
  "language_layer": "uk",
  "confidence": 0.95,
  "review_required": false
}

Return: { "fields": [...], "image_quality": { "overall": 0.9, "issues": [] } }`

  try {
    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: process.env.DEEPSEEK_MODEL ?? 'deepseek-chat',
        max_tokens: 2500,
        temperature: 0.05,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: `data:${params.mimeType};base64,${params.imageBase64}`,
                  detail: 'high',
                },
              },
              { type: 'text', text: userPrompt },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(55_000),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      console.error(`[ocr-from-storage] DeepSeek vision error ${res.status}:`, errText.slice(0, 300))
      return { ok: false, fields: [] }
    }

    const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> }
    const content = data.choices?.[0]?.message?.content ?? ''
    const clean = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()

    let parsed: { fields?: unknown[]; image_quality?: { overall: number; issues: string[] } }
    try {
      parsed = JSON.parse(clean)
    } catch {
      const match = clean.match(/\{[\s\S]*\}/)
      if (!match) return { ok: false, fields: [] }
      parsed = JSON.parse(match[0])
    }

    const fields = ((parsed.fields ?? []) as ExtractedField[]).map(f => ({
      ...f,
      bbox: Array.isArray(f.bbox) && f.bbox.length === 4 ? f.bbox : [0, 0, 1, 1] as [number,number,number,number],
      confidence: typeof f.confidence === 'number' ? Math.min(1, Math.max(0, f.confidence)) : 0.5,
      review_required: (typeof f.confidence === 'number' ? f.confidence : 0.5) < 0.70 || Boolean(f.review_required),
    })) as ExtractedField[]

    return { ok: true, fields, imageQuality: parsed.image_quality }
  } catch (err) {
    console.error('[ocr-from-storage] DeepSeek vision call failed:', err)
    return { ok: false, fields: [] }
  }
}

// ── Fallback: Tesseract.js server-side OCR → DeepSeek text parse ─────────────
async function extractWithTesseract(params: {
  imageBuffer: Buffer
  docType: DocumentType
  glossaryJson: string
  fieldTemplate: string[]
}): Promise<{ ok: boolean; fields: ExtractedField[]; rawText?: string }> {
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) return { ok: false, fields: [] }

  let rawText = ''
  try {
    // Dynamic import to avoid bundler issues — Tesseract.js is heavy
    const Tesseract = await import('tesseract.js')
    const worker = await Tesseract.createWorker(['ukr', 'eng'])
    const { data } = await worker.recognize(params.imageBuffer)
    rawText = data.text ?? ''
    await worker.terminate()
  } catch (err) {
    console.error('[ocr-from-storage] Tesseract failed:', err)
    return { ok: false, fields: [] }
  }

  if (!rawText || rawText.trim().length < 10) return { ok: false, fields: [] }

  // Send raw text to DeepSeek for field extraction
  const fieldList = params.fieldTemplate.join(', ')
  const userPrompt = `Document type: ${params.docType}

Glossary:
${params.glossaryJson}

Raw OCR text:
\`\`\`
${rawText.slice(0, 4000)}
\`\`\`

Extract these fields: ${fieldList}

Return: { "fields": [...], "image_quality": { "overall": 0.8, "issues": [] } }`

  try {
    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: process.env.DEEPSEEK_MODEL ?? 'deepseek-chat',
        max_tokens: 2000,
        temperature: 0.05,
        messages: [
          {
            role: 'system',
            content: 'You are a Ukrainian-to-English document field extractor for USCIS submissions. Return only valid JSON.',
          },
          { role: 'user', content: userPrompt },
        ],
      }),
      signal: AbortSignal.timeout(30_000),
    })

    if (!res.ok) return { ok: false, fields: [], rawText }

    const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> }
    const content = data.choices?.[0]?.message?.content ?? ''
    const clean = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()

    let parsed: { fields?: unknown[] }
    try { parsed = JSON.parse(clean) }
    catch {
      const match = clean.match(/\{[\s\S]*\}/)
      if (!match) return { ok: false, fields: [], rawText }
      parsed = JSON.parse(match[0])
    }

    const fields = ((parsed.fields ?? []) as ExtractedField[]).map(f => ({
      ...f,
      bbox: [0, 0, 1, 1] as [number,number,number,number],
      confidence: typeof f.confidence === 'number' ? Math.min(1, Math.max(0, f.confidence)) : 0.5,
      review_required: (typeof f.confidence === 'number' ? f.confidence : 0.5) < 0.70 || Boolean(f.review_required),
    })) as ExtractedField[]

    return { ok: true, fields, rawText }
  } catch (err) {
    console.error('[ocr-from-storage] DeepSeek text parse failed:', err)
    return { ok: false, fields: [], rawText }
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params
  if (!sessionId) {
    return NextResponse.json({ ok: false, error: 'sessionId required' }, { status: 400 })
  }

  const body = await req.json().catch(() => ({})) as {
    doc_type?: DocumentType
    document_id?: string
    controlling_spelling?: Record<string, string>
  }

  const supabase = createAdminSupabaseClient()

  // Load session
  const { data: session } = await supabase
    .from('translation_sessions')
    .select('session_id, doc_type, status')
    .eq('session_id', sessionId)
    .single()

  if (!session) {
    return NextResponse.json({ ok: false, error: 'Session not found' }, { status: 404 })
  }

  const docType: DocumentType =
    body.doc_type ??
    (session.doc_type as DocumentType) ??
    'ua_passport_booklet'

  // Load target document
  const docQuery = supabase
    .from('translation_documents')
    .select('id, storage_key, mime_type, original_name')
    .eq('session_id', sessionId)

  if (body.document_id) {
    docQuery.eq('id', body.document_id)
  } else {
    docQuery.order('created_at', { ascending: false }).limit(1)
  }

  const { data: docRows } = await docQuery
  const doc = docRows?.[0]

  if (!doc) {
    return NextResponse.json({
      ok: false,
      error: 'No uploaded document found. Upload a document first via POST /api/translation/upload.',
    }, { status: 404 })
  }

  // Download image from Supabase Storage
  const { data: fileData, error: dlErr } = await supabase.storage
    .from('translation-documents')
    .download(doc.storage_key)

  if (dlErr || !fileData) {
    return NextResponse.json({
      ok: false,
      error: `Failed to download document from storage: ${dlErr?.message ?? 'unknown'}`,
    }, { status: 500 })
  }

  const imageBuffer = Buffer.from(await fileData.arrayBuffer())
  const imageBase64 = imageBuffer.toString('base64')
  const mimeType = doc.mime_type ?? 'image/jpeg'

  const glossary = loadGlossary(docType)
  const glossaryJson = JSON.stringify(glossary, null, 2)
  const fieldTemplate = getFieldTemplate(docType)
  const controllingSpelling = body.controlling_spelling ?? {}

  // ── Step 1: Try DeepSeek Vision (preferred if image format is supported) ──
  let extractionResult = await extractWithDeepSeekVision({
    imageBase64,
    mimeType,
    docType,
    glossaryJson,
    fieldTemplate,
  })

  let mode = 'deepseek_vision'

  // ── Step 2: Fallback — Tesseract.js + DeepSeek text parse ─────────────────
  if (!extractionResult.ok || extractionResult.fields.length === 0) {
    console.warn('[ocr-from-storage] Vision failed, falling back to Tesseract.js')
    const tesseractResult = await extractWithTesseract({
      imageBuffer,
      docType,
      glossaryJson,
      fieldTemplate,
    })
    if (tesseractResult.ok && tesseractResult.fields.length > 0) {
      extractionResult = { ok: true, fields: tesseractResult.fields }
      mode = 'tesseract_deepseek'
    }
  }

  if (!extractionResult.ok || extractionResult.fields.length === 0) {
    await writeAuditLog({
      session_id: sessionId,
      event_type: 'extraction_failed',
      metadata: { doc_type: docType, document_id: doc.id, mode },
    })
    return NextResponse.json({
      ok: false,
      mode: 'manual_review_required',
      error: 'OCR extraction failed — please use manual entry or re-upload a clearer image.',
    }, { status: 503 })
  }

  // ── Post-process: glossary + transliteration + date normalization ──────────
  const processed = extractionResult.fields.map(field => {
    let normalized = field.normalized_value

    const nameFields = ['surname','given_names','full_name','last_name','first_name','father_name','mother_name']
    if (nameFields.includes(field.field)) {
      normalized = transliterateName(field.raw_value, controllingSpelling[field.field])
    } else if (field.field.startsWith('date_') && glossary.months) {
      const dateNorm = normalizeDateUkrainian(field.raw_value, glossary.months)
      if (dateNorm) normalized = dateNorm
    } else {
      const looked = lookupTerm(glossary, field.raw_value)
      if (looked) normalized = looked
    }

    return { ...field, normalized_value: normalized }
  })

  // ── Persist + advance session ─────────────────────────────────────────────
  await persistExtractedFields(sessionId, processed)

  await supabase.from('translation_sessions').update({
    status: 'extracted',
    doc_type: docType,
    updated_at: new Date().toISOString(),
  }).eq('session_id', sessionId)

  await writeAuditLog({
    session_id: sessionId,
    event_type: 'extraction_completed',
    metadata: {
      doc_type: docType,
      mode,
      document_id: doc.id,
      total_fields: processed.length,
      review_required_count: processed.filter(f => f.review_required).length,
      image_quality: extractionResult.imageQuality,
    },
  })

  return NextResponse.json({
    ok: true,
    session_id: sessionId,
    mode,
    doc_type: docType,
    fields: processed,
    image_quality: extractionResult.imageQuality,
    total_fields: processed.length,
    review_required_count: processed.filter(f => f.review_required).length,
    next_step: `Review fields at /en/services/translate-document/session/${sessionId}/review`,
  })
}
