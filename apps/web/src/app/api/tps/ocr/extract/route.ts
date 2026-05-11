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
import { runPassportModule } from '@/lib/tps/modules/passport'
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
const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
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
  const imageBuffer = Buffer.from(arrayBuffer)

  // ── Call OCR provider
  const t0 = Date.now()
  const result = await googleVisionProvider.extractText({ imageBuffer, mimeType })

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
  const document_id = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  let moduleResult: TpsModuleResult | null = null
  switch (docTypeHint) {
    case 'passport':
      moduleResult = runPassportModule(result, { document_id })
      break
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
