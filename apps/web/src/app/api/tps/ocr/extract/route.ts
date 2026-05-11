/**
 * POST /api/tps/ocr/extract — TPS document OCR endpoint.
 *
 * SPRINT-OCR Day 1, Block B.
 *
 * Accepts a multipart upload of a single document image (passport, I-94,
 * or EAD card), runs Google Vision DOCUMENT_TEXT_DETECTION on it through
 * the existing OCR provider, and returns the raw `OcrResult` (words +
 * lines + bboxes) for downstream agents to consume.
 *
 * This route does NOT yet do field extraction, classification, or
 * confidence routing — those come in later blocks. It is a thin wrapper
 * around the OCR provider so we can prove the Vision key is wired in
 * production before building the rest of the pipeline.
 *
 * Privacy: the route does NOT persist the image. After the response is
 * returned, the in-memory buffer is dropped. Persistence (Supabase
 * Storage) is a later block.
 *
 * Reuse: the OCR provider, types, and image-preprocess helpers are
 * shared with the Translation Engine v5 — see docs/translation/
 * DOCUMENT_TRANSLATION_ENGINE_V5.md §3.
 */

import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, getClientIP } from '@/lib/security/rate-limit'
import { googleVisionProvider } from '@/lib/ocr/providers/google-vision'
import { isBlocked } from '@/lib/ocr/types'
import { preprocessImage } from '@/lib/ocr/image-preprocess'
import { runPassportModule } from '@/lib/tps/modules/passport'
import { runPassportBookletModule } from '@/lib/tps/modules/passportBooklet'
import { runI94Module } from '@/lib/tps/modules/i94'
import { runEadModule } from '@/lib/tps/modules/ead'
import type { TpsModuleResult } from '@/lib/tps/types'

// Vision REST call needs full Node runtime (Buffer + fetch with timeout).
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// 10 MB hard limit per image. USCIS recommends pages < 5 MB.
const MAX_BYTES = 10 * 1024 * 1024

// Accept only inline images. PDFs are rejected here — they should be
// pre-split client-side or via a different endpoint.
// SVG / HTML / scripts are NOT in the list — fail-closed against the
// disguised-payload class of attacks.
const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/jpg', // some clients use the non-standard /jpg subtype
  'image/png',
  'image/webp',
  // HEIC / HEIF — iPhone default. Sharp can transcode in preprocessing.
  'image/heic',
  'image/heif',
])

export async function POST(req: NextRequest) {
  // ── Rate limit: 20 OCR calls per minute per IP. Vision is paid; we
  //    do not want a single user (or bot) hammering it.
  const ip = getClientIP(req)
  const rl = await rateLimit(`tps-ocr:${ip}`, 20, 60_000)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many OCR requests. Please wait a moment.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt.getTime() - Date.now()) / 1000)) } },
    )
  }

  // ── Parse multipart form
  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json(
      { error: 'Expected multipart/form-data with a "file" field.' },
      { status: 400 },
    )
  }

  const file = form.get('file')
  const docTypeHint = (form.get('doc_type_hint') as string | null) ?? ''

  if (!file || typeof file === 'string') {
    return NextResponse.json(
      { error: 'Missing "file" field. Send the image as multipart form-data.' },
      { status: 400 },
    )
  }

  const mimeType = file.type || 'application/octet-stream'
  if (!ALLOWED_MIME.has(mimeType)) {
    return NextResponse.json(
      {
        error: 'Unsupported image type. Use JPEG, PNG, or WebP.',
        received_mime: mimeType,
        allowed: Array.from(ALLOWED_MIME),
      },
      { status: 415 },
    )
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      {
        error: 'Image is too large. Maximum 10 MB per file.',
        size_bytes: file.size,
        max_bytes: MAX_BYTES,
      },
      { status: 413 },
    )
  }

  const arrayBuffer = await file.arrayBuffer()
  const rawBuffer = Buffer.from(arrayBuffer)

  // ── Image-quality gate (PP.T2 — reuses the v5 translation engine's
  //    preprocessor). This catches blurry / too-small / corrupt photos
  //    BEFORE we pay for a Vision call AND returns a structured error
  //    that DocumentUploadScreen can render in the user's language
  //    ("plохо видно — снимите ещё раз"). Phone photos with EXIF
  //    rotation get auto-rotated, and oversized images get resized to
  //    ≤2048px so Vision doesn't time out on 50-MP camera shots.
  const t0 = Date.now()
  const pre = await preprocessImage(rawBuffer, mimeType)
  if (!pre.ok) {
    return NextResponse.json(
      {
        error: pre.message,
        quality_error: {
          code: pre.code,            // 'too_small' | 'too_blurry' | 'corrupt_image' | 'unsupported_file_type'
          message: pre.message,      // user-safe localized in the client
        },
        ok: false,
      },
      {
        status: 422,
        headers: {
          'X-OCR-QualityGate': pre.code,
        },
      },
    )
  }
  // Use the normalised buffer + MIME. The original is dropped here —
  // no global cache, no logging, GC eligible after response.
  const imageBuffer = pre.buffer
  const effectiveMime = pre.mimeType

  // ── Call OCR provider
  const result = await googleVisionProvider.extractText({ imageBuffer, mimeType: effectiveMime })

  if (isBlocked(result)) {
    return NextResponse.json(
      {
        error: result.reason,
        required_env_vars: result.required_env_vars,
        configured: false,
      },
      { status: 503 },
    )
  }

  // ── Run the per-document extraction module if a hint was supplied.
  //    Hint-based routing keeps the response shape stable: caller asks
  //    "this is a passport" and gets passport-specific TpsExtractedField[].
  //    Without a hint we return raw OCR only.
  //
  //    For doc_type_hint=passport we try BOTH formats:
  //      1. TD3 MRZ (international Ukrainian passport / загранпаспорт)
  //      2. Internal Ukrainian passport-booklet (паспорт-книжка) — if TD3
  //         not located.
  //    This is critical for real Ukrainian users — many never had a
  //    travel passport and only have the internal booklet, which is
  //    explicitly accepted by USCIS I-821 Instructions as a national
  //    identity document with photograph.
  const document_id = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  let moduleResult: TpsModuleResult | null = null
  switch (docTypeHint) {
    case 'passport': {
      const td3 = runPassportModule(result, { document_id })
      if (td3.matched) {
        moduleResult = td3
      } else {
        // Fallback to internal-passport-booklet label-based extraction.
        const booklet = runPassportBookletModule(result, { document_id })
        if (booklet.matched) {
          moduleResult = booklet
        } else {
          // Neither matched — surface the more informative reason so the
          // user-facing UI can localize properly.
          moduleResult = td3.match_reason === 'mrz_not_located'
            ? booklet // (matched=false, booklet_signals_missing) — better hint
            : td3
        }
      }
      break
    }
    case 'i94':
      moduleResult = runI94Module(result, { document_id })
      break
    case 'ead':
      moduleResult = runEadModule(result, { document_id })
      break
    default:
      moduleResult = null
  }

  // ── Successful OCR. Build a response with just what downstream agents
  //    need; we do NOT include the raw API response (could leak provider
  //    internals or echoed key).
  return NextResponse.json(
    {
      ok: true,
      provider: result.provider,
      doc_type_hint: docTypeHint || null,
      document_id,
      raw_text: result.raw_text,
      page_count: result.pages.length,
      word_count: result.words.length,
      line_count: result.lines.length,
      pages: result.pages.map((p) => ({
        page: p.page,
        width: p.width,
        height: p.height,
        line_count: p.lines.length,
        word_count: p.words.length,
      })),
      words: result.words,    // includes ids, bboxes, confidence
      lines: result.lines,    // includes ids, bboxes
      processing_ms: result.processing_ms,
      route_total_ms: Date.now() - t0,
      warnings: result.warnings,
      // Per-document module output — present only when doc_type_hint is set.
      module: moduleResult,
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store',
        // Surface counts in headers so curl smoke can assert without
        // parsing JSON.
        'X-OCR-Provider': result.provider,
        'X-OCR-Word-Count': String(result.words.length),
        'X-OCR-Page-Count': String(result.pages.length),
        // Preprocess fingerprint — auditors can see what the gate did.
        'X-OCR-Preprocess-Resized': String(pre.resized),
        'X-OCR-Preprocess-Width': String(pre.width),
        'X-OCR-Preprocess-Height': String(pre.height),
        'X-TPS-Module': moduleResult ? moduleResult.module : 'none',
        'X-TPS-Module-Matched': moduleResult ? String(moduleResult.matched) : 'na',
        'X-TPS-Module-Fields': moduleResult ? String(moduleResult.fields.length) : '0',
        'X-TPS-Module-ManualReview': moduleResult ? String(moduleResult.manual_review_required) : 'na',
      },
    },
  )
}

export async function GET() {
  // Friendly response for someone who lands here from a browser address bar.
  return NextResponse.json(
    {
      route: '/api/tps/ocr/extract',
      method: 'POST',
      content_type: 'multipart/form-data',
      fields: {
        file: 'JPEG / PNG / WebP image (≤ 10 MB)',
        doc_type_hint: 'optional: passport | i94 | ead | i797 | evidence',
      },
      note: 'This is a thin OCR endpoint. Field extraction and classification happen in later pipeline stages.',
    },
    { status: 405, headers: { Allow: 'POST' } },
  )
}
