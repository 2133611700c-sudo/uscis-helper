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
import { normalizeGeminiModel } from '@/lib/gemini/model'
import { FALLBACK_MODELS, isDisqualifiedFor, PRIMARY_READER } from '../modelMatrix'
import { readingRulesPromptBlock, isDocReadingRulesEnabled } from '../docReadingRules'
import { withOcrCostMetrics, computeCacheKeySha, sha256Hex, estCostUsdMicros } from '@/lib/v1/ocrCostMetrics'

const GEMINI_PROVIDER_NAME = 'gemini'
// Bump these when buildPrompt() text or the image preprocessing changes, so the
// shadow cache-hit analysis never reuses a key across a prompt/preproc change.
// v2 (2026-06-22): handwritten-field markers + date-distinctness rule + response schema.
const GEMINI_PROMPT_VERSION = 'v2'
// v2 (2026-06-22, R3): Core path now runs preprocessImage BEFORE the read —
// EXIF rotate + UPSCALE small scans (short side →~1500px + mild sharpen) +
// down-cap ≤2048. Different pixels reach the model → invalidate the shadow cache.
const GEMINI_PREPROC_VERSION = 'v2'

// Model order is env-driven so prod can flip models WITHOUT a code redeploy, but
// runtime normalization accepts ONLY the sanctioned chain from modelMatrix. Old
// preview-reader experiments remain in archived reports; they are not active law.
// pro+thinking on a large scan runs ~20-40s → keep timeoutMs high + Vercel maxDuration.
/** The configured primary reader model (ADR-018 model matrix). Exported so
 *  documentFieldReader can detect when a read came from a FALLBACK model —
 *  fallback reads of Cyrillic docs are never released without review. */
export function primaryGeminiModel(): string {
  return normalizeGeminiModel(process.env.GEMINI_MODEL, PRIMARY_READER)
}

function modelFallback(docTypeId?: string): string[] {
  const primary = primaryGeminiModel()
  // PRODUCT CONTRACT (owner, 2026-06-27 — the single Gemini truth): the document/translation
  // reader is gemini-2.5-pro ONLY. On timeout/429/5xx it MUST fail-closed (reader unavailable →
  // final_value=null + review_required), and MUST NEVER silently swap to a weaker model and present
  // that as a Pro read. So the availability fallback chain is OFF BY DEFAULT (strict primary-only).
  // READER_FALLBACK_ENABLED=1 re-enables it for explicit NON-ACCEPTANCE availability use only.
  if (process.env.READER_FALLBACK_ENABLED !== '1') return [primary]
  // ADR-018: source the fallback list from the modelMatrix SINGLE SOURCE OF TRUTH, then DROP any
  // model DISQUALIFIED for this doc class (e.g. flash on certificate-family docs).
  const chain = [...new Set([primary, ...FALLBACK_MODELS])]
  return docTypeId ? chain.filter((m) => !isDisqualifiedFor(m, docTypeId)) : chain
}

export function buildPrompt(spec: DocTypeSpec): string {
  const lines = spec.fields.map((f) => {
    const dateHint = f.kind === 'date' ? ' (also return iso_date YYYY-MM-DD)' : ''
    const nameHint = f.kind === 'name' && spec.script === 'mixed'
      ? ' (this document prints the name in BOTH Cyrillic and the official LATIN romanization, e.g. "ТАРАС/TARAS" and in the MRZ — return the LATIN spelling EXACTLY as printed, it is the controlling spelling; do NOT transliterate it yourself)'
      : ''
    // R1: tell the model WHICH fields are handwritten cursive. The registry marks
    // identity-page fields handwritten:true; without this the model pattern-matches
    // cursive to a common printed word. The flag was previously dropped here.
    const hwHint = f.handwritten ? ' [HANDWRITTEN cursive — read letter by letter]' : ''
    return `- ${f.field} (${f.label_uk})${dateHint}${nameHint}${hwHint}`
  })
  // R1: enumerate the DISTINCT date fields so the model never copies one date into
  // another slot (the verified DOB==date-of-issue bug). Each date is its own location.
  const dateFields = spec.fields.filter((f) => f.kind === 'date')
  const hasHandwritten = spec.fields.some((f) => f.handwritten)
  const dateRule = dateFields.length > 1
    ? `\n- DATES — this document has ${dateFields.length} SEPARATE date fields (${dateFields.map((f) => `${f.field} = ${f.label_uk}`).join('; ')}). Each is a DISTINCT location on the page. Read each date from its OWN place. NEVER copy one date into another date field — a person's date of birth is NOT the date of issue and NOT the date of expiry. If a particular date is not present, leave that field empty (can_read=false); do NOT fill it by reusing another date.`
    : ''
  const handwritingRule = hasHandwritten
    ? `\n- HANDWRITING — fields marked [HANDWRITTEN cursive] are written by hand, not printed. Read them letter by letter; do NOT pattern-match a cursive scrawl to the nearest common name. A handwritten DATE is a sequence of separate digits — read each digit individually (handwritten 1/2/7, 4/9, 3/5/8 are easily confused; pick the digits that form a plausible real date, day 01-31, month 01-12). A handwritten name must still be a REAL Ukrainian name spelled with Ukrainian letters.`
    : ''
  // STAGE 1 (teach the brain): per-document-class reading instructions, grounded in
  // real-doc analysis. Gated; OFF ⇒ prompt unchanged. Appended after the generic rules.
  const docRules = isDocReadingRulesEnabled() ? readingRulesPromptBlock(spec.id) : ''
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
- LANGUAGE — transcribe the Cyrillic EXACTLY as written. These are UKRAINIAN-issued documents: keep Ukrainian letters (і, ї, є, ґ, апостроф) and Ukrainian name/place forms — do NOT convert them to Russian. Errors to AVOID: Тарас→(wrong)Андрей, Тарасович→(wrong)Тимофеевич, Степанівна→(wrong)Петровна, Наталія→(wrong)Елена, Кіровоградської→(wrong)Кировоградской, Вінницької→(wrong)Винницкой, ЗАГС/РАЦС forms must stay as written. Russifying a Ukrainian name or place is a transcription mistake. (Exception: a genuinely Soviet-era document may itself be written in Russian — then transcribe the Russian exactly as written; do NOT Ukrainianize it either. Transcribe the script that is ON the page.)
- ORIENTATION — the photo is very often ROTATED (90° sideways, 180° upside-down, or 270°), e.g. a passport page shot in portrait. You MUST mentally rotate the page until the text is upright, then read every field. NEVER return can_read=false just because the text is sideways or upside-down — rotation is normal and you are expected to handle it. Reading rotated text is required; orientation must not change what you read.
- Read the FULL word, every letter. Never return only a suffix (never "ович" alone).
- Handwritten Ukrainian "Т" and "П" look similar, as do "и/н", "ш/щ", "л/м"; pick the letter that forms a REAL Ukrainian name/place.${dateRule}${handwritingRule}
- ABSENT vs HARD — two different cases, handle them differently:
  • ABSENT (the field is simply NOT written on this document): set can_read=false, cyrillic="". This is CORRECT and expected. NEVER invent an absent value, NEVER infer a typical/default (do NOT assume citizenship "Україна"), NEVER copy a value from another field, NEVER guess a series or a date that isn't there. An empty field beats an invented one.
  • PRESENT BUT HARD (the field IS written but faded/cursive/hard): do NOT give up — return your BEST letter-by-letter reading with a LOW confidence (e.g. 0.3-0.5) and can_read=true. A best-effort read that the human then confirms is far more useful to an 80-year-old than an empty field they must type from scratch. This applies especially to a spelled-out cursive DATE that is clearly on the page — read it (anchor on the year, then day-ordinal + month-word) and return it with low confidence; do NOT return empty just because it is hard. Only return empty when the field is genuinely ABSENT, never when it is merely difficult.
- Do NOT transliterate to Latin yourself. Return the original script (except iso_date).
- Output ONLY the JSON object.${docRules}`
}

// R2: a strict response schema built from the spec so Gemini returns well-formed,
// per-field structured JSON (response_mime_type alone only guarantees "some JSON").
// Eliminates the JSON.parse-fail wasted attempt and enforces the per-field shape.
export function buildResponseSchema(spec: DocTypeSpec): Record<string, unknown> {
  const properties: Record<string, unknown> = {}
  for (const f of spec.fields) {
    const fieldProps: Record<string, unknown> = {
      cyrillic: { type: 'string' },
      can_read: { type: 'boolean' },
      confidence: { type: 'number' },
      reason: { type: 'string' },
    }
    if (f.kind === 'date') fieldProps.iso_date = { type: 'string' }
    properties[f.field] = {
      type: 'object',
      properties: fieldProps,
      required: ['cyrillic', 'can_read', 'confidence'],
    }
  }
  return { type: 'object', properties }
}

async function callGemini(
  model: string,
  apiKey: string,
  imageB64: string,
  mimeType: string,
  prompt: string,
  timeoutMs: number,
  responseSchema?: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; json: any }> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  // SHADOW cost metric: time + emit the external Gemini call (PII-free). The
  // fetch result is returned UNCHANGED — output is byte-identical.
  // requestSha binds the ACTUAL prompt: GEMINI_PROMPT_VERSION is a coarse constant,
  // but the prompt varies by document type / call site. Without this, two same-image
  // calls with different prompts would collapse onto one in-flight dedup result.
  const requestSha = sha256Hex(prompt)
  const cacheKeySha = computeCacheKeySha({
    fileSha256: sha256Hex(imageB64),
    provider: GEMINI_PROVIDER_NAME,
    model,
    promptVersion: GEMINI_PROMPT_VERSION,
    preprocVersion: GEMINI_PREPROC_VERSION,
    requestSha,
  })
  try {
    const res = await withOcrCostMetrics(
      {
        product: 'ocr', route: 'provider:gemini_vision', provider: GEMINI_PROVIDER_NAME,
        model, cacheKeySha, est_cost_usd_micros: estCostUsdMicros(GEMINI_PROVIDER_NAME, model),
        // Gateway (cache/dedup/budget) — no-op pass-through until a flag is ON.
        gateway: {
          fileSha256: sha256Hex(imageB64),
          promptVersion: GEMINI_PROMPT_VERSION,
          preprocVersion: GEMINI_PREPROC_VERSION,
          requestSha,
        },
      },
      () => fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          signal: ctrl.signal,
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: imageB64 } }] }],
            generationConfig: {
              temperature: 0,
              response_mime_type: 'application/json',
              // MEDIA RESOLUTION: the API media_resolution default (MEDIUM) compresses the image into a
              // coarser feature map; a HIGHER value allocates more visual tokens and is CONFIRMED by
              // Google's docs to help small/dense text — relevant to handwriting. (HYPOTHESIS, not proven:
              // that the gemini.google.com app uses HIGH internally — do NOT state as fact.) This setting
              // is APPLIED but its real lift on our docs is PENDING an A/B measurement (medium vs high vs
              // ultra). Override via GEMINI_MEDIA_RESOLUTION. [ai.google.dev/gemini-api/docs/media-resolution]
              media_resolution: process.env.GEMINI_MEDIA_RESOLUTION || 'MEDIA_RESOLUTION_HIGH',
              // Thinking-capable Gemini models spend OUTPUT tokens on
              // internal reasoning BEFORE emitting JSON — at 8192 a dense full-page read hit
              // finishReason=MAX_TOKENS and returned EMPTY (a silent "0 fields" that looked like a
              // misread). maxOutputTokens is a CAP, billed on actual tokens, so raising it is free
              // when unused and prevents truncation. Verified 2026-06-23: 2.5-pro went 0→100% on
              // the passport once the budget was raised. Override with GEMINI_MAX_OUTPUT_TOKENS.
              maxOutputTokens: Math.max(8192, Number(process.env.GEMINI_MAX_OUTPUT_TOKENS) || 16384),
              ...(responseSchema ? { response_schema: responseSchema } : {}),
            },
          }),
        },
      ),
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
    //
    // timeoutMs is the TOTAL budget for THIS read across the whole model/attempt
    // fallback chain — NOT per attempt. Previously each callGemini got the full
    // timeoutMs, so a single page could run 3 models × 2 attempts × 40s = up to
    // 240s; with 4 pages read in parallel that blew the route's 60s maxDuration →
    // the function was killed → ZERO fields (the owner's 4-page passport = "0").
    // Now we cap the chain at a single deadline so N parallel pages finish within
    // the route budget.
    const timeoutMs = opts.timeoutMs ?? 45000
    const deadline = t0 + timeoutMs
    const attempts = opts.attemptsPerModel ?? 2
    const prompt = buildPrompt(spec)
    const responseSchema = buildResponseSchema(spec)
    const imageB64 = imageBuffer.toString('base64')
    const allowed = new Set(spec.fields.map((f) => f.field))
    let lastErr = 'unknown'
    // Honest degradation (P1): remember the last HTTP status / timeout so the
    // failure can be classified into a typed OCR error upstream (not masked as
    // an empty success). Reset to undefined on a non-HTTP outcome.
    let lastStatus: number | undefined
    let lastTimeout = false

    // Exponential backoff + jitter for transient failures on the primary provider.
    // ADR-018-safe: this only lets the PRIMARY survive a transient blip so we get
    // a real primary read instead of immediately falling to a force-reviewed flash;
    // the fallback chain and the force-review gate (documentFieldReader) are unchanged.
    // Knobs (env, sane defaults):
    //   GEMINI_PRIMARY_RETRY_MAX (3) · GEMINI_RETRY_BASE_MS (700) · GEMINI_RETRY_CAP_MS (8000)
    // The old code did `setTimeout(1500); continue` with attemptsPerModel=1 — but `continue`
    // exited the `a < 1` loop, so the primary was NEVER actually retried (it slept 1.5s then
    // fell to flash). That is the root cause of the "every run → flash/BLOCKED" instability.
    const RETRY_BASE_MS = Math.max(100, Number(process.env.GEMINI_RETRY_BASE_MS) || 700)
    const RETRY_CAP_MS = Math.max(RETRY_BASE_MS, Number(process.env.GEMINI_RETRY_CAP_MS) || 8000)
    const PRIMARY_RETRY_MAX = Math.max(0, Number(process.env.GEMINI_PRIMARY_RETRY_MAX ?? 3))
    const PRIMARY = primaryGeminiModel()
    const backoffMs = (n: number) => Math.min(RETRY_BASE_MS * 2 ** n, RETRY_CAP_MS) + Math.floor(Math.random() * RETRY_BASE_MS)

    for (const model of modelFallback(spec.id)) {
      // The PREVIEW primary gets a real transient-retry budget; availability fallbacks keep the
      // caller's small attempt count (they exist only for degraded service, never for quality).
      const maxTransient = model === PRIMARY ? PRIMARY_RETRY_MAX : Math.max(0, attempts - 1)
      let transient = 0
      for (;;) {
        const remaining = deadline - Date.now()
        if (remaining < 3000) { lastErr = 'deadline'; break } // not enough time for another attempt
        let isTransient = false
        try {
          const { ok, status, json } = await callGemini(model, apiKey, imageB64, mimeType, prompt, remaining, responseSchema)
          if (ok) {
            const text = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
            let parsed: Record<string, any> | null
            try {
              parsed = JSON.parse(text)
            } catch {
              lastErr = 'invalid JSON from model'
              parsed = null
              isTransient = true // a malformed emission can clear on a re-read
            }
            if (parsed) {
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
          } else {
            // Surface the Google RPC status (e.g. RESOURCE_EXHAUSTED for a monthly
            // spend cap / hard quota) so the downstream classifier can tell a HARD
            // quota apart from a transient rate limit. Without this, a spend-cap 429
            // is mislabeled OCR_RATE_LIMITED ("try again in a few seconds") and the
            // stack wastes retries on a block that will never clear by waiting.
            const rpcStatus = typeof json?.error?.status === 'string' ? json.error.status : ''
            lastErr = rpcStatus ? `HTTP ${status} ${rpcStatus}` : `HTTP ${status}`
            lastStatus = status
            lastTimeout = false
            // RESOURCE_EXHAUSTED / hard quota will NOT recover on retry — straight to next model.
            const isHardQuota = /RESOURCE_EXHAUSTED|QUOTA/.test(rpcStatus)
            isTransient = !isHardQuota && (status === 429 || (status >= 500 && status <= 599))
            if (!isTransient) break // hard-quota 429 / 4xx / other → next model
          }
        } catch (e: any) {
          if (e?.name === 'AbortError') { lastErr = 'timeout'; lastTimeout = true; lastStatus = undefined }
          else { lastErr = e?.message ?? 'fetch error'; lastTimeout = false; lastStatus = undefined }
          isTransient = true // a network blip / abort is worth a bounded retry
        }
        if (!isTransient) break
        if (transient >= maxTransient) break // this model's transient budget spent → next model
        const wait = backoffMs(transient)
        if ((deadline - Date.now()) < wait + 3000) break // no time to wait + retry within budget
        transient++
        await new Promise((r) => setTimeout(r, wait))
      }
    }
    return { ok: false, fields: [], model: null, ms: Date.now() - t0, error: lastErr, errorStatus: lastStatus, errorTimeout: lastTimeout }
  }
}

/** Default singleton provider. Swap here (or inject) to change vendor. */
export const defaultVisionProvider: VisionProvider = new GeminiVisionProvider()
