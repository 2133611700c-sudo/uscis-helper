/**
 * POST /api/diag/classify — ONE BRAIN doc-type auto-detection diagnostic (test-only, flag-gated).
 *
 * Proves the missing One Brain node #4 (detect doc type from the image, no human hint). Pipeline:
 *   1. orient the image upright BLIND (same orientToUpright the reader uses, no docTypeId);
 *   2. classify the doc TYPE by its PRINTED identity via GPT vision (classifyDocumentType);
 *   3. return {doc_type_id, confidence, printed_title_seen, candidates} — fail-closed to 'unknown'.
 *
 * No human tells it the type — that is the point. Uses the Vercel-side OPENAI_API_KEY inside the
 * function. Gated behind DIAG_ORIENT_ENABLED=1 (preview only) → 404 in production.
 */
import { NextRequest, NextResponse } from 'next/server'
import { orientToUpright, isContentOrientEnabled } from '@/lib/docintel/orientation/detectOrientation'
import { getGeminiApiKey } from '@/lib/gemini/apiKey'
import { primaryGeminiModel } from '@/lib/docintel/providers/geminiVisionProvider'
import { classifyDocumentType } from '@/lib/docintel/detectDocumentType'
import { detectLanguage, detectCountry, countryToTypePrefixes } from '@/lib/docintel/detectLanguageCountry'

export const dynamic = 'force-dynamic'
export const maxDuration = 90

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

  // 1 — orient blind (no docTypeId).
  let appliedCw: number | null = null
  if (isContentOrientEnabled()) {
    const oriented = await orientToUpright(buffer, getGeminiApiKey(), primaryGeminiModel(), {})
    buffer = oriented.buffer
    appliedCw = oriented.applied
  }

  // 2 — classify TYPE by printed identity (GPT). Bare OpenAI call injected here (no key handled
  // outside the function).
  const apiKey = (process.env.OPENAI_API_KEY || '').trim()
  if (!apiKey) return NextResponse.json({ ok: false, error: 'no OPENAI_API_KEY' }, { status: 500 })
  const model = process.env.OPENAI_VISION_MODEL || 'gpt-4.1'

  const started = Date.now()
  const visionCall = async (prompt: string, img: Buffer): Promise<string | null> => {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 60_000)
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        signal: ctrl.signal,
        headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          temperature: 0,
          response_format: { type: 'json_object' },
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${img.toString('base64')}`, detail: 'high' } },
            ],
          }],
        }),
      })
      if (!res.ok) return null
      const j = await res.json()
      return j?.choices?.[0]?.message?.content ?? null
    } finally {
      clearTimeout(timer)
    }
  }

  // ORDERED One Brain funnel (owner-canonical): ORIENT → LANGUAGE → COUNTRY → TYPE.
  const language = await detectLanguage(buffer, visionCall)
  const country = await detectCountry(buffer, visionCall)
  const type = await classifyDocumentType(buffer, visionCall)
  return NextResponse.json({
    ok: true,
    model,
    pipeline: 'orient>language>country>type',
    orientation_applied_cw: appliedCw,
    elapsed_ms: Date.now() - started,
    language,
    country,
    // the funnel: which registry prefixes the detected country scopes the type to
    country_scopes_types_to: countryToTypePrefixes(country.country),
    type,
  })
}
