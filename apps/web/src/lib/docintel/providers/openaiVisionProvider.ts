/**
 * openaiVisionProvider — OpenAI implementation of the vendor-agnostic VisionProvider.
 *
 * RESILIENCE ROLE ONLY (ONE_BRAIN_READER_FALLBACK, default OFF): Gemini stays the PRIMARY reader.
 * This provider is used by documentFieldReader as a SINGLE fallback when the primary read fails
 * with a retriable provider error (rate-limit / 5xx / timeout). A fallback read is NON-primary, so
 * the existing model-matrix rule force-reviews it (`fallback_model_used`) — its fields are
 * candidate-only and NEVER auto-final. It reuses the SAME field prompt as Gemini (byte-parity of the
 * instruction), so the only difference is the transport/vendor.
 */
import type { DocTypeSpec, VisionFieldRead, VisionProvider, VisionReadResult } from '../types'
import { buildPrompt } from './geminiVisionProvider'

/**
 * Enable the OpenAI reader fallback.
 *
 * Production defaults ON after the 2026-07-25 Gemini 429 incident. An explicit
 * `ONE_BRAIN_READER_FALLBACK=0` remains the immediate kill switch. Preview and
 * local environments stay opt-in so experiments remain isolated.
 */
export function isReaderFallbackEnabled(env: Record<string, string | undefined> = process.env): boolean {
  if (env.ONE_BRAIN_READER_FALLBACK === '0') return false
  return env.ONE_BRAIN_READER_FALLBACK === '1' || env.VERCEL_ENV === 'production'
}

/** Strict budget for the single fallback read (never let it exceed the primary's own budget). */
export const READER_FALLBACK_TIMEOUT_MS = 30_000

function openaiVisionModel(): string {
  return process.env.OPENAI_VISION_MODEL || 'gpt-4.1'
}

class OpenAiVisionProvider implements VisionProvider {
  readonly name = 'openai'

  async readFields(
    imageBuffer: Buffer,
    mimeType: string,
    spec: DocTypeSpec,
    opts: { timeoutMs?: number; attemptsPerModel?: number } = {},
  ): Promise<VisionReadResult> {
    const t0 = Date.now()
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) return { ok: false, fields: [], model: null, ms: 0, error: 'no OPENAI_API_KEY set', attempts: 0 }

    const model = openaiVisionModel()
    const prompt = buildPrompt(spec)
    const dataUri = `data:${mimeType || 'image/jpeg'};base64,${imageBuffer.toString('base64')}`
    const allowed = new Set(spec.fields.map((f) => f.field))

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), Math.min(opts.timeoutMs ?? READER_FALLBACK_TIMEOUT_MS, READER_FALLBACK_TIMEOUT_MS))
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          temperature: 0,
          max_tokens: 4096,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                { type: 'image_url', image_url: { url: dataUri } },
              ],
            },
          ],
        }),
      })
      if (!res.ok) {
        return { ok: false, fields: [], model, ms: Date.now() - t0, error: `HTTP ${res.status}`, errorStatus: res.status, attempts: 1 }
      }
      const json = await res.json().catch(() => null)
      const text: string | undefined = json?.choices?.[0]?.message?.content
      if (!text) return { ok: false, fields: [], model, ms: Date.now() - t0, error: 'empty response', attempts: 1 }

      let parsed: Record<string, { cyrillic?: unknown; iso_date?: unknown; can_read?: unknown; confidence?: unknown; reason?: unknown }>
      try {
        parsed = JSON.parse(text.replace(/^```json\s*|\s*```$/g, '').trim())
      } catch {
        return { ok: false, fields: [], model, ms: Date.now() - t0, error: 'invalid JSON from model', attempts: 1 }
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
      return { ok: true, fields, model, ms: Date.now() - t0, attempts: 1 }
    } catch (e: unknown) {
      const err = e as { name?: string; message?: string }
      if (err?.name === 'AbortError') return { ok: false, fields: [], model, ms: Date.now() - t0, error: 'timeout', errorTimeout: true, attempts: 1 }
      return { ok: false, fields: [], model, ms: Date.now() - t0, error: err?.message ?? 'fetch error', attempts: 1 }
    } finally {
      clearTimeout(timeout)
    }
  }
}

/** Singleton OpenAI vision provider — used ONLY as the resilience fallback in documentFieldReader. */
export const openaiVisionProvider: VisionProvider = new OpenAiVisionProvider()
