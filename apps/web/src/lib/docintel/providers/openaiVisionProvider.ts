/**
 * openaiVisionProvider.ts — an OpenAI vision reader TAUGHT IDENTICALLY to the Gemini reader.
 *
 * It reuses the SAME teaching surfaces as GeminiVisionProvider — `buildPrompt(spec)` (universal
 * rules + ORIENTATION rule + LANGUAGE/script rule + per-doc DOC_READING_RULES) and the same
 * per-field JSON contract — so a GPT-vs-Gemini audit runs through the IDENTICAL pipeline
 * (`readDocument` → orientation pre-step → provider read → language routing → KMU-55/BGN codex →
 * gt-pipeline-bench scoring) with ONLY the vision model swapped. This is the fair comparison.
 *
 * It implements the VisionProvider interface so it can be injected: `readDocument(buf, mime, id,
 * { provider: new OpenAIVisionProvider({ model }) })`. Per ADR-018 it is NOT an acceptance reader;
 * it exists to MEASURE OpenAI honestly and (if it wins on PRINTED docs) to serve as an availability
 * reader (force-reviewed). NEVER trusted on handwriting (every LLM fabricates there).
 */
import type { DocTypeSpec, VisionProvider, VisionReadResult, VisionFieldRead } from '../types'
import { buildPrompt } from './geminiVisionProvider'

/** gpt-5.x + o-series are reasoning models: fixed temperature, use max_completion_tokens. */
const isReasoning = (m: string) => /^o[0-9]|gpt-5/.test(m)

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export interface OpenAIProviderOpts {
  model?: string
  /** max retries on transient 429/5xx before giving up (default 4). */
  maxRetry?: number
}

export class OpenAIVisionProvider implements VisionProvider {
  readonly name = 'openai'
  private readonly model: string
  private readonly maxRetry: number

  constructor(opts: OpenAIProviderOpts = {}) {
    this.model = opts.model || process.env.OPENAI_VISION_MODEL || 'gpt-4.1'
    this.maxRetry = opts.maxRetry ?? 4
  }

  async readFields(
    imageBuffer: Buffer,
    mimeType: string,
    spec: DocTypeSpec,
    opts: { timeoutMs?: number; attemptsPerModel?: number } = {},
  ): Promise<VisionReadResult> {
    const t0 = Date.now()
    const apiKey = (process.env.OPENAI_API_KEY || '').trim()
    if (!apiKey) return { ok: false, fields: [], model: null, ms: 0, error: 'no OPENAI_API_KEY set' }

    const prompt = buildPrompt(spec) // SAME teaching as Gemini (orientation + language + per-doc rules)
    const dataUrl = `data:${mimeType};base64,${imageBuffer.toString('base64')}`
    const allowed = new Set(spec.fields.map((f) => f.field))
    const reasoning = isReasoning(this.model)
    const timeoutMs = opts.timeoutMs ?? 90000
    const deadline = t0 + timeoutMs
    let lastErr = 'unknown'
    let lastStatus: number | undefined
    let lastTimeout = false

    for (let attempt = 0; ; attempt++) {
      const remaining = deadline - Date.now()
      if (remaining < 3000) { lastErr = 'deadline'; break }
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), remaining)
      const body: Record<string, unknown> = {
        model: this.model,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } },
          ],
        }],
        // The prompt already demands a single JSON object; json_object mode enforces valid JSON.
        response_format: { type: 'json_object' },
      }
      if (reasoning) body.max_completion_tokens = Math.max(8192, Number(process.env.OPENAI_MAX_OUTPUT_TOKENS) || 16384)
      else { body.max_tokens = Math.max(8192, Number(process.env.OPENAI_MAX_OUTPUT_TOKENS) || 16384); body.temperature = 0 }

      try {
        const r = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST', signal: ctrl.signal,
          headers: { 'content-type': 'application/json', authorization: 'Bearer ' + apiKey },
          body: JSON.stringify(body),
        })
        const j: any = await r.json()
        if (!r.ok) {
          const msg = j?.error?.message || ''
          lastErr = `HTTP ${r.status} ${j?.error?.code || j?.error?.type || ''}`.trim()
          lastStatus = r.status
          lastTimeout = false
          // adapt once to param-name/temperature errors (model-specific API quirks)
          if (attempt === 0 && /max_tokens|max_completion_tokens/i.test(msg)) {
            // flip the token-param name and retry immediately
            if ('max_tokens' in body) { body.max_completion_tokens = body.max_tokens; delete body.max_tokens }
            else { body.max_tokens = body.max_completion_tokens; delete body.max_completion_tokens }
            clearTimeout(timer); continue
          }
          if (attempt === 0 && /temperature/i.test(msg)) { delete body.temperature; clearTimeout(timer); continue }
          const transient = r.status === 429 || r.status >= 500
          if (transient && attempt < this.maxRetry) {
            clearTimeout(timer)
            await sleep(Math.min(800 * 2 ** attempt, 10000) + Math.floor(Math.random() * 800))
            continue
          }
          clearTimeout(timer)
          break // non-transient or budget spent
        }

        const text = j?.choices?.[0]?.message?.content ?? ''
        clearTimeout(timer)
        let parsed: Record<string, any> | null = null
        try {
          // salvage: strip ```json fences if a model wraps the object
          const cleaned = String(text).replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
          parsed = JSON.parse(cleaned)
        } catch {
          lastErr = 'invalid JSON from model'
          if (attempt < this.maxRetry) { await sleep(500); continue }
          break
        }
        const fields: VisionFieldRead[] = []
        for (const key of Object.keys(parsed || {})) {
          if (!allowed.has(key)) continue
          const v = (parsed as any)[key]
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
        return { ok: true, fields, model: this.model, ms: Date.now() - t0 }
      } catch (e: any) {
        clearTimeout(timer)
        if (e?.name === 'AbortError') { lastErr = 'timeout'; lastTimeout = true; lastStatus = undefined }
        else { lastErr = e?.message ?? 'fetch error'; lastTimeout = false; lastStatus = undefined }
        if (attempt < this.maxRetry) { await sleep(800); continue }
        break
      }
    }
    return { ok: false, fields: [], model: null, ms: Date.now() - t0, error: lastErr, errorStatus: lastStatus, errorTimeout: lastTimeout }
  }
}
