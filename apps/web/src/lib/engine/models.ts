/**
 * engine/models.ts — concrete D1 Reader "employees". Each implements the
 * ModelReader interface (image + field list → per-field Cyrillic read). They
 * are independent voters for the consensus/hallucination guard.
 *
 * Hard rule baked into every prompt (v5 §7 + the 2026-05-28 hallucination
 * finding): read ONLY what is visibly written; if illegible → can_read=false
 * and empty; NEVER invent a plausible value; NEVER transliterate (KMU-55 does
 * that downstream).
 */

import type { FieldRead, ModelReader, NamedReader } from './consensus'
import { mapLinesToFields } from './htr'
import type { DocTypeSpec } from './docTypes'

function buildPrompt(docTypeEn: string, fields: string[]): string {
  return `You are reading a ${docTypeEn}. It may be handwritten Cyrillic (Ukrainian or Russian), often old and faded. The IMAGE is the only ground truth — read EXACTLY what is visibly written, letter by letter.

ABSOLUTE RULES:
- If a field is not clearly legible, set "can_read": false and "cyrillic": "". This is REQUIRED and correct — do NOT produce a plausible guess.
- NEVER invent a name, place, or date that "looks typical". A wrong confident answer is far worse than "can_read": false.
- Do NOT transliterate to Latin. Return the original Cyrillic script (digits stay as digits).
- Read the FULL word; never return only a suffix.

Return ONLY a JSON object. For each field a value {"cyrillic": "...", "can_read": true|false, "confidence": 0.0-1.0}:
${fields.map((f) => `- ${f}`).join('\n')}`
}

function coerce(parsed: Record<string, any>, fields: string[]): Record<string, FieldRead> {
  const out: Record<string, FieldRead> = {}
  for (const f of fields) {
    const v = parsed?.[f]
    if (v && typeof v === 'object') {
      out[f] = {
        cyrillic: typeof v.cyrillic === 'string' ? v.cyrillic.trim() : '',
        can_read: v.can_read === true,
        confidence: typeof v.confidence === 'number' ? v.confidence : v.confidence === 'high' ? 0.9 : v.confidence === 'medium' ? 0.6 : 0.3,
      }
    } else {
      out[f] = { cyrillic: '', can_read: false, confidence: 0 }
    }
  }
  return out
}

/** Gemini via Google AI Studio (generativelanguage) — free/Flash tier. */
export function geminiReader(opts: { apiKey: string; model?: string; docTypeEn: string; timeoutMs?: number }): NamedReader {
  const model = opts.model ?? 'gemini-2.5-flash'
  const read: ModelReader = async (image, mime, fields) => {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 30000)
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${opts.apiKey}`, {
        method: 'POST', signal: ctrl.signal, headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: buildPrompt(opts.docTypeEn, fields) }, { inline_data: { mime_type: mime, data: image.toString('base64') } }] }],
          generationConfig: { temperature: 0, response_mime_type: 'application/json' },
        }),
      })
      const j = await res.json()
      const txt = j?.candidates?.[0]?.content?.parts?.[0]?.text
      return coerce(txt ? JSON.parse(txt) : {}, fields)
    } finally { clearTimeout(t) }
  }
  return { name: `gemini:${model}`, read }
}

/** Vertex AI Gemini — billed via GCP, unlocks gemini-2.5-pro. Needs an OAuth
 *  access token (service account) + aiplatform.googleapis.com enabled. */
export function vertexGeminiReader(opts: { accessToken: string; project: string; location?: string; model?: string; docTypeEn: string; timeoutMs?: number }): NamedReader {
  const loc = opts.location ?? 'us-central1'
  const model = opts.model ?? 'gemini-2.5-pro'
  const read: ModelReader = async (image, mime, fields) => {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 40000)
    try {
      const url = `https://${loc}-aiplatform.googleapis.com/v1/projects/${opts.project}/locations/${loc}/publishers/google/models/${model}:generateContent`
      const res = await fetch(url, {
        method: 'POST', signal: ctrl.signal, headers: { authorization: `Bearer ${opts.accessToken}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: buildPrompt(opts.docTypeEn, fields) }, { inlineData: { mimeType: mime, data: image.toString('base64') } }] }],
          generationConfig: { temperature: 0, responseMimeType: 'application/json' },
        }),
      })
      const j = await res.json()
      const txt = j?.candidates?.[0]?.content?.parts?.[0]?.text
      return coerce(txt ? JSON.parse(txt) : {}, fields)
    } finally { clearTimeout(t) }
  }
  return { name: `vertex:${model}`, read }
}

/** OpenAI GPT-4o vision. */
export function openaiReader(opts: { apiKey: string; model?: string; docTypeEn: string; timeoutMs?: number }): NamedReader {
  const model = opts.model ?? 'gpt-4o'
  const read: ModelReader = async (image, mime, fields) => {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 40000)
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST', signal: ctrl.signal, headers: { authorization: `Bearer ${opts.apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          model, temperature: 0, response_format: { type: 'json_object' },
          messages: [{ role: 'user', content: [{ type: 'text', text: buildPrompt(opts.docTypeEn, fields) }, { type: 'image_url', image_url: { url: `data:${mime};base64,${image.toString('base64')}` } }] }],
        }),
      })
      const j = await res.json()
      const txt = j?.choices?.[0]?.message?.content
      return coerce(txt ? JSON.parse(txt) : {}, fields)
    } finally { clearTimeout(t) }
  }
  return { name: `openai:${model}`, read }
}

/** Google Cloud Vision (DOCUMENT_TEXT_DETECTION) — a structurally DIFFERENT reader
 *  (OCR, not an LLM) → text lines → label-mapped to fields. Available in prod
 *  (GOOGLE_CLOUD_VISION_API_KEY). Diversity vs LLMs breaks shared co-hallucination. */
export function googleVisionReader(opts: { apiKey: string; spec: DocTypeSpec; timeoutMs?: number }): NamedReader {
  const read: ModelReader = async (image, _mime, _fields) => {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 20000)
    try {
      const res = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${opts.apiKey}`, {
        method: 'POST', signal: ctrl.signal, headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ requests: [{
          image: { content: image.toString('base64') },
          features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
          imageContext: { languageHints: ['uk', 'ru', 'en'] },
        }] }),
      })
      const j = await res.json()
      const text: string = j?.responses?.[0]?.fullTextAnnotation?.text ?? ''
      const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
      return mapLinesToFields(lines, opts.spec)
    } catch {
      return Object.fromEntries(opts.spec.fields.map((f) => [f.key, { cyrillic: '', can_read: false, confidence: 0 } as FieldRead]))
    } finally { clearTimeout(t) }
  }
  return { name: 'google-vision', read }
}
