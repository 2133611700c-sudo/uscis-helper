/**
 * POST /api/translation/[sessionId]/ocr-from-storage
 *
 * Async OCR dispatcher — returns HTTP 202 immediately.
 *
 * Lifecycle:
 *   1. Validate session + document exist
 *   2. Create extraction_runs row  (status=queued)
 *   3. Write audit log: ocr_started
 *   4. Return HTTP 202 { ok: true, extraction_run_id, status: 'queued' }
 *   5. (Background) Run OCR pipeline:
 *        a. Pre-compress image → JPEG 1024px max, quality 70 (Option C — cuts payload ~4×)
 *        b. Try DeepSeek Vision with 25s timeout
 *        c. On failure → Tesseract.js text parse (15s)
 *        d. On total failure → status=manual_review_required (Option D)
 *        e. Smart Retake: quality < 0.4 AND retake_count < 2 → status=retake_required
 *        f. On success → persist extracted_fields, set status=completed
 *
 * Poll for result:
 *   GET /api/translation/[sessionId]/extraction-status/[runId]
 *
 * Body (optional): {
 *   doc_type?: DocumentType
 *   document_id?: string
 *   controlling_spelling?: Record<string,string>
 *   retake_count?: number
 * }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { loadGlossary, lookupTerm } from '@/lib/translation/glossary/glossaryLoader'
import { transliterateName } from '@/lib/translation/glossary/nominativeCaseRestorer'
import { normalizeDateUkrainian } from '@/lib/translation/numericAccuracy/dateFieldLockValidator'
import { persistExtractedFields, writeAuditLog } from '@/lib/translation/packetStateManager'
import {
  DocumentType,
  ExtractedField,
  EvidenceItem,
  VisionExtractionResult,
  BboxStatus,
} from '@/lib/translation/types'

export const dynamic = 'force-dynamic'
// 202 response is instant. Background job runs under waitUntil which has its own timeout.
// Keep maxDuration at 60 so the function stays alive long enough for waitUntil to fire.
export const maxDuration = 60

// ── Constants ─────────────────────────────────────────────────────────────────
const SMART_RETAKE_QUALITY_THRESHOLD = 0.4
const SMART_RETAKE_MAX_ATTEMPTS = 2
const SMART_RETAKE_USER_MESSAGE =
  'The photo is too blurry or poorly lit for reliable extraction. ' +
  'Please retake with better lighting, steady hands, and the document flat on a surface.'

// Option C: compress to ≤1024px JPEG quality 70 before DeepSeek Vision.
// Cuts payload from ~2–4 MB to ~150–300 KB → latency drops from 50–60s to ~15–25s.
const COMPRESS_MAX_DIMENSION = 1024
const COMPRESS_JPEG_QUALITY = 70

// Timeouts for each step.
// Total function budget = 60s (Vercel maxDuration, includes after() work).
// Budget breakdown:
//   202 response + DB writes        ~2s
//   Image download + compression    ~3s
//   DeepSeek Vision call            22s
//   Status update + audit logs      ~3s
//   ─────────────────────────────   30s  ← well within 60s limit
//
// Tesseract fallback is NOT used in the async pipeline — Tesseract.js
// cold-loads language models (~15-30s) which would push us past 60s.
// Tesseract remains available for the synchronous /api/translation/extract
// testing path. A proper async queue (Inngest/Upstash) can re-enable it later.
const DEEPSEEK_TIMEOUT_MS = 22_000   // 22s gives 30s+ total headroom
const TESSERACT_TIMEOUT_MS = 15_000  // kept for reference (not used in async path)

// ── Field templates ───────────────────────────────────────────────────────────
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

// ── Bbox classification ───────────────────────────────────────────────────────
function classifyBbox(
  bbox: unknown,
  confidence: number
): { bbox: [number,number,number,number]; bbox_status: BboxStatus } {
  const isValid =
    Array.isArray(bbox) &&
    bbox.length === 4 &&
    bbox.every((v: unknown) => typeof v === 'number' && isFinite(v)) &&
    !(bbox[0] === 0 && bbox[1] === 0 && bbox[2] === 1 && bbox[3] === 1)

  if (isValid) {
    const b = bbox as [number,number,number,number]
    return { bbox: b, bbox_status: confidence >= 0.70 ? 'exact' : 'approximate' }
  }
  return { bbox: [0, 0, 1, 1], bbox_status: 'missing' }
}

// ── Option C: image pre-compression ──────────────────────────────────────────
// Uses sharp (server-only) if available; gracefully degrades to uncompressed.
async function compressImage(imageBuffer: Buffer, mimeType: string): Promise<{
  buffer: Buffer
  mimeType: string
  compressed: boolean
}> {
  try {
    const sharp = (await import('sharp')).default
    const compressed = await sharp(imageBuffer)
      .resize(COMPRESS_MAX_DIMENSION, COMPRESS_MAX_DIMENSION, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: COMPRESS_JPEG_QUALITY })
      .toBuffer()
    return { buffer: compressed, mimeType: 'image/jpeg', compressed: true }
  } catch {
    // sharp not available or image type unsupported — proceed uncompressed
    return { buffer: imageBuffer, mimeType, compressed: false }
  }
}

// ── DeepSeek Vision extraction ────────────────────────────────────────────────
async function extractWithDeepSeekVision(params: {
  imageBase64: string
  mimeType: string
  docType: DocumentType
  glossaryJson: string
  fieldTemplate: string[]
}): Promise<{
  ok: boolean
  fields: ExtractedField[]
  imageQuality?: { overall: number; issues: string[] }
  visionResult?: VisionExtractionResult
}> {
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

  const startedAt = new Date().toISOString()

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
      signal: AbortSignal.timeout(DEEPSEEK_TIMEOUT_MS),
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

    const rawFields = (parsed.fields ?? []) as Array<Record<string, unknown>>
    const evidenceItems: EvidenceItem[] = []

    const fields: ExtractedField[] = rawFields.map(f => {
      const conf = typeof f.confidence === 'number' ? Math.min(1, Math.max(0, f.confidence)) : 0.5
      const { bbox, bbox_status } = classifyBbox(f.bbox, conf)

      evidenceItems.push({
        field: typeof f.field === 'string' ? f.field : undefined,
        raw_text: typeof f.raw_value === 'string' ? f.raw_value : '',
        bbox: bbox_status !== 'missing' ? bbox : undefined,
        page: 0,
        confidence: conf,
        evidence_type: 'full_image',
        bbox_status,
      })

      return {
        field: String(f.field ?? ''),
        source_label: String(f.source_label ?? ''),
        source_zone: String(f.source_zone ?? ''),
        bbox,
        raw_value: String(f.raw_value ?? ''),
        normalized_value: String(f.normalized_value ?? ''),
        language_layer: (f.language_layer as 'uk' | 'ru' | 'mixed' | 'unknown') ?? 'uk',
        confidence: conf,
        review_required: conf < 0.70 || Boolean(f.review_required),
        evidence_type: 'full_image',
        bbox_status,
      } satisfies ExtractedField
    })

    const sorted = [...fields.map(f => f.confidence)].sort((a, b) => a - b)
    const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0.5

    const raw_text = rawFields
      .map(f => `${f.source_label ?? f.field}: ${f.raw_value ?? ''}`)
      .join('\n')

    const visionResult: VisionExtractionResult = {
      raw_text,
      provider: 'deepseek_vision',
      ocr_confidence: median,
      pages: 1,
      warnings: [],
      created_at: startedAt,
      evidence_items: evidenceItems,
    }

    return { ok: true, fields, imageQuality: parsed.image_quality, visionResult }
  } catch (err) {
    console.error('[ocr-from-storage] DeepSeek vision call failed:', err)
    return { ok: false, fields: [] }
  }
}

// ── Fallback: Tesseract.js + DeepSeek text parse ──────────────────────────────
async function extractWithTesseract(params: {
  imageBuffer: Buffer
  docType: DocumentType
  glossaryJson: string
  fieldTemplate: string[]
}): Promise<{
  ok: boolean
  fields: ExtractedField[]
  rawText?: string
  visionResult?: VisionExtractionResult
}> {
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) return { ok: false, fields: [] }

  const startedAt = new Date().toISOString()
  let rawText = ''

  try {
    const Tesseract = await import('tesseract.js')
    const worker = await Tesseract.createWorker(['ukr', 'eng'])
    const result = await Promise.race([
      worker.recognize(params.imageBuffer),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Tesseract timeout')), TESSERACT_TIMEOUT_MS)
      ),
    ])
    rawText = (result as Awaited<ReturnType<typeof worker.recognize>>).data.text ?? ''
    await worker.terminate()
  } catch (err) {
    console.error('[ocr-from-storage] Tesseract failed:', err)
    return { ok: false, fields: [] }
  }

  if (!rawText || rawText.trim().length < 10) return { ok: false, fields: [] }

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
      signal: AbortSignal.timeout(DEEPSEEK_TIMEOUT_MS),
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

    const rawFields = (parsed.fields ?? []) as Array<Record<string, unknown>>

    const fields: ExtractedField[] = rawFields.map(f => {
      const conf = typeof f.confidence === 'number' ? Math.min(1, Math.max(0, f.confidence)) : 0.5
      return {
        field: String(f.field ?? ''),
        source_label: String(f.source_label ?? ''),
        source_zone: String(f.source_zone ?? ''),
        bbox: [0, 0, 1, 1] as [number,number,number,number],
        raw_value: String(f.raw_value ?? ''),
        normalized_value: String(f.normalized_value ?? ''),
        language_layer: (f.language_layer as 'uk' | 'ru' | 'mixed' | 'unknown') ?? 'uk',
        confidence: conf,
        review_required: conf < 0.70 || Boolean(f.review_required),
        evidence_type: 'zone_fallback' as const,
        bbox_status: 'missing' as const,
      } satisfies ExtractedField
    })

    const sorted = [...fields.map(f => f.confidence)].sort((a, b) => a - b)
    const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0.5

    const visionResult: VisionExtractionResult = {
      raw_text: rawText,
      provider: 'tesseract_deepseek',
      ocr_confidence: median,
      pages: 1,
      warnings: ['Tesseract OCR fallback used — bbox not available for any field'],
      created_at: startedAt,
      evidence_items: rawFields.map(f => ({
        field: typeof f.field === 'string' ? f.field : undefined,
        raw_text: typeof f.raw_value === 'string' ? f.raw_value : '',
        page: 0,
        confidence: typeof f.confidence === 'number' ? Math.min(1, Math.max(0, f.confidence)) : 0.5,
        evidence_type: 'zone_fallback' as const,
        bbox_status: 'missing' as const,
      })),
    }

    return { ok: true, fields, rawText, visionResult }
  } catch (err) {
    console.error('[ocr-from-storage] DeepSeek text parse failed:', err)
    return { ok: false, fields: [], rawText }
  }
}

// ── Background OCR pipeline ───────────────────────────────────────────────────
// This runs after the 202 is sent. It must not throw — all errors are caught and
// written to the extraction_runs row so the polling endpoint can surface them.
async function runExtractionPipeline(params: {
  runId: string
  sessionId: string
  docId: string
  storageKey: string
  mimeType: string
  docType: DocumentType
  glossaryJson: string
  fieldTemplate: string[]
  controllingSpelling: Record<string, string>
  retakeCount: number
}): Promise<void> {
  const {
    runId, sessionId, docId, storageKey, mimeType,
    docType, glossaryJson, fieldTemplate, controllingSpelling, retakeCount,
  } = params

  const supabase = createAdminSupabaseClient()

  // Mark as processing
  await supabase.from('extraction_runs').update({
    status: 'processing',
    started_at: new Date().toISOString(),
  }).eq('id', runId)

  // Download image
  let imageBuffer: Buffer
  try {
    const { data: fileData, error: dlErr } = await supabase.storage
      .from('translation-documents')
      .download(storageKey)

    if (dlErr || !fileData) {
      throw new Error(`storage_download_failed: ${dlErr?.message ?? 'unknown'}`)
    }
    imageBuffer = Buffer.from(await fileData.arrayBuffer())
  } catch (err) {
    await supabase.from('extraction_runs').update({
      status: 'failed',
      error_message: 'Could not load your document. Please try re-uploading.',
      error_detail: String(err),
      completed_at: new Date().toISOString(),
    }).eq('id', runId)
    await writeAuditLog({
      session_id: sessionId,
      event_type: 'ocr_failed',
      metadata: { run_id: runId, doc_id: docId, reason: String(err) },
    })
    return
  }

  // Option C: compress image before sending to DeepSeek Vision
  const { buffer: compressedBuffer, mimeType: compressedMime, compressed } =
    await compressImage(imageBuffer, mimeType)

  const imageBase64 = compressedBuffer.toString('base64')

  let mode: VisionExtractionResult['provider'] = 'deepseek_vision'
  let visionResult: VisionExtractionResult | undefined
  let extractionResult: {
    ok: boolean
    fields: ExtractedField[]
    imageQuality?: { overall: number; issues: string[] }
  } = { ok: false, fields: [] }

  // Step 1: DeepSeek Vision (compressed, 25s timeout)
  extractionResult = await extractWithDeepSeekVision({
    imageBase64,
    mimeType: compressedMime,
    docType,
    glossaryJson,
    fieldTemplate,
  })

  if (extractionResult.ok && extractionResult.fields.length > 0) {
    mode = 'deepseek_vision'
    visionResult = (extractionResult as typeof extractionResult & { visionResult?: VisionExtractionResult }).visionResult
  }

  // Step 2: Tesseract fallback intentionally skipped in async pipeline.
  // Tesseract.js cold-initialises language packs in 15-30s on first load,
  // which would push the total function time past the 60s maxDuration and
  // leave extraction_runs stuck on "processing" with no terminal update.
  // Tesseract remains available on the synchronous extract route for testing.
  // TODO: re-enable when migrated to an async queue (Inngest / Upstash).

  // Option D: DeepSeek failed → manual_review_required
  if (!extractionResult.ok || extractionResult.fields.length === 0) {
    await supabase.from('extraction_runs').update({
      status: 'manual_review_required',
      provider: mode,
      error_message:
        'Automatic extraction could not read your document. ' +
        'Please use manual entry or re-upload a clearer photo.',
      completed_at: new Date().toISOString(),
    }).eq('id', runId)

    await writeAuditLog({
      session_id: sessionId,
      event_type: 'extraction_manual_review_required',
      metadata: { run_id: runId, doc_id: docId, mode, compressed },
    })
    return
  }

  // Smart Retake: poor image quality
  const imageQuality = extractionResult.imageQuality
  if (
    imageQuality &&
    imageQuality.overall < SMART_RETAKE_QUALITY_THRESHOLD &&
    retakeCount < SMART_RETAKE_MAX_ATTEMPTS
  ) {
    await supabase.from('extraction_runs').update({
      status: 'retake_required',
      provider: mode,
      image_quality: imageQuality,
      retake_count: retakeCount,
      error_message: SMART_RETAKE_USER_MESSAGE,
      completed_at: new Date().toISOString(),
    }).eq('id', runId)

    await writeAuditLog({
      session_id: sessionId,
      event_type: 'ocr_retake_required',
      metadata: {
        run_id: runId, doc_id: docId, image_quality: imageQuality,
        retake_count: retakeCount, max_retakes: SMART_RETAKE_MAX_ATTEMPTS,
      },
    })
    return
  }

  // Post-process: glossary + transliteration + date normalization
  const glossary = loadGlossary(docType)
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

  // Persist extracted_fields
  await persistExtractedFields(sessionId, processed)

  // Advance session status
  await supabase.from('translation_sessions').update({
    status: 'extracted',
    doc_type: docType,
    updated_at: new Date().toISOString(),
  }).eq('session_id', sessionId)

  // Mark run completed
  const rawText = visionResult?.raw_text?.slice(0, 8000) ?? ''
  const confidence = visionResult?.ocr_confidence ?? null

  await supabase.from('extraction_runs').update({
    status: 'completed',
    provider: mode,
    raw_text: rawText,
    warnings: visionResult?.warnings ?? [],
    confidence,
    image_quality: imageQuality ?? null,
    retake_count: retakeCount,
    completed_at: new Date().toISOString(),
  }).eq('id', runId)

  // Audit logs
  await writeAuditLog({
    session_id: sessionId,
    event_type: 'ocr_completed',
    metadata: {
      run_id: runId,
      doc_id: docId,
      mode,
      compressed,
      provider: visionResult?.provider,
      ocr_confidence: visionResult?.ocr_confidence,
      pages: visionResult?.pages,
      warnings: visionResult?.warnings,
      raw_text: rawText,
      evidence_items_count: visionResult?.evidence_items?.length ?? 0,
      image_quality: imageQuality,
    },
  })

  await writeAuditLog({
    session_id: sessionId,
    event_type: 'extraction_completed',
    metadata: {
      run_id: runId,
      doc_id: docId,
      mode,
      total_fields: processed.length,
      review_required_count: processed.filter(f => f.review_required).length,
      full_image_count: processed.filter(f => f.evidence_type === 'full_image').length,
      zone_fallback_count: processed.filter(f => f.evidence_type === 'zone_fallback').length,
      bbox_exact_count: processed.filter(f => f.bbox_status === 'exact').length,
      bbox_approximate_count: processed.filter(f => f.bbox_status === 'approximate').length,
      bbox_missing_count: processed.filter(f => f.bbox_status === 'missing').length,
      image_quality: imageQuality,
    },
  })

  console.log(`[ocr-pipeline:${runId}] Completed — ${processed.length} fields, provider=${mode}`)
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
    retake_count?: number
  }

  const retakeCount = typeof body.retake_count === 'number' ? body.retake_count : 0
  const supabase = createAdminSupabaseClient()

  // ── Validate session ────────────────────────────────────────────────────────
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

  // ── Locate document ─────────────────────────────────────────────────────────
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

  // ── Create extraction_runs row (status=queued) ──────────────────────────────
  const { data: runRow, error: runErr } = await supabase
    .from('extraction_runs')
    .insert({
      session_id: sessionId,
      document_id: doc.id,
      status: 'queued',
      retake_count: retakeCount,
    })
    .select('id')
    .single()

  if (runErr || !runRow) {
    console.error('[ocr-from-storage] Failed to create extraction_runs row:', runErr)
    return NextResponse.json({
      ok: false,
      error: 'Failed to queue extraction job. Please try again.',
    }, { status: 500 })
  }

  const runId = runRow.id as string

  // ── Audit: ocr_started ──────────────────────────────────────────────────────
  await writeAuditLog({
    session_id: sessionId,
    event_type: 'ocr_started',
    metadata: {
      run_id: runId,
      doc_type: docType,
      document_id: doc.id,
      retake_count: retakeCount,
    },
  })

  // ── Return 202 immediately ──────────────────────────────────────────────────
  const response = NextResponse.json({
    ok: true,
    status: 'queued',
    extraction_run_id: runId,
    session_id: sessionId,
    doc_type: docType,
    poll_url: `/api/translation/${sessionId}/extraction-status/${runId}`,
    message: 'Extraction queued. Poll the poll_url for status.',
  }, { status: 202 })

  // ── Kick off background pipeline ────────────────────────────────────────────
  // waitUntil keeps the Vercel function alive after response is sent.
  // Fallback: detached promise (works in most environments, but Vercel may
  // terminate the function early — waitUntil is preferred).
  const pipelinePromise = runExtractionPipeline({
    runId,
    sessionId,
    docId: doc.id,
    storageKey: doc.storage_key,
    mimeType: doc.mime_type ?? 'image/jpeg',
    docType,
    glossaryJson: JSON.stringify(loadGlossary(docType), null, 2),
    fieldTemplate: getFieldTemplate(docType),
    controllingSpelling: body.controlling_spelling ?? {},
    retakeCount,
  }).catch(err => {
    // Last-resort catch — should never reach here since runExtractionPipeline catches internally
    console.error(`[ocr-pipeline:${runId}] Unhandled error in pipeline:`, err)
    // Best-effort: mark run as failed
    supabase.from('extraction_runs').update({
      status: 'failed',
      error_message: 'An unexpected error occurred. Please try again.',
      error_detail: String(err),
      completed_at: new Date().toISOString(),
    }).eq('id', runId).then(() => {}, () => {})
  })

  // Use waitUntil if the runtime exposes it (Vercel Edge / Next.js with after())
  // next/server exports `after` in Next.js 15+ for this purpose
  try {
    const { after } = await import('next/server')
    after(pipelinePromise)
  } catch {
    // after() not available in this runtime version — fire-and-forget
    // The promise is already running; do nothing further
    void pipelinePromise
  }

  return response
}
