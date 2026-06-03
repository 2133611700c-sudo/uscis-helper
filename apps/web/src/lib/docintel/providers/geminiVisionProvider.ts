/**
 * docintel/providers/geminiVisionProvider — Gemini implementation of the
 * vendor-agnostic VisionProvider. Reads document fields from an image, driven
 * by the document's DocTypeSpec (the prompt is BUILT from spec.fields, so a new
 * document type needs no new provider code — just a registry entry).
 *
 * Returns Cyrillic reads only; transliteration is done by transliterationPolicy
 * (KMU-55), never by the model. Retries 503/429 with model fallback (free tier
 * flaps), per-call timeout. Reads GEMINI_API_KEY from env.
 *
 * PRIVACY: free Gemini tier trains on data → caller must use a PAID tier for
 * real client PII. This module does not enforce that (caller/flag responsibility).
 */

import type { DocTypeSpec, VisionFieldRead, VisionProvider, VisionReadResult } from '../types'
import { getGeminiApiKey } from '@/lib/gemini/apiKey'

// Model order is env-driven so prod can flip models WITHOUT a code redeploy.
// 2026-05-29 ensemble bench (docs/reports/GEMINI_ENSEMBLE_BENCH.md), 3 docs incl. a
// handwritten 1986 UkrSSR birth cert, scored vs ground truth:
//   gemini-3.1-pro-preview 19/22 (best) · 3.5-flash 16/22 · 2.5-pro 13/22.
//   2.5-pro CATASTROPHICALLY FABRICATED a fake identity on the handwritten cert
//   ("Кудрявцев Олег" instead of "Куропятник Сергей") → 1/9 there. So 2.5-pro is
//   NOT a safe default. 3.1-pro-preview leads; flash is the fast fallback.
//   The robust answer is the 3-model consensus (E4: 19/22, and it OUTVOTES the
//   2.5-pro fabrication) — see report. NOTE: 3.1-pro is a PREVIEW model.
// pro+thinking on a large scan runs ~20-40s → keep timeoutMs high + Vercel maxDuration.
function modelFallback(): string[] {
  const primary = process.env.GEMINI_MODEL || 'gemini-3.1-pro-preview'
  return [...new Set([primary, 'gemini-3.5-flash', 'gemini-2.5-flash'])]
}

function buildPrompt(spec: DocTypeSpec): string {
  const lines = spec.fields.map((f) => {
    const dateHint = f.kind === 'date' ? ' (also return iso_date YYYY-MM-DD)' : ''
    return `- ${f.field} (${f.label_uk})${dateHint}`
  })
  return `You are reading a ${spec.title_en}. The IMAGE is the ground truth — read only what is visibly written. Do NOT guess, do NOT infer typical values.

Return a JSON object with these keys, reading each from the document text:
${lines.join('\n')}

For each key return an object:
{ "cyrillic": "<exact full text as written, in the document's script>",
  "iso_date": "<YYYY-MM-DD, only for date fields, else omit>",
  "can_read": <true|false>,
  "confidence": <0.0-1.0>,
  "reason": "<short>" }

Rules:
- Read the FULL word, every letter. Never return only a suffix (never "ович" alone).
- Handwritten Ukrainian "Т" and "П" look similar; pick the letter that forms a REAL Ukrainian name/place.
- If a field is not clearly legible, set can_read=false and cyrillic="".
- Do NOT transliterate to Latin yourself. Return the original script (except iso_date).
- Output ONLY the JSON object.`
}

async function callGemini(
  model: string,
  apiKey: string,
  imageB64: string,
  mimeType: string,
  prompt: string,
  timeoutMs: number,
): Promise<{ ok: boolean; status: number; json: any }> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: ctrl.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: imageB64 } }] }],
          generationConfig: { temperature: 0, response_mime_type: 'application/json', maxOutputTokens: 8192 },
        }),
      },
    )
    const json = await res.json().catch(() => ({}))
    return { ok: res.ok, status: res.status, json }
  } finally {
    clearTimeout(timer)
  }
}

export class GeminiVisionProvider implements VisionProvider {
  readonly name = 'gemini'

  async readFields(
    imageBuffer: Buffer,
    mimeType: string,
    spec: DocTypeSpec,
    opts: { timeoutMs?: number; attemptsPerModel?: number } = {},
  ): Promise<VisionReadResult> {
    const t0 = Date.now()
    // Resolve the key from ANY GEMINI_API_KEY* env name (owner rotates names).
    const apiKey = getGeminiApiKey()
    if (!apiKey) return { ok: false, fields: [], model: null, ms: 0, error: 'no GEMINI_API_KEY* set' }

    // 2.5-pro + thinking on a full-page scan runs ~20-40s; the old 8s default
    // would abort it every time. Default high; callers can still override.
    const timeoutMs = opts.timeoutMs ?? 45000
    const attempts = opts.attemptsPerModel ?? 2
    const prompt = buildPrompt(spec)
    const imageB64 = imageBuffer.toString('base64')
    const allowed = new Set(spec.fields.map((f) => f.field))
    let lastErr = 'unknown'

    for (const model of modelFallback()) {
      for (let a = 0; a < attempts; a++) {
        try {
          const { ok, status, json } = await callGemini(model, apiKey, imageB64, mimeType, prompt, timeoutMs)
          if (ok) {
            const text = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
            let parsed: Record<string, any>
            try {
              parsed = JSON.parse(text)
            } catch {
              lastErr = 'invalid JSON from model'
              continue
            }
            const fields: VisionFieldRead[] = []
            for (const key of Object.keys(parsed)) {
              if (!allowed.has(key)) continue
              const v = parsed[key]
              if (!v || typeof v !== 'object') continue
              fields.push({
                field: key,
                cyrillic: typeof v.cyrillic === 'string' ? v.cyrillic.trim() : '',
                iso_date: typeof v.iso_date === 'string' ? v.iso_date.trim() : null,
                can_read: v.can_read === true,
                confidence: typeof v.confidence === 'number' ? v.confidence : 0,
                reason: typeof v.reason === 'string' ? v.reason : '',
              })
            }
            return { ok: true, fields, model, ms: Date.now() - t0 }
          }
          lastErr = `HTTP ${status}`
          if (status === 503 || status === 429) {
            await new Promise((r) => setTimeout(r, 1500))
            continue
          }
          break // other error → next model
        } catch (e: any) {
          lastErr = e?.name === 'AbortError' ? 'timeout' : (e?.message ?? 'fetch error')
        }
      }
    }
    return { ok: false, fields: [], model: null, ms: Date.now() - t0, error: lastErr }
  }
}

/** Default singleton provider. Swap here (or inject) to change vendor. */
export const defaultVisionProvider: VisionProvider = new GeminiVisionProvider()
