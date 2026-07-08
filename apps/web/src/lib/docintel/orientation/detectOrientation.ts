/**
 * docintel/orientation/detectOrientation — CONTENT-BASED upright detection by DIRECT COMPARISON.
 *
 * WHY this replaces the old detectCw ("by how many degrees CW?"): proven UNRELIABLE on real owner
 * docs (2026-06-22) — it false-negatived a sideways military ID (said 0°) and false-positived an
 * already-upright birth cert (said 270°, would have BROKEN it). Root cause: EXIF orientation is
 * unreliable (the military ID and birth cert carry the SAME EXIF flag 6, but only one needs it),
 * and "how many degrees" is a hard question for a VLM on a single thumbnail.
 *
 * METHOD: render the SAME page at all four rotations (0/90/180/270° CW) into ONE 2×2 grid and ask
 * the model — in a SINGLE call — which cell is upright. Direct comparison ("which of these reads
 * normally?") is far more reliable than absolute-angle estimation; it was 3/3 correct + STABLE
 * across reruns on the real docs (passport 0°, military 0° post-EXIF, birth 270° post-EXIF).
 * The chosen cell's rotation IS the correction to apply to the input to make it upright.
 *
 * Run AFTER preprocessImage (EXIF auto-rotate + downscale): this corrects WHATEVER orientation
 * results, including EXIF mistakes. Fail-open: any error → correction 0° (no rotation), never throws.
 */
import sharp from 'sharp'
import { withOcrCostMetrics, computeCacheKeySha, sha256Hex, estCostUsdMicros } from '@/lib/v1/ocrCostMetrics'
import { getDocTypeSpec } from '../documentRegistry'
import { DOC_READING_RULES } from '../docReadingRules'

export type Cw = 0 | 90 | 180 | 270

const GEMINI_URL = (model: string, key: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'

/**
 * TRUTHFULNESS FIX (2026-07-07, One Brain priority #1): enabled ≠ attempted ≠ measured ≠ trusted ≠
 * final. A feature flag being ON only means the code branch is PERMITTED to run — it is NOT proof
 * any provider was actually called, responded, or produced a usable answer. Before this fix,
 * `documentFieldReader.ts` computed `contentOrientRan: isContentOrientEnabled()` — i.e. it reported
 * "orientation ran" whenever the FLAG was on, even when the Gemini API key was missing and the
 * orientation block never executed at all. That silently produced `orientation_status: 'upright'`
 * (medium confidence) for a document that was NEVER actually checked — a direct violation of this
 * module's own law ("never claim a field measured when it is not").
 *
 * GUARDRAILS (owner spec, 2026-07-07):
 *  1. Only the orientation functions in THIS file may mutate a `RawOrientTelemetry` accumulator —
 *     callers (documentFieldReader.ts) only ever READ the normalized result.
 *  2. Exactly ONE function, `normalizeOrientationTelemetry()`, converts raw accumulated facts into
 *     the final `OrientationTelemetry` — called once, at the boundary in `readDocument()`. No other
 *     code site is allowed to compute a `status`/`measured`/`trusted` value independently.
 *  3. `angle` is null unless `measured` is true; a provider slot (`primaryProvider`/
 *     `fallbackProvider`) is null unless THAT SPECIFIC provider produced a usable result — an
 *     attempt alone (even a failed one) never earns the provider name in these fields.
 */
export interface RawOrientTelemetry {
  primaryAttempted: boolean
  primarySucceeded: boolean
  /** Short, PII-free classification (e.g. 'network_error' | 'http_4xx' | 'http_5xx' |
   *  'invalid_json' | 'unrecognized_position'); never a raw exception message or request body. */
  primaryErrorCode: string | null
  fallbackAttempted: boolean
  fallbackSucceeded: boolean
  fallbackErrorCode: string | null
  /** At least one provider returned a decodable response, even if unusable — distinguishes a
   *  hard failure (nothing ever answered) from a soft one (something answered, just not usable). */
  anyResponseReceived: boolean
  /** The raw detected angle, BEFORE the "only trust it if measured" gate is applied downstream. */
  angle: Cw | null
}

export function newRawOrientTelemetry(): RawOrientTelemetry {
  return {
    primaryAttempted: false, primarySucceeded: false, primaryErrorCode: null,
    fallbackAttempted: false, fallbackSucceeded: false, fallbackErrorCode: null,
    anyResponseReceived: false, angle: null,
  }
}

export interface OrientationTelemetry {
  enabled: boolean
  attempted: boolean
  measured: boolean
  /** True only when the PRIMARY (Gemini) provider produced the measurement — matches ADR-018:
   *  a fallback read is availability-only and is NEVER treated as an acceptance-grade result. */
  trusted: boolean
  /** Always true once normalized — this IS the final determination for this read, not an
   *  intermediate confirm-step's own partial tally. */
  final: boolean

  primaryProvider: 'gemini' | 'openai' | null
  primaryAttempted: boolean
  primaryMeasured: boolean
  primaryErrorCode: string | null

  fallbackProvider: 'openai' | 'gemini' | null
  fallbackAttempted: boolean
  fallbackMeasured: boolean
  fallbackErrorCode: string | null

  angle: Cw | null
  confidence: number | null
  status:
    | 'disabled'
    | 'not_measured_no_provider'
    | 'attempted_failed'
    | 'measured_upright'
    | 'measured_rotated'
    | 'uncertain_low_confidence'
    | 'fallback_measured'
}

/**
 * THE single point of truth converting raw provider facts into the reportable orientation status.
 * Pure function; called exactly once per read, from `readDocument()`. See guardrail #2 above.
 */
export function normalizeOrientationTelemetry(raw: RawOrientTelemetry, enabled: boolean): OrientationTelemetry {
  const attempted = raw.primaryAttempted || raw.fallbackAttempted
  const primaryMeasured = raw.primarySucceeded
  const fallbackMeasured = raw.fallbackSucceeded
  const measured = primaryMeasured || fallbackMeasured
  const angle = measured ? raw.angle : null

  let status: OrientationTelemetry['status']
  if (!enabled) status = 'disabled'
  else if (!attempted) status = 'not_measured_no_provider'
  else if (primaryMeasured) status = angle === 0 ? 'measured_upright' : 'measured_rotated'
  else if (fallbackMeasured) status = 'fallback_measured'
  else if (raw.anyResponseReceived) status = 'uncertain_low_confidence'
  else status = 'attempted_failed'

  return {
    enabled, attempted, measured, trusted: primaryMeasured, final: true,
    primaryProvider: primaryMeasured ? 'gemini' : null,
    primaryAttempted: raw.primaryAttempted, primaryMeasured, primaryErrorCode: raw.primaryErrorCode,
    fallbackProvider: fallbackMeasured ? 'openai' : null,
    fallbackAttempted: raw.fallbackAttempted, fallbackMeasured, fallbackErrorCode: raw.fallbackErrorCode,
    angle, confidence: measured ? (primaryMeasured ? 0.7 : 0.5) : null,
    status,
  }
}

/** ADR-018: Gemini stays the primary orientation reader. This is an AVAILABILITY-ONLY fallback —
 *  used only when the Gemini call itself fails (network error / non-2xx) or returns a response
 *  that does not decode to one of the expected answers (malformed/non-conforming JSON), never to
 *  second-guess a Gemini answer that DID decode. Live-verified 2026-07-06 on
 *  birth_cert_handwritten_01.jpg while Gemini was
 *  blocked by a project/key tier limit (429 free_tier_requests limit:0): OpenAI's gpt-4.1 on the
 *  same grid image returned the same cw=270 documented as proven-correct for this file since
 *  2026-06-27 (3/3 stable runs), independently confirmed by direct visual inspection. */
function openAiApiKeyFromEnv(env: Record<string, string | undefined> = process.env): string | null {
  return env.OPENAI_API_KEY || null
}

function openAiVisionModelFromEnv(env: Record<string, string | undefined> = process.env): string {
  return env.OPENAI_VISION_MODEL || 'gpt-4.1'
}

/** Minimal OpenAI vision call returning the raw JSON text of choices[0].message.content, or null
 *  on any failure. Fail-open, mirrors the Gemini call sites' contract exactly. */
async function callOpenAiVisionJson(
  prompt: string, imageBuffer: Buffer, apiKey: string, model: string, timeoutMs: number,
): Promise<string | null> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const isReasoning = /^(gpt-5|o[0-9])/.test(model)
    const res = await fetch(OPENAI_URL, {
      method: 'POST', signal: ctrl.signal,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBuffer.toString('base64')}` } },
          ],
        }],
        response_format: { type: 'json_object' },
        ...(isReasoning ? { max_completion_tokens: 64 } : { max_tokens: 64, temperature: 0 }),
      }),
    })
    if (!res.ok) return null
    const j = await res.json()
    return j?.choices?.[0]?.message?.content ?? null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

interface OpenAiFallbackOpts {
  /** Injectable for tests; defaults to a real fetch-backed call using env credentials. */
  openaiCaller?: (prompt: string, imageBuffer: Buffer, apiKey: string, model: string, timeoutMs: number) => Promise<string | null>
  openaiApiKey?: string | null
  openaiModel?: string
  /** Guardrail #1: the ONLY way callers observe orientation facts — orientation functions in this
   *  file mutate it directly; nobody outside this file may write to it. */
  telemetry?: RawOrientTelemetry
}

async function fallbackPosViaOpenAi(
  imageBuffer: Buffer, prompt: string, opts: OpenAiFallbackOpts, timeoutMs: number,
): Promise<Cw | null> {
  const apiKey = opts.openaiApiKey ?? openAiApiKeyFromEnv()
  if (!apiKey) return null // no key ⇒ never attempted, not a failure
  if (opts.telemetry) opts.telemetry.fallbackAttempted = true
  const caller = opts.openaiCaller ?? callOpenAiVisionJson
  const model = opts.openaiModel ?? openAiVisionModelFromEnv()
  const text = await caller(prompt, imageBuffer, apiKey, model, timeoutMs)
  if (!text) {
    if (opts.telemetry) opts.telemetry.fallbackErrorCode = opts.telemetry.fallbackErrorCode ?? 'network_or_http_error'
    return null
  }
  if (opts.telemetry) opts.telemetry.anyResponseReceived = true
  let pos: unknown = null
  try { pos = JSON.parse(text)?.pos } catch {
    if (opts.telemetry) opts.telemetry.fallbackErrorCode = opts.telemetry.fallbackErrorCode ?? 'invalid_json'
    return null
  }
  const cw = positionToCorrectionCw(pos)
  if (cw === null) {
    if (opts.telemetry) opts.telemetry.fallbackErrorCode = opts.telemetry.fallbackErrorCode ?? 'unrecognized_position'
  } else if (opts.telemetry) {
    opts.telemetry.fallbackSucceeded = true
    opts.telemetry.angle = cw
  }
  return cw
}

async function fallbackSideViaOpenAi(
  imageBuffer: Buffer, prompt: string, opts: OpenAiFallbackOpts, timeoutMs: number,
): Promise<'left' | 'right' | null> {
  const apiKey = opts.openaiApiKey ?? openAiApiKeyFromEnv()
  if (!apiKey) return null
  if (opts.telemetry) opts.telemetry.fallbackAttempted = true
  const caller = opts.openaiCaller ?? callOpenAiVisionJson
  const model = opts.openaiModel ?? openAiVisionModelFromEnv()
  const text = await caller(prompt, imageBuffer, apiKey, model, timeoutMs)
  if (!text) {
    if (opts.telemetry) opts.telemetry.fallbackErrorCode = opts.telemetry.fallbackErrorCode ?? 'network_or_http_error'
    return null
  }
  if (opts.telemetry) opts.telemetry.anyResponseReceived = true
  let side: unknown = null
  try { side = JSON.parse(text)?.side } catch { return null }
  return normalizeSide(side)
}

/** Grid cell → the clockwise rotation rendered in that cell (= the correction if that cell is upright). */
const CELLS: Array<{ pos: string; cw: Cw }> = [
  { pos: 'top-left', cw: 0 },
  { pos: 'top-right', cw: 90 },
  { pos: 'bottom-left', cw: 180 },
  { pos: 'bottom-right', cw: 270 },
]

// Sparse certificate classes that need the extra rotation backstop.
const ROTATION_BACKSTOP_DOC_TYPES = new Set([
  'ua_marriage_certificate',
  'ua_divorce_certificate',
])

const TESSERACT_ORIENT_MIN_CONF = Number(process.env.TESSERACT_ORIENT_MIN_CONF) || 2.0
const TESSERACT_ZERO_CONFIRM_MIN_CONF = Number(process.env.TESSERACT_ZERO_CONFIRM_MIN_CONF) || 2.5
const TESSERACT_ZERO_CONFIRM_GAP = Number(process.env.TESSERACT_ZERO_CONFIRM_GAP) || 0.25

/** Map a model's chosen grid position to the correction angle (pure; null when unrecognized). */
export function positionToCorrectionCw(pos: unknown): Cw | null {
  if (typeof pos !== 'string') return null
  const cell = CELLS.find((c) => c.pos === pos.trim().toLowerCase())
  return cell ? cell.cw : null
}

/** Normalize a model's {"side":...} answer the same way positionToCorrectionCw normalizes
 *  {"pos":...} — case/whitespace should never cause a silent null (found live 2026-07-06:
 *  a successful, non-erroring Gemini call still fell through to null here because this sibling
 *  parser did a bare strict-equals with no trim/lowercase). */
export function normalizeSide(side: unknown): 'left' | 'right' | null {
  if (typeof side !== 'string') return null
  const s = side.trim().toLowerCase()
  return s === 'left' || s === 'right' ? s : null
}

function buildDocOrientationHint(docTypeId?: string | null): string {
  if (!docTypeId) return ''
  const spec = getDocTypeSpec(docTypeId)
  const rules = DOC_READING_RULES[docTypeId]
  const hints: string[] = []
  if (spec?.title_en) hints.push(`Document class: ${spec.title_en}.`)
  if (spec?.vision_anchor) {
    hints.push(`Choose the rotation where the ${spec.vision_anchor} anchor reads naturally and the page layout makes sense.`)
  }
  const orientRule = rules?.rules.find((r) => /rotated|upright|booklet|identity page/i.test(r)) ?? rules?.rules[0]
  if (orientRule) hints.push(`Layout cue: ${orientRule}`)
  return hints.join(' ')
}

function shouldTrustOsdForDocType(docTypeId?: string | null): boolean {
  return !isHandwrittenDocType(docTypeId)
}

function isHandwrittenDocType(docTypeId?: string | null): boolean {
  if (!docTypeId) return false
  const spec = getDocTypeSpec(docTypeId)
  return spec?.fields.some((f) => f.handwritten) ?? false
}

function isReliableCyrillicOsd(osd: OsdOrientation | null): boolean {
  if (!osd || typeof osd.cw !== 'number' || typeof osd.confidence !== 'number') return false
  return osd.confidence >= 6 && typeof osd.script === 'string' && /cyrillic/i.test(osd.script)
}

function buildOrientationPrompt(docTypeId?: string | null): string {
  const hint = buildDocOrientationHint(docTypeId)
  return (
    'This image is a 2x2 grid showing the SAME identity document at four rotations: ' +
    'TOP-LEFT = original, TOP-RIGHT = rotated 90° clockwise, BOTTOM-LEFT = 180°, ' +
    'BOTTOM-RIGHT = 270° clockwise. Exactly ONE shows the document UPRIGHT: header/printed text ' +
    'horizontal and left-to-right, any face photo upright. Which one? Answer ONLY JSON ' +
    '{"pos":"top-left"|"top-right"|"bottom-left"|"bottom-right"}.' +
    (hint ? ` ${hint}` : '')
  )
}

function buildRotationBackstopHint(docTypeId?: string | null): string {
  if (!docTypeId || !ROTATION_BACKSTOP_DOC_TYPES.has(docTypeId)) return ''
  return (
    'Sparse handwritten layout backstop: do not over-weight blank margins. Choose the rotation ' +
    'where the document header stays at the top, the main handwritten lines read naturally ' +
    'top-to-bottom, and the sideways or upside-down variant is rejected even if the page has ' +
    'large empty borders.'
  )
}

/** Build a 2×2 grid (each cell = the page at one rotation) as a JPEG buffer. */
export async function buildOrientationGrid(buffer: Buffer, cellPx = 480, padPx = 10): Promise<Buffer> {
  const side = cellPx * 2 + padPx * 3
  const tiles = await Promise.all(
    CELLS.map(async (c) => ({
      input: await sharp(buffer).rotate(c.cw).resize(cellPx, cellPx, { fit: 'inside', background: '#ffffff' }).jpeg().toBuffer(),
      top: c.pos.startsWith('top') ? padPx : padPx * 2 + cellPx,
      left: c.pos.endsWith('left') ? padPx : padPx * 2 + cellPx,
    })),
  )
  return sharp({ create: { width: side, height: side, channels: 3, background: '#dddddd' } })
    .composite(tiles).jpeg({ quality: 85 }).toBuffer()
}

/**
 * Detect the clockwise correction that makes `buffer` upright (0/90/180/270), or null if the model
 * could not decide / the call failed. ONE paid Gemini call. Fail-open (returns null, never throws).
 */
export async function detectUprightCw(
  buffer: Buffer,
  apiKey: string,
  model: string,
  timeoutMs = 20_000,
  opts: { docTypeId?: string | null } & OpenAiFallbackOpts = {},
): Promise<Cw | null> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  const prompt = buildOrientationPrompt(opts.docTypeId)
  let grid: Buffer
  try {
    grid = await buildOrientationGrid(buffer)
  } catch {
    clearTimeout(timer)
    return null
  }
  // TRUTHFULNESS FIX: an empty/missing Gemini key is NOT a "primary attempt that failed" — it is
  // no attempt at all. Skip straight to the fallback (which itself no-ops honestly if OpenAI is
  // also unavailable) instead of wasting a doomed fetch and mislabeling the outcome.
  if (!apiKey) {
    clearTimeout(timer)
    return await fallbackPosViaOpenAi(grid, prompt, opts, timeoutMs)
  }
  if (opts.telemetry) opts.telemetry.primaryAttempted = true
  try {
    const gridB64 = grid.toString('base64')
    const gridSha256 = sha256Hex(gridB64)
    const requestSha = sha256Hex(prompt)
    const cacheKeySha = computeCacheKeySha({
      fileSha256: gridSha256, provider: 'gemini', model,
      promptVersion: 'orient_grid_v1', preprocVersion: 'grid2x2_v1', requestSha,
    })
    const res = await withOcrCostMetrics(
      {
        product: 'ocr', route: 'provider:gemini_orient_grid', provider: 'gemini',
        model, cacheKeySha, est_cost_usd_micros: estCostUsdMicros('gemini', model),
        // Gateway (dedup/budget; cache substitution stays a no-op until a codec is added —
        // task #73 note: matches every other provider call site in this codebase today, none
        // of which supply one either). No-op pass-through until an OCR_* flag is turned on.
        gateway: {
          fileSha256: gridSha256, promptVersion: 'orient_grid_v1',
          preprocVersion: 'grid2x2_v1', requestSha,
        },
      },
      () => fetch(GEMINI_URL(model, apiKey), {
        method: 'POST', signal: ctrl.signal, headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: 'image/jpeg', data: gridB64 } }] }],
          generationConfig: { temperature: 0, response_mime_type: 'application/json' },
        }),
      }),
    )
    if (!res.ok) {
      if (opts.telemetry) opts.telemetry.primaryErrorCode = opts.telemetry.primaryErrorCode ?? (res.status >= 500 ? 'http_5xx' : 'http_4xx')
      return await fallbackPosViaOpenAi(grid, prompt, opts, timeoutMs)
    }
    const j = await res.json()
    let pos: unknown = null
    try { pos = JSON.parse(j?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}')?.pos } catch {
      if (opts.telemetry) opts.telemetry.primaryErrorCode = opts.telemetry.primaryErrorCode ?? 'invalid_json'
      return await fallbackPosViaOpenAi(grid, prompt, opts, timeoutMs)
    }
    if (opts.telemetry) opts.telemetry.anyResponseReceived = true
    const cw = positionToCorrectionCw(pos)
    if (cw === null) {
      if (opts.telemetry) opts.telemetry.primaryErrorCode = opts.telemetry.primaryErrorCode ?? 'unrecognized_position'
    } else if (opts.telemetry) {
      opts.telemetry.primarySucceeded = true
      opts.telemetry.angle = cw
    }
    return cw
  } catch {
    if (opts.telemetry) opts.telemetry.primaryErrorCode = opts.telemetry.primaryErrorCode ?? 'network_error'
    return await fallbackPosViaOpenAi(grid, prompt, opts, timeoutMs)
  } finally {
    clearTimeout(timer)
  }
}

/** K-sample orientation vote count: env ORIENT_VOTE_RUNS, default 3, clamp 1..5. =1 ⇒ single detect. */
export function orientVoteRuns(env: Record<string, string | undefined> = process.env): number {
  const k = Number(env.ORIENT_VOTE_RUNS)
  return Number.isFinite(k) && k >= 1 ? Math.min(5, Math.floor(k)) : 3
}

export interface OsdOrientation {
  cw: Cw | null
  confidence: number | null
  script?: string | null
  scriptConfidence?: number | null
}

/**
 * INCIDENT GUARD (2026-07-08, T1.1 real-doc testing): tesseract.js's Node worker cannot run on
 * Vercel's serverless build — the platform's file-tracing does not bundle
 * `tesseract.js`'s worker-thread script, so `createWorker`/`.detect()` fails with
 * `Cannot find module '.../worker-script/node/index.js'` as an UNCAUGHT EXCEPTION (not a
 * rejected promise — the try/catch below does NOT catch it, confirmed live: a real Preview
 * request hung until the platform's maxDuration killed it, 504 FUNCTION_INVOCATION_TIMEOUT at
 * ~120-245s, with the crash happening ~674ms into the request, long before any Gemini call).
 * This predates the 2026-07-07 orientation-truthfulness fix (verified via `git show 862a18e~1`)
 * — it was always broken on Vercel, just never previously exercised end-to-end against a real
 * deployment with a real document.
 *
 * FIX: never invoke tesseract.js in an environment where its worker script cannot load. `VERCEL`
 * is set by the platform on every deployment (Preview AND Production — same build, same bug), so
 * default OFF there. `TESSERACT_OSD_ENABLED` is an explicit escape hatch for once the bundling
 * gap is actually fixed (e.g. via next.config `outputFileTracingIncludes`) — until proven fixed
 * on a live deployment, do not flip it.
 *
 * TRUTHFULNESS: this is honest by construction, not a new claim to guard. OSD is one advisory
 * signal `detectUprightCwVotedMeta` folds into its vote — it already treats a null OSD result
 * (previously: "OSD failed/unavailable") as "fall through to the Gemini/OpenAI vote", never as
 * "upright". Skipping it here produces the exact same `null`, so no telemetry field changes
 * meaning — `OrientationTelemetry` never claimed anything about tesseract specifically.
 */
export function isTesseractOsdRuntimeSafe(env: Record<string, string | undefined> = process.env): boolean {
  if (env.TESSERACT_OSD_ENABLED === '1') return true
  if (env.TESSERACT_OSD_ENABLED === '0') return false
  return env.VERCEL !== '1'
}

async function detectTesseractOrientation(buffer: Buffer): Promise<OsdOrientation | null> {
  if (!isTesseractOsdRuntimeSafe()) return null
  // GUARD (found 2026-07-07 while fixing orientation truthfulness): tesseract.js's native worker
  // can fail on an undecodable buffer via an UNCAUGHT worker 'error' event rather than a rejected
  // promise — a try/catch around `api.detect()` does NOT catch it, crashing the process. This
  // never surfaced before because the caller only reached here when a real Gemini key was also
  // present; now that orientToUpright() always runs (the truthfulness fix), any caller passing a
  // non-image placeholder buffer (several existing unit tests use `Buffer.from('x')`) would hit
  // it. Sanity-check the buffer is actually decodable BEFORE handing it to tesseract; sharp is a
  // JS-level, catchable failure for the same class of bad input.
  try {
    await sharp(buffer).metadata()
  } catch {
    return null
  }
  try {
    const mod = await import('tesseract.js')
    const api = ((mod as { default?: { detect?: (image: Buffer) => Promise<any> } }).default ?? mod) as {
      detect?: (image: Buffer) => Promise<any>
    }
    if (!api.detect) return null
    const res = await api.detect(buffer)
    const data = (res as { data?: any } | null | undefined)?.data ?? res
    const cw = data?.orientation_degrees
    return {
      cw: cw === 0 || cw === 90 || cw === 180 || cw === 270 ? (cw as Cw) : null,
      confidence: typeof data?.orientation_confidence === 'number' ? data.orientation_confidence : null,
      script: typeof data?.script === 'string' ? data.script : null,
      scriptConfidence: typeof data?.script_confidence === 'number' ? data.script_confidence : null,
    }
  } catch {
    return null
  }
}

/** Reject an OSD reading whose script call confidently names a non-Cyrillic script (e.g. it
 *  misread mixed print+cursive Cyrillic as "Japanese"/"Katakana"). No script field ⇒ don't
 *  reject (older/mocked detectors omit it; this must stay permissive for those). */
function isPlausibleOsdScript(osd: OsdOrientation | null): boolean {
  if (!osd || typeof osd.script !== 'string') return true
  return /cyrillic/i.test(osd.script)
}

async function confirmUprightByOsdCandidates(
  buffer: Buffer,
  detector: (b: Buffer) => Promise<OsdOrientation | null>,
): Promise<Cw | null> {
  const zeroCandidates: Array<{ cw: Cw; confidence: number }> = []
  for (const cw of [0, 90, 180, 270] as const) {
    // GUARD (2026-07-07, orientation truthfulness fix): an undecodable buffer makes sharp throw
    // here (not just tesseract) — this branch now runs unconditionally whenever a caller reaches
    // it (previously shielded by the removed outer Gemini-key gate), so it must fail closed itself
    // instead of relying on the caller to have pre-validated the image.
    let candidate: Buffer
    try {
      candidate = cw === 0 ? buffer : await sharp(buffer).rotate(cw).toBuffer()
    } catch {
      continue
    }
    const detected = await detector(candidate)
    if (detected?.cw === 0 && typeof detected.confidence === 'number' && isPlausibleOsdScript(detected)) {
      zeroCandidates.push({ cw, confidence: detected.confidence })
    }
  }
  if (zeroCandidates.length === 0) return null
  zeroCandidates.sort((a, b) => b.confidence - a.confidence)
  if (zeroCandidates.length === 1) return zeroCandidates[0].cw
  const best = zeroCandidates[0]
  const second = zeroCandidates[1]
  const gap = best.confidence > 0 ? (best.confidence - second.confidence) / best.confidence : 0
  return gap >= TESSERACT_ZERO_CONFIRM_GAP ? best.cw : null
}

/** Majority-fold K orientation detections (pure). A correction wins only on a STRICT majority of
 *  `runs` (bestCount*2 > runs ⇒ ≥2/3, ≥3/5); no majority ⇒ null (do NOT rotate on a split — a wrong
 *  rotate breaks geometry, and the VLM mentally rotates the main read anyway). nulls don't vote. */
export function foldOrientationVotes(votes: Array<Cw | null>, runs: number): Cw | null {
  const count = new Map<Cw, number>()
  for (const v of votes) if (v !== null) count.set(v, (count.get(v) ?? 0) + 1)
  let best: Cw | null = null, bestN = 0
  for (const [cw, n] of count) if (n > bestN) { bestN = n; best = cw }
  return best !== null && bestN * 2 > runs ? best : null
}

/**
 * Detect the upright correction by VOTING the grid detector K times (research-backed
 * self-consistency: the single grid call flips e.g. 0↔270 on an ambiguous two-page spread; a
 * majority over K stabilizes it). runs=1 ⇒ a single detect (back-compat). Sampler injectable for tests.
 */
export async function detectUprightCwVotedMeta(
  buffer: Buffer, apiKey: string, model: string,
  opts: {
    runs?: number
    sampler?: (b: Buffer) => Promise<Cw | null>
    docTypeId?: string | null
    sparseScorer?: (b: Buffer) => Promise<number>
    layoutScorer?: (b: Buffer) => Promise<LayoutScore[]>
    osdDetector?: (b: Buffer) => Promise<OsdOrientation | null>
    /** Guardrail #1: raw accumulator only orientation functions may write to. */
    telemetry?: RawOrientTelemetry
  } = {},
): Promise<OrientVoteMeta> {
  const runs = opts.runs ?? orientVoteRuns()
  const telemetry = opts.telemetry
  const sample = opts.sampler ?? ((b: Buffer) => detectUprightCw(b, apiKey, model, 20_000, { docTypeId: opts.docTypeId, telemetry }))
  const sparseScorer = opts.sparseScorer ?? ((b: Buffer) => scoreSparseLayout(b, 0.15))
  const layoutScorer = opts.layoutScorer ?? ((b: Buffer) => scoreHandwrittenLayout(b, 0.15))
  const osdDetector = opts.osdDetector ?? detectTesseractOrientation
  const handwritten = isHandwrittenDocType(opts.docTypeId)
  const handwrittenLayoutBackstop = handwritten && ROTATION_BACKSTOP_DOC_TYPES.has(opts.docTypeId ?? '')

  const osd = await osdDetector(buffer).catch(() => null)
  const osdCw = osd?.cw ?? null
  const osdConfidence = osd?.confidence ?? null
  const trustOsd = shouldTrustOsdForDocType(opts.docTypeId)
  if (handwritten && isReliableCyrillicOsd(osd) && osdCw !== null) return { cw: osdCw, layoutBackstopUsed: null }
  if (handwritten) {
    const zeroConfirm = await confirmUprightByOsdCandidates(buffer, osdDetector)
    if (zeroConfirm !== null) return { cw: zeroConfirm, layoutBackstopUsed: null }
  }
  if (!handwritten && typeof osdConfidence === 'number' && osdConfidence < TESSERACT_ZERO_CONFIRM_MIN_CONF) {
    const zeroConfirm = await confirmUprightByOsdCandidates(buffer, osdDetector)
    if (zeroConfirm !== null) return { cw: zeroConfirm, layoutBackstopUsed: null }
  }
  if (trustOsd && osdCw !== null && typeof osdConfidence === 'number' && osdConfidence >= TESSERACT_ORIENT_MIN_CONF) {
    return { cw: osdCw, layoutBackstopUsed: null }
  }

  if (runs <= 1) {
    const single = await sample(buffer)
    if (!handwritten) return { cw: single, layoutBackstopUsed: null }
    // BUG FIX (2026-07-06, live-verified on the reference handwritten birth cert with the Gemini
    // primary forced unavailable): this confirm must compare the buffer AT THE VOTE'S CHOSEN
    // ROTATION against that +90 — it was comparing the RAW, un-rotated buffer against raw+90
    // regardless of what the vote said. For a document needing a large correction (e.g. 270°),
    // NEITHER raw (0°) nor raw+90 (90°) is upright, so the model's answer to that comparison is
    // noise that can silently overwrite an already-correct vote (reproduced: votes correctly
    // folded to 270, this check then flipped it to (270+90)%360=0 — a fully wrong, unrotated
    // output). Rotating the buffer to the vote's guess first makes the comparison meaningful again
    // ("is my current guess upright, or is guess+90 upright") and matches what the return value
    // arithmetic below already assumed.
    const singleRotated = single !== null && single !== 0 ? await sharp(buffer).rotate(single).toBuffer() : buffer
    const adjacent90 = await confirmUprightVsAdjacent90(singleRotated, apiKey, model, 20_000, { docTypeId: opts.docTypeId, osdDetector, telemetry })
    if (adjacent90 === 'candidate') return { cw: single, layoutBackstopUsed: null }
    if (adjacent90 === 'flipped') return { cw: (((single ?? 0) + 90) % 360) as Cw, layoutBackstopUsed: null }
    if (!handwrittenLayoutBackstop) return { cw: null, layoutBackstopUsed: null }
    const layoutScores = await layoutScorer(buffer).catch(() => [])
    return { cw: chooseHandwrittenLayoutRotation(layoutScores, single), layoutBackstopUsed: 'handwritten_layout' }
  }
  const votes: Array<Cw | null> = []
  for (let i = 0; i < runs; i++) {
    try { votes.push(await sample(buffer)) } catch { votes.push(null) }
    if (orientationSettled(votes, runs)) break // COST: stop once the angle is decided (≥2 agree).
  }
  const folded = foldOrientationVotes(votes, runs)
  if (handwritten) {
    // Same fix as the runs<=1 branch above: rotate to the vote's guess before confirming.
    const foldedRotated = folded !== null && folded !== 0 ? await sharp(buffer).rotate(folded).toBuffer() : buffer
    const adjacent90 = await confirmUprightVsAdjacent90(foldedRotated, apiKey, model, 20_000, { docTypeId: opts.docTypeId, osdDetector, telemetry })
    if (adjacent90 === 'candidate') return { cw: folded, layoutBackstopUsed: null }
    if (adjacent90 === 'flipped') {
      const base = folded ?? 0
      return { cw: ((base + 90) % 360) as Cw, layoutBackstopUsed: null }
    }
    // Handwritten docs need a stricter policy: only the class-specific handwritten layout
    // backstop may still override the fold. Other handwritten classes must abstain here.
    if (!handwrittenLayoutBackstop) return { cw: null, layoutBackstopUsed: null }
    const layoutScores = await layoutScorer(buffer).catch(() => [])
    return { cw: chooseHandwrittenLayoutRotation(layoutScores, folded), layoutBackstopUsed: 'handwritten_layout' }
  }
  if (folded === null && opts.docTypeId && ROTATION_BACKSTOP_DOC_TYPES.has(opts.docTypeId)) {
    const sparseScores: Array<{ cw: Cw; score: number }> = []
    for (const cw of [0, 90, 180, 270] as const) {
      const rotated = cw === 0 ? buffer : await sharp(buffer).rotate(cw).toBuffer()
      sparseScores.push({ cw, score: await sparseScorer(rotated).catch(() => 0) })
    }
    const [best, second] = sparseScores.sort((a, b) => b.score - a.score)
    const gap = best.score > 0 ? (best.score - second.score) / best.score : 0
    if (gap >= 0.12) return { cw: best.cw, layoutBackstopUsed: 'sparse_layout' }
  }
  if (folded === null || !opts.docTypeId || !ROTATION_BACKSTOP_DOC_TYPES.has(opts.docTypeId) || folded !== 180) {
    return { cw: folded, layoutBackstopUsed: null }
  }
  const candidateBuffer = await sharp(buffer).rotate(180).toBuffer()
  const rotatedBuffer = await sharp(buffer).rotate(270).toBuffer()
  const candidate = await sparseScorer(candidateBuffer).catch(() => 0)
  const rotated = await sparseScorer(rotatedBuffer).catch(() => 0)
  const best = Math.max(candidate, rotated)
  const gap = best > 0 ? Math.abs(rotated - candidate) / best : 0
  if (gap < 0.12) return { cw: null, layoutBackstopUsed: null }
  return { cw: rotated > candidate ? 270 : 180, layoutBackstopUsed: 'sparse_layout' }
}

export async function detectUprightCwVoted(
  buffer: Buffer, apiKey: string, model: string,
  opts: {
    runs?: number
    sampler?: (b: Buffer) => Promise<Cw | null>
    docTypeId?: string | null
    sparseScorer?: (b: Buffer) => Promise<number>
    layoutScorer?: (b: Buffer) => Promise<LayoutScore[]>
    osdDetector?: (b: Buffer) => Promise<OsdOrientation | null>
  } = {},
): Promise<Cw | null> {
  const result = await detectUprightCwVotedMeta(buffer, apiKey, model, opts)
  return result.cw
}

/** True when no remaining vote can change the orientation majority (cost early-exit). */
export function orientationSettled(votes: Array<Cw | null>, runs: number): boolean {
  const remaining = runs - votes.length
  if (remaining <= 0) return true
  const counts = new Map<Cw, number>()
  for (const v of votes) if (v !== null) counts.set(v, (counts.get(v) ?? 0) + 1)
  let best = 0; for (const c of counts.values()) if (c > best) best = c
  const won = best * 2 > runs
  const cannotWin = (best + remaining) * 2 <= runs
  return won || cannotWin
}

export interface OrientResult {
  buffer: Buffer
  applied: Cw
  detected: boolean // false ⇒ detection failed / undecidable ⇒ buffer returned unchanged
  /** ORIENT_180_CHECK: the binary confirm pass flipped the 4-cell verdict by an extra 180°. */
  disambiguated180?: boolean
  /** Sparse-form 90° adjunct confirm: the 4-cell verdict was checked against its 90° neighbor. */
  disambiguated90?: boolean
  /** Which layout backstop, if any, settled the orientation decision. */
  layoutBackstopUsed?: 'handwritten_layout' | 'sparse_layout'
  /** Truthful, normalized account of what the Gemini/OpenAI provider layer actually did — see
   *  `normalizeOrientationTelemetry`. `detected` above already covers OSD/layout-backstop
   *  resolutions too; this field is specifically about the LLM provider layer. */
  orientationTelemetry: OrientationTelemetry
}

interface OrientVoteMeta {
  cw: Cw | null
  layoutBackstopUsed: 'handwritten_layout' | 'sparse_layout' | null
}

/**
 * Flag: second-stage 180° disambiguation (default OFF — costs +1 paid call/doc when ON, OFF is
 * byte-identical to the pre-existing behavior). WHY: the ONLY measured failure class on the
 * 10-real-doc / 50-variant harness (43/50, see DOCUMENT_POSTURE_PRE_READER_GATE.md §6b) is
 * 180°-opposite confusion — a focused binary question targets exactly that, instead of adding
 * more 4-way votes (which does not distinguish "upright" from "its own 180° flip").
 */
export function isOrient180CheckEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.ORIENT_180_CHECK === '1'
}

const PROMPT_180 =
  'This image shows the SAME document twice, side by side: LEFT and RIGHT are the same page, but ' +
  'RIGHT is rotated 180° relative to LEFT. Exactly ONE side is UPRIGHT (readable top-to-bottom: ' +
  'headers/title at the top, text lines read left-to-right, any face photo head-up, ' +
  'signatures/stamps nearer the bottom). Which side is upright? Answer ONLY JSON ' +
  '{"side":"left"|"right"}.'

function build180Prompt(docTypeId?: string | null): string {
  const hints = [buildDocOrientationHint(docTypeId), buildRotationBackstopHint(docTypeId)].filter(Boolean)
  return PROMPT_180 + (hints.length ? ` ${hints.join(' ')}` : '')
}

/** Build a 1×2 grid [candidate | candidate rotated 180°] as a JPEG buffer. */
export async function build180Grid(buffer: Buffer, cellPx = 640, padPx = 10): Promise<Buffer> {
  const flipped = await sharp(buffer).rotate(180).toBuffer()
  const tiles = await Promise.all(
    [buffer, flipped].map(async (b, i) => ({
      input: await sharp(b).resize(cellPx, cellPx, { fit: 'inside', background: '#ffffff' }).jpeg().toBuffer(),
      top: padPx,
      left: padPx + i * (cellPx + padPx),
    })),
  )
  return sharp({
    create: { width: cellPx * 2 + padPx * 3, height: cellPx + padPx * 2, channels: 3, background: '#dddddd' },
  }).composite(tiles).jpeg({ quality: 85 }).toBuffer()
}

/** Build a 1×2 grid [candidate | candidate rotated 90° CW] as a JPEG buffer. */
async function scoreSparseLayout(buffer: Buffer, cropFrac = 0.15): Promise<number> {
  const base = sharp(buffer)
  const meta = await base.metadata()
  const width = meta.width ?? 0
  const height = meta.height ?? 0
  if (width <= 0 || height <= 0) return 0

  const left = Math.min(Math.floor(width * cropFrac), Math.max(0, width - 1))
  const top = Math.min(Math.floor(height * cropFrac), Math.max(0, height - 1))
  const cropWidth = Math.max(1, width - left * 2)
  const cropHeight = Math.max(1, height - top * 2)
  const cropped = left > 0 && top > 0 && cropWidth > 0 && cropHeight > 0
    ? base.extract({ left, top, width: cropWidth, height: cropHeight })
    : base

  const { data, info } = await cropped
    .grayscale()
    .normalize()
    .resize({ width: 512, withoutEnlargement: true })
    .raw()
    .toBuffer({ resolveWithObject: true })

  const rows = new Array<number>(info.height).fill(0)
  const cols = new Array<number>(info.width).fill(0)
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const v = 255 - data[y * info.width + x]
      rows[y] += v
      cols[x] += v
    }
  }
  const rowMean = rows.reduce((a, b) => a + b, 0) / rows.length
  const colMean = cols.reduce((a, b) => a + b, 0) / cols.length
  let rowVar = 0
  let colVar = 0
  for (const v of rows) rowVar += (v - rowMean) ** 2
  for (const v of cols) colVar += (v - colMean) ** 2
  return rowVar / (colVar + 1)
}

export interface LayoutScore {
  cw: Cw
  score: number
  topBottomBias: number
}

export async function scoreHandwrittenLayout(buffer: Buffer, cropFrac = 0.15): Promise<LayoutScore[]> {
  const out: LayoutScore[] = []
  for (const cw of [0, 90, 180, 270] as const) {
    const rotated = cw === 0 ? buffer : await sharp(buffer).rotate(cw).toBuffer()
    const base = sharp(rotated)
    const meta = await base.metadata()
    const width = meta.width ?? 0
    const height = meta.height ?? 0
    if (width <= 0 || height <= 0) {
      out.push({ cw, score: 0, topBottomBias: 0 })
      continue
    }

    const left = Math.min(Math.floor(width * cropFrac), Math.max(0, width - 1))
    const top = Math.min(Math.floor(height * cropFrac), Math.max(0, height - 1))
    const cropWidth = Math.max(1, width - left * 2)
    const cropHeight = Math.max(1, height - top * 2)
    const cropped = left > 0 && top > 0 && cropWidth > 0 && cropHeight > 0
      ? base.extract({ left, top, width: cropWidth, height: cropHeight })
      : base

    const { data, info } = await cropped
      .grayscale()
      .normalize()
      .resize({ width: 512, withoutEnlargement: true })
      .raw()
      .toBuffer({ resolveWithObject: true })

    const rows = new Array<number>(info.height).fill(0)
    const cols = new Array<number>(info.width).fill(0)
    for (let y = 0; y < info.height; y++) {
      for (let x = 0; x < info.width; x++) {
        const v = 255 - data[y * info.width + x]
        rows[y] += v
        cols[x] += v
      }
    }
    const rowMean = rows.reduce((a, b) => a + b, 0) / rows.length
    const colMean = cols.reduce((a, b) => a + b, 0) / cols.length
    let rowVar = 0
    let colVar = 0
    for (const v of rows) rowVar += (v - rowMean) ** 2
    for (const v of cols) colVar += (v - colMean) ** 2
    const totalInk = rows.reduce((a, b) => a + b, 0)
    const half = Math.floor(rows.length / 2)
    const topInk = rows.slice(0, half).reduce((a, b) => a + b, 0)
    const bottomInk = rows.slice(half).reduce((a, b) => a + b, 0)
    out.push({
      cw,
      score: rowVar / (colVar + 1),
      topBottomBias: (topInk - bottomInk) / (totalInk + 1),
    })
  }
  return out
}

export function chooseHandwrittenLayoutRotation(scores: LayoutScore[], folded: Cw | null): Cw | null {
  if (scores.length === 0) return folded
  const sorted = [...scores].sort((a, b) => {
    const aPref = a.topBottomBias < -0.005 ? 1 : 0
    const bPref = b.topBottomBias < -0.005 ? 1 : 0
    if (aPref !== bPref) return bPref - aPref
    if (b.score !== a.score) return b.score - a.score
    return Math.abs(b.topBottomBias) - Math.abs(a.topBottomBias)
  })
  const best = sorted[0]
  if (!best) return folded
  if (folded === null) return best.cw
  const foldedScore = scores.find((s) => s.cw === folded)
  if (!foldedScore) return best.cw
  const bestBeatsFolded = best.score > foldedScore.score * 1.12
  const bestPrefersBias = best.topBottomBias < -0.005 && foldedScore.topBottomBias >= -0.005
  return best.cw !== folded && (bestBeatsFolded || bestPrefersBias) ? best.cw : folded
}

/** Build a 1×2 grid [candidate | candidate rotated 90° CW] as a JPEG buffer. */
export async function buildAdjacent90Grid(buffer: Buffer, cellPx = 640, padPx = 10): Promise<Buffer> {
  const adjacent = await sharp(buffer).rotate(90).toBuffer()
  const tiles = await Promise.all(
    [buffer, adjacent].map(async (b, i) => ({
      input: await sharp(b).resize(cellPx, cellPx, { fit: 'inside', background: '#ffffff' }).jpeg().toBuffer(),
      top: padPx,
      left: padPx + i * (cellPx + padPx),
    })),
  )
  return sharp({
    create: { width: cellPx * 2 + padPx * 3, height: cellPx + padPx * 2, channels: 3, background: '#dddddd' },
  }).composite(tiles).jpeg({ quality: 85 }).toBuffer()
}

/**
 * Sparse-form 90° adjunct confirm: compare the current candidate against the same page rotated
 * 90° CW. This is the targeted backstop for the observed sparse-template 90° miscorrection class.
 */
export async function confirmUprightVsAdjacent90(
  buffer: Buffer, apiKey: string, model: string, timeoutMs = 20_000,
  opts: { docTypeId?: string | null; osdDetector?: (b: Buffer) => Promise<OsdOrientation | null> } & OpenAiFallbackOpts = {},
): Promise<'candidate' | 'flipped' | null> {
  const osdDetector = opts.osdDetector ?? detectTesseractOrientation
  try {
    const candidate = await osdDetector(buffer).catch(() => null)
    const flipped = await osdDetector(await sharp(buffer).rotate(90).toBuffer()).catch(() => null)
    const candidateUpright = candidate?.cw === 0 && typeof candidate.confidence === 'number' && isPlausibleOsdScript(candidate)
    const flippedUpright = flipped?.cw === 0 && typeof flipped.confidence === 'number' && isPlausibleOsdScript(flipped)
    if (candidateUpright && !flippedUpright) return 'candidate'
    if (flippedUpright && !candidateUpright) return 'flipped'
    if (candidateUpright && flippedUpright) {
      const best = Math.max(candidate!.confidence ?? 0, flipped!.confidence ?? 0)
      const gap = best > 0 ? Math.abs((candidate!.confidence ?? 0) - (flipped!.confidence ?? 0)) / best : 0
      if (gap >= TESSERACT_ZERO_CONFIRM_GAP) return (candidate!.confidence ?? 0) >= (flipped!.confidence ?? 0) ? 'candidate' : 'flipped'
    }
  } catch {
    // fall through to Gemini confirm
  }
  const prompt = 'This image shows the SAME document twice, side by side: LEFT is the current ' +
    'candidate upright pose, RIGHT is that same page rotated 90° clockwise. Exactly ONE ' +
    'side is upright. Which side is upright? Answer ONLY JSON {"side":"left"|"right"}.' +
    (() => {
      const hints = [buildDocOrientationHint(opts.docTypeId), buildRotationBackstopHint(opts.docTypeId)].filter(Boolean)
      return hints.length ? ` ${hints.join(' ')}` : ''
    })()
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  let grid: Buffer
  try {
    grid = await buildAdjacent90Grid(buffer)
  } catch {
    clearTimeout(timer)
    return null
  }
  const sideToVerdict = (side: 'left' | 'right' | null): 'candidate' | 'flipped' | null =>
    side === 'left' ? 'candidate' : side === 'right' ? 'flipped' : null
  // TRUTHFULNESS FIX: no Gemini key ⇒ no attempt, straight to fallback (see detectUprightCw).
  if (!apiKey) {
    clearTimeout(timer)
    return sideToVerdict(await fallbackSideViaOpenAi(grid, prompt, opts, timeoutMs))
  }
  if (opts.telemetry) opts.telemetry.primaryAttempted = true
  try {
    const gridB64 = grid.toString('base64')
    const gridSha256 = sha256Hex(gridB64)
    const requestSha = sha256Hex(prompt)
    const cacheKeySha = computeCacheKeySha({
      fileSha256: gridSha256, provider: 'gemini', model,
      promptVersion: 'orient_90_adjacent_v1', preprocVersion: 'grid1x2_adjacent90_v1', requestSha,
    })
    const res = await withOcrCostMetrics(
      {
        product: 'ocr', route: 'provider:gemini_orient_90_adjacent', provider: 'gemini',
        model, cacheKeySha, est_cost_usd_micros: estCostUsdMicros('gemini', model),
        gateway: {
          fileSha256: gridSha256, promptVersion: 'orient_90_adjacent_v1',
          preprocVersion: 'grid1x2_adjacent90_v1', requestSha,
        },
      },
      () => fetch(GEMINI_URL(model, apiKey), {
        method: 'POST', signal: ctrl.signal, headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: 'image/jpeg', data: gridB64 } }] }],
          generationConfig: { temperature: 0, response_mime_type: 'application/json' },
        }),
      }),
    )
    if (!res.ok) {
      if (opts.telemetry) opts.telemetry.primaryErrorCode = opts.telemetry.primaryErrorCode ?? (res.status >= 500 ? 'http_5xx' : 'http_4xx')
      return sideToVerdict(await fallbackSideViaOpenAi(grid, prompt, opts, timeoutMs))
    }
    const j = await res.json()
    let rawSide: unknown = null
    try { rawSide = JSON.parse(j?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}')?.side } catch {
      if (opts.telemetry) opts.telemetry.primaryErrorCode = opts.telemetry.primaryErrorCode ?? 'invalid_json'
      return sideToVerdict(await fallbackSideViaOpenAi(grid, prompt, opts, timeoutMs))
    }
    if (opts.telemetry) opts.telemetry.anyResponseReceived = true
    const side = normalizeSide(rawSide)
    if (side === 'left') return 'candidate'
    if (side === 'right') return 'flipped'
    if (opts.telemetry) opts.telemetry.primaryErrorCode = opts.telemetry.primaryErrorCode ?? 'unrecognized_position'
    return sideToVerdict(await fallbackSideViaOpenAi(grid, prompt, opts, timeoutMs))
  } catch {
    if (opts.telemetry) opts.telemetry.primaryErrorCode = opts.telemetry.primaryErrorCode ?? 'network_error'
    return sideToVerdict(await fallbackSideViaOpenAi(grid, prompt, opts, timeoutMs))
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Binary 180° confirm: is `buffer` upright, or is its 180°-rotated twin? ONE paid call.
 * Returns 'candidate' (buffer is upright) | 'flipped' (needs +180°) | null (undecidable/failed —
 * fail-open, never throws; caller treats null as detection failure).
 */
export async function confirmUprightVs180(
  buffer: Buffer, apiKey: string, model: string, timeoutMs = 20_000,
  opts: { docTypeId?: string | null; osdDetector?: (b: Buffer) => Promise<OsdOrientation | null> } & OpenAiFallbackOpts = {},
): Promise<'candidate' | 'flipped' | null> {
  const osdDetector = opts.osdDetector ?? detectTesseractOrientation
  try {
    const candidate = await osdDetector(buffer).catch(() => null)
    const flipped = await osdDetector(await sharp(buffer).rotate(180).toBuffer()).catch(() => null)
    const candidateUpright = candidate?.cw === 0 && typeof candidate.confidence === 'number' && isPlausibleOsdScript(candidate)
    const flippedUpright = flipped?.cw === 0 && typeof flipped.confidence === 'number' && isPlausibleOsdScript(flipped)
    if (candidateUpright && !flippedUpright) return 'candidate'
    if (flippedUpright && !candidateUpright) return 'flipped'
    if (candidateUpright && flippedUpright) {
      const best = Math.max(candidate!.confidence ?? 0, flipped!.confidence ?? 0)
      const gap = best > 0 ? Math.abs((candidate!.confidence ?? 0) - (flipped!.confidence ?? 0)) / best : 0
      if (gap >= TESSERACT_ZERO_CONFIRM_GAP) return (candidate!.confidence ?? 0) >= (flipped!.confidence ?? 0) ? 'candidate' : 'flipped'
    }
  } catch {
    // fall through to Gemini confirm
  }
  const prompt = build180Prompt(opts.docTypeId)
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  let grid: Buffer
  try {
    grid = await build180Grid(buffer)
  } catch {
    clearTimeout(timer)
    return null
  }
  const sideToVerdict = (side: 'left' | 'right' | null): 'candidate' | 'flipped' | null =>
    side === 'left' ? 'candidate' : side === 'right' ? 'flipped' : null
  // TRUTHFULNESS FIX: no Gemini key ⇒ no attempt, straight to fallback (see detectUprightCw).
  if (!apiKey) {
    clearTimeout(timer)
    return sideToVerdict(await fallbackSideViaOpenAi(grid, prompt, opts, timeoutMs))
  }
  if (opts.telemetry) opts.telemetry.primaryAttempted = true
  try {
    const gridB64 = grid.toString('base64')
    const gridSha256 = sha256Hex(gridB64)
    const requestSha = sha256Hex(prompt)
    const cacheKeySha = computeCacheKeySha({
      fileSha256: gridSha256, provider: 'gemini', model,
      promptVersion: 'orient_180_v1', preprocVersion: 'grid1x2_v1', requestSha,
    })
    const res = await withOcrCostMetrics(
      {
        product: 'ocr', route: 'provider:gemini_orient_180', provider: 'gemini',
        model, cacheKeySha, est_cost_usd_micros: estCostUsdMicros('gemini', model),
        gateway: {
          fileSha256: gridSha256, promptVersion: 'orient_180_v1',
          preprocVersion: 'grid1x2_v1', requestSha,
        },
      },
      () => fetch(GEMINI_URL(model, apiKey), {
        method: 'POST', signal: ctrl.signal, headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: 'image/jpeg', data: gridB64 } }] }],
          generationConfig: { temperature: 0, response_mime_type: 'application/json' },
        }),
      }),
    )
    if (!res.ok) {
      if (opts.telemetry) opts.telemetry.primaryErrorCode = opts.telemetry.primaryErrorCode ?? (res.status >= 500 ? 'http_5xx' : 'http_4xx')
      return sideToVerdict(await fallbackSideViaOpenAi(grid, prompt, opts, timeoutMs))
    }
    const j = await res.json()
    let rawSide: unknown = null
    try { rawSide = JSON.parse(j?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}')?.side } catch {
      if (opts.telemetry) opts.telemetry.primaryErrorCode = opts.telemetry.primaryErrorCode ?? 'invalid_json'
      return sideToVerdict(await fallbackSideViaOpenAi(grid, prompt, opts, timeoutMs))
    }
    if (opts.telemetry) opts.telemetry.anyResponseReceived = true
    const side = normalizeSide(rawSide)
    if (side === 'left') return 'candidate'
    if (side === 'right') return 'flipped'
    if (opts.telemetry) opts.telemetry.primaryErrorCode = opts.telemetry.primaryErrorCode ?? 'unrecognized_position'
    return sideToVerdict(await fallbackSideViaOpenAi(grid, prompt, opts, timeoutMs))
  } catch {
    if (opts.telemetry) opts.telemetry.primaryErrorCode = opts.telemetry.primaryErrorCode ?? 'network_error'
    return sideToVerdict(await fallbackSideViaOpenAi(grid, prompt, opts, timeoutMs))
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Detect the upright rotation (K-vote stabilized) and apply it. Returns the corrected buffer + the
 * applied angle. Fail-open: detection failure ⇒ original buffer, applied 0, detected false.
 *
 * ORIENT_180_CHECK=1 adds a second-stage binary confirm on the ORIENTED candidate (after the 4-cell
 * vote is applied): 'flipped' ⇒ apply one more 180° (the measured failure class — see module doc);
 * null/undecidable ⇒ detected=false, so the caller's existing orientation_uncertain fail-closed path
 * adds review — this NEVER silently guesses between the two poses. OFF (default) ⇒ unchanged
 * behavior, byte-identical to before this change.
 */
export async function orientToUpright(
  buffer: Buffer, apiKey: string, model: string,
  opts: { docTypeId?: string | null } = {},
): Promise<OrientResult> {
  // Guardrail #1: this is the ONE raw accumulator for the whole read; every orientation function
  // called below (the vote, and both binary confirms) writes into the SAME object. Guardrail #2:
  // `orientToUpright` always normalizes with enabled=true (it only ever runs when a caller decided
  // to enable it); the caller is responsible for representing the flag-OFF ('disabled') case
  // itself, via the same `normalizeOrientationTelemetry` function, without calling this one.
  const telemetry = newRawOrientTelemetry()
  const finish = (r: Omit<OrientResult, 'orientationTelemetry'>): OrientResult =>
    ({ ...r, orientationTelemetry: normalizeOrientationTelemetry(telemetry, true) })

  const vote = await detectUprightCwVotedMeta(buffer, apiKey, model, { docTypeId: opts.docTypeId, telemetry })
  const cw = vote.cw
  if (cw === null) return finish({ buffer, applied: 0, detected: false })

  let out = buffer
  let applied: Cw = 0
  if (cw !== 0) {
    try {
      out = await sharp(buffer).rotate(cw).toBuffer()
      applied = cw
    } catch {
      return finish({ buffer, applied: 0, detected: false })
    }
  }

  let disambiguated90 = false
  if (opts.docTypeId && ROTATION_BACKSTOP_DOC_TYPES.has(opts.docTypeId) && applied === 180) {
    const rotated90 = await sharp(out).rotate(90).toBuffer()
    const candidateScore = await scoreSparseLayout(out)
    const rotatedScore = await scoreSparseLayout(rotated90)
    const best = Math.max(candidateScore, rotatedScore)
    const gap = best > 0 ? Math.abs(rotatedScore - candidateScore) / best : 0
    if (gap >= 0.12) {
      disambiguated90 = true
      if (rotatedScore > candidateScore) {
        out = rotated90
        applied = 270
      }
    } else {
      const confirm90 = await confirmUprightVsAdjacent90(out, apiKey, model, 20_000, { docTypeId: opts.docTypeId, telemetry })
      if (confirm90 === 'candidate') {
        disambiguated90 = true
      } else if (confirm90 === 'flipped') {
        try {
          out = rotated90
          applied = 270
          disambiguated90 = true
        } catch {
          return finish({ buffer: out, applied, detected: true, disambiguated90: true, ...(vote.layoutBackstopUsed ? { layoutBackstopUsed: vote.layoutBackstopUsed } : {}) })
        }
      } else {
        // Adjunct could not decide between the current pose and its 90° neighbour.
        // Keep the base detector's decision; do not discard an already-applied pose.
        return finish({ buffer: out, applied, detected: true, disambiguated90: true, ...(vote.layoutBackstopUsed ? { layoutBackstopUsed: vote.layoutBackstopUsed } : {}) })
      }
    }
  }

  const run180Check = isOrient180CheckEnabled() || isHandwrittenDocType(opts.docTypeId)
  if (!run180Check) return finish({ buffer: out, applied, detected: true, disambiguated90, ...(vote.layoutBackstopUsed ? { layoutBackstopUsed: vote.layoutBackstopUsed } : {}) })

  const confirm = await confirmUprightVs180(out, apiKey, model, 20_000, { docTypeId: opts.docTypeId, telemetry })
  if (confirm === 'candidate') return finish({ buffer: out, applied, detected: true, disambiguated90, ...(vote.layoutBackstopUsed ? { layoutBackstopUsed: vote.layoutBackstopUsed } : {}) })
  if (confirm === 'flipped') {
    try {
      const fixed = await sharp(out).rotate(180).toBuffer()
      const newApplied = ((applied + 180) % 360) as Cw
      return finish({ buffer: fixed, applied: newApplied, detected: true, disambiguated180: true, disambiguated90, ...(vote.layoutBackstopUsed ? { layoutBackstopUsed: vote.layoutBackstopUsed } : {}) })
    } catch {
      return finish({ buffer: out, applied, detected: true, disambiguated90, ...(vote.layoutBackstopUsed ? { layoutBackstopUsed: vote.layoutBackstopUsed } : {}) })
    }
  }
  // Adjunct undecidable: preserve the base detector's decision instead of discarding it.
  // The adjunct is a refinement, not a replacement for the underlying pose vote.
  return finish({ buffer: out, applied, detected: true, disambiguated90, ...(vote.layoutBackstopUsed ? { layoutBackstopUsed: vote.layoutBackstopUsed } : {}) })
}

/** Flag: content-based orientation correction (default OFF — measured before enabling). */
export function isContentOrientEnabled(env: Record<string, string | undefined> = process.env): boolean {
  // Step-5 (owner 2026-06-27): DEFAULT ON. PROVEN on the owner's real birth cert, whose EXIF tag (6)
  // is WRONG — sharp's EXIF auto-rotate in preprocess turns the upright scan SIDEWAYS, so the read
  // was garbage. Decisive A/B on that exact (EXIF-sideways) buffer: content-orient OFF → 0/4 fields
  // EXACT (CER 0.57-1.0); content-orient ON → detector applied 270, read 2/4 EXACT (family+patronymic
  // exact, place CER 0.09). (An earlier "detector mis-calibrated" reading was a TEST-HARNESS artifact:
  // the synthetic base was itself sideways + double-rotated.) Set CONTENT_ORIENT_ENABLED=0 to disable.
  // Cost: ORIENT_VOTE_RUNS grid calls/doc (default 3).
  return env.CONTENT_ORIENT_ENABLED !== '0'
}
