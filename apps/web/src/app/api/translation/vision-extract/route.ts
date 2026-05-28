/**
 * POST /api/translation/vision-extract
 *
 * Accepts a Ukrainian booklet image (multipart/form-data `file`).
 * Reads it via the docintel spine (Gemini vision → KMU-55 transliteration)
 * and returns the canonical extracted fields the translation wizard renders
 * on its review screen.
 *
 * This is the REAL replacement for the wizard's previous fake-detection
 * animation that hardcoded "SHEVCHENKO TARAS HRYHOROVYCH". The user now sees
 * fields actually read from their own document.
 *
 * Privacy: free Gemini tier trains on data. Callers must use PAID Gemini for
 * real client PII — server reads GEMINI_API_KEY from env; production must set
 * the paid-tier key. v5 §30.
 *
 * Rate-limited (8/min/IP) — vision calls are paid; protect against abuse.
 */

import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, getClientIP } from '@/lib/security/rate-limit'
import { readDocument } from '@/lib/docintel/documentFieldReader'

export const dynamic = 'force-dynamic'

const ALLOWED_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp'])
const MAX_BYTES = 10 * 1024 * 1024 // 10 MB

export async function POST(req: NextRequest) {
  const ip = getClientIP(req)
  const rl = await rateLimit(`translation-vision:${ip}`, 8, 60_000)
  if (!rl.allowed) {
    return NextResponse.json(
      { ok: false, error: 'Too many requests. Wait a minute.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt.getTime() - Date.now()) / 1000)) } },
    )
  }

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ ok: false, error: 'Expected multipart/form-data with "file".' }, { status: 400 })
  }

  const file = form.get('file')
  const docTypeId = (form.get('docTypeId') as string | null) ?? 'ua_internal_passport_booklet'

  if (!file || typeof file === 'string') {
    return NextResponse.json({ ok: false, error: 'Missing "file" field.' }, { status: 400 })
  }
  const mime = file.type || 'image/jpeg'
  if (!ALLOWED_MIME.has(mime)) {
    return NextResponse.json({ ok: false, error: `Unsupported image type: ${mime}. Use JPEG, PNG, or WebP.` }, { status: 415 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: `File too large: ${(file.size / 1024 / 1024).toFixed(1)} MB. Maximum 10 MB.` }, { status: 413 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())

  try {
    const result = await readDocument(buffer, mime, docTypeId, { timeoutMs: 15_000 })
    return NextResponse.json({
      ok: result.ok,
      doc_type_id: result.doc_type_id,
      fields: result.fields.map((f) => ({
        field: f.field,
        value: f.value,
        raw_cyrillic: f.raw_cyrillic,
        confidence: f.confidence,
        review_required: f.review_required,
        kind: f.kind,
      })),
      anchor_read: result.anchor_read,
      provider: result.provider,
      model: result.model,
      ms: result.ms,
      status: result.status,
      ...(result.error ? { error: result.error } : {}),
    }, { status: result.ok ? 200 : 502 })
  } catch (e: any) {
    console.error('[translation/vision-extract]', e?.message ?? e)
    return NextResponse.json(
      { ok: false, error: 'Vision extraction failed', detail: e?.message ?? 'unknown' },
      { status: 500 },
    )
  }
}
