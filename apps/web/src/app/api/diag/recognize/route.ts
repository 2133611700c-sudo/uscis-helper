/**
 * POST /api/diag/recognize — BLIND recognition diagnostic (test-only, flag-gated).
 *
 * Owner focus (2026-07-08): after proving auto-orientation blind, test RECOGNITION the same way —
 * BLIND, on the same document, with NO hints:
 *   - The system is NOT told what the document is (no doc-type, no field schema/list).
 *   - It is NOT told what any value should be.
 *   - Step 1: orient the image upright BLIND (same orientToUpright() the reader uses, no docTypeId).
 *   - Step 2: a raw free-form vision read — "transcribe every line exactly as written" — with a
 *     NEUTRAL prompt that names no fields and no document type. Return the raw transcription only.
 *
 * This isolates "can the reader RECOGNIZE the text on the page" from "does a field-schema prompt
 * steer/prime it". Compared by the caller against the known true content. PII lives only in the
 * response to the operator's own request (never committed).
 *
 * Gated behind DIAG_ORIENT_ENABLED=1 (Preview only) → 404 in production.
 */
import { NextRequest, NextResponse } from 'next/server'
import { orientToUpright, isContentOrientEnabled } from '@/lib/docintel/orientation/detectOrientation'
import { getGeminiApiKey } from '@/lib/gemini/apiKey'
import { primaryGeminiModel } from '@/lib/docintel/providers/geminiVisionProvider'

export const dynamic = 'force-dynamic'
export const maxDuration = 90

// NEUTRAL prompt: names NO document type and NO fields. Pure "read what you see".
const BLIND_PROMPT =
  'Transcribe every line of visible text in this image exactly as written, preserving the ' +
  'original language and script (Cyrillic stays Cyrillic). Output a plain numbered list, one ' +
  'line per line of text, top to bottom. Include printed AND handwritten text. Do NOT translate. ' +
  'Do NOT infer, complete, or guess anything that is not clearly legible — if a word is ' +
  'unreadable, write "[illegible]". Do not add any commentary.'

export async function POST(req: NextRequest) {
  if (process.env.DIAG_ORIENT_ENABLED !== '1') {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }
  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ ok: false, error: 'expected multipart/form-data with "file"' }, { status: 400 })
  }
  const file = form.get('file')
  if (!file || typeof file === 'string') {
    return NextResponse.json({ ok: false, error: 'missing "file"' }, { status: 400 })
  }
  let buffer: Buffer = Buffer.from(new Uint8Array(await file.arrayBuffer()))

  // BARE mode (raw=1, owner 2026-07-08): run GPT with ZERO project processing — NO orientation,
  // NO schema, NO pipeline — just the raw image → OpenAI. Isolates the bare model's own
  // capability, independent of the system. (The Vercel-side OPENAI_API_KEY is used by the
  // function itself; nothing about the key is handled outside the deployment.)
  const raw = form.get('raw') === '1'

  // Step 1 — BLIND orientation (no docTypeId). Skipped entirely in bare mode.
  let appliedCw: number | null = null
  if (!raw && isContentOrientEnabled()) {
    const oriented = await orientToUpright(buffer, getGeminiApiKey(), primaryGeminiModel(), {})
    buffer = oriented.buffer
    appliedCw = oriented.applied
  }

  // Step 2 — BLIND raw transcription via GPT vision (no field schema, no doc type).
  const apiKey = (process.env.OPENAI_API_KEY || '').trim()
  if (!apiKey) return NextResponse.json({ ok: false, error: 'no OPENAI_API_KEY' }, { status: 500 })
  const model = process.env.OPENAI_VISION_MODEL || 'gpt-4.1'
  const dataUrl = `data:image/jpeg;base64,${buffer.toString('base64')}`

  const started = Date.now()
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 70_000)
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        temperature: 0,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: BLIND_PROMPT },
            { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } },
          ],
        }],
      }),
    })
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: `openai_http_${res.status}`, orientation_applied_cw: appliedCw }, { status: 502 })
    }
    const j = await res.json()
    const text = j?.choices?.[0]?.message?.content ?? null
    return NextResponse.json({
      ok: true,
      model,
      bare: raw, // true = zero project processing (no orientation/schema), pure model
      orientation_applied_cw: appliedCw, // null in bare mode (orientation skipped)
      elapsed_ms: Date.now() - started,
      transcription: text, // raw, blind — no schema steered this
    })
  } catch (e) {
    return NextResponse.json({ ok: false, error: 'request_failed', detail: String((e as Error)?.message ?? e), orientation_applied_cw: appliedCw }, { status: 502 })
  } finally {
    clearTimeout(timer)
  }
}
