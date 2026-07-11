/**
 * POST /api/diag/normalize — P2 smoke: prove the FREE normalization layer (EXIF →
 * deterministic OSD orientation → deskew → quality) actually RUNS in the Vercel
 * serverless runtime and physically corrects a rotated page — with NO provider /
 * model call and NO PII.
 *
 * Gated behind DIAG_ORIENT_ENABLED=1 (preview only) → 404 in production. This is a
 * diagnostic harness only; it never reads document fields, never calls Gemini/OpenAI,
 * and returns ONLY image geometry + orientation/deskew/quality metadata (no bytes,
 * no OCR, no field values).
 */
import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import { normalizeDocument } from '@/lib/docintel/normalize/normalizeDocument'

export const dynamic = 'force-dynamic'
export const maxDuration = 90

export async function POST(req: NextRequest) {
  if (process.env.DIAG_ORIENT_ENABLED !== '1') {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }
  let form: FormData
  try { form = await req.formData() } catch { return NextResponse.json({ ok: false, error: 'multipart required' }, { status: 400 }) }
  const file = form.get('file')
  if (!file || typeof file === 'string') return NextResponse.json({ ok: false, error: 'missing file' }, { status: 400 })

  const buffer = Buffer.from(new Uint8Array(await file.arrayBuffer()))
  const mimeType = file.type || 'image/jpeg'

  // Input geometry (PII-free — dimensions only).
  let inMeta: { width?: number; height?: number } = {}
  try { const m = await sharp(buffer).metadata(); inMeta = { width: m.width, height: m.height } } catch { /* opaque input */ }

  const started = Date.now()
  let norm
  try {
    norm = await normalizeDocument([{ buffer, mimeType }], { maxPages: 6 })
  } catch (e) {
    // Should never happen (normalizeDocument is fail-safe), but surface a runtime crash
    // (e.g. a native dependency that builds but cannot execute in serverless).
    return NextResponse.json({
      ok: false,
      error: 'normalize_threw',
      detail: e instanceof Error ? e.message.slice(0, 200) : String(e),
      native_runtime_ok: false,
    }, { status: 200 })
  }

  const pages = await Promise.all(norm.pages.map(async (p) => {
    let out: { width?: number; height?: number } = {}
    try { const m = await sharp(p.buffer).metadata(); out = { width: m.width, height: m.height } } catch { /* */ }
    return {
      pageIndex: p.pageIndex,
      sourceIndex: p.sourceIndex,
      orientationApplied: p.orientationApplied,
      deskewDeg: p.deskewDeg,
      quality: p.quality,
      bytes: p.bytes,
      out_width: out.width ?? null,
      out_height: out.height ?? null,
    }
  }))

  return NextResponse.json({
    ok: true,
    elapsed_ms: Date.now() - started,
    // native_runtime_ok: normalizeDocument completed without throwing ⇒ sharp/tesseract
    // (and, for PDFs, pdfjs/@napi-rs/canvas) executed in the serverless runtime.
    native_runtime_ok: true,
    in_width: inMeta.width ?? null,
    in_height: inMeta.height ?? null,
    page_count: norm.pages.length,
    failures: norm.failures,
    pages,
  })
}
