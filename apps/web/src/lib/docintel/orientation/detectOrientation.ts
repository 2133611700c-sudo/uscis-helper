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

export type Cw = 0 | 90 | 180 | 270

const GEMINI_URL = (model: string, key: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`

/** Grid cell → the clockwise rotation rendered in that cell (= the correction if that cell is upright). */
const CELLS: Array<{ pos: string; cw: Cw }> = [
  { pos: 'top-left', cw: 0 },
  { pos: 'top-right', cw: 90 },
  { pos: 'bottom-left', cw: 180 },
  { pos: 'bottom-right', cw: 270 },
]

/** Map a model's chosen grid position to the correction angle (pure; null when unrecognized). */
export function positionToCorrectionCw(pos: unknown): Cw | null {
  if (typeof pos !== 'string') return null
  const cell = CELLS.find((c) => c.pos === pos.trim().toLowerCase())
  return cell ? cell.cw : null
}

const PROMPT =
  'This image is a 2x2 grid showing the SAME identity document at four rotations: ' +
  'TOP-LEFT = original, TOP-RIGHT = rotated 90° clockwise, BOTTOM-LEFT = 180°, ' +
  'BOTTOM-RIGHT = 270° clockwise. Exactly ONE shows the document UPRIGHT: header/printed text ' +
  'horizontal and left-to-right, any face photo upright. Which one? Answer ONLY JSON ' +
  '{"pos":"top-left"|"top-right"|"bottom-left"|"bottom-right"}.'

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
): Promise<Cw | null> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const grid = await buildOrientationGrid(buffer)
    const gridB64 = grid.toString('base64')
    const cacheKeySha = computeCacheKeySha({
      fileSha256: sha256Hex(gridB64), provider: 'gemini', model,
      promptVersion: 'orient_grid_v1', preprocVersion: 'grid2x2_v1',
    })
    const res = await withOcrCostMetrics(
      {
        product: 'ocr', route: 'provider:gemini_orient_grid', provider: 'gemini',
        model, cacheKeySha, est_cost_usd_micros: estCostUsdMicros('gemini', model),
      },
      () => fetch(GEMINI_URL(model, apiKey), {
        method: 'POST', signal: ctrl.signal, headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: PROMPT }, { inline_data: { mime_type: 'image/jpeg', data: gridB64 } }] }],
          generationConfig: { temperature: 0, response_mime_type: 'application/json' },
        }),
      }),
    )
    if (!res.ok) return null
    const j = await res.json()
    let pos: unknown = null
    try { pos = JSON.parse(j?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}')?.pos } catch { return null }
    return positionToCorrectionCw(pos)
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

export interface OrientResult {
  buffer: Buffer
  applied: Cw
  detected: boolean // false ⇒ detection failed / undecidable ⇒ buffer returned unchanged
}

/**
 * Detect the upright rotation and apply it. Returns the corrected buffer + the applied angle.
 * Fail-open: detection failure ⇒ original buffer, applied 0, detected false.
 */
export async function orientToUpright(buffer: Buffer, apiKey: string, model: string): Promise<OrientResult> {
  const cw = await detectUprightCw(buffer, apiKey, model)
  if (cw === null || cw === 0) return { buffer, applied: 0, detected: cw !== null }
  try {
    const rotated = await sharp(buffer).rotate(cw).toBuffer()
    return { buffer: rotated, applied: cw, detected: true }
  } catch {
    return { buffer, applied: 0, detected: false }
  }
}

/** Flag: content-based orientation correction (default OFF — measured before enabling). */
export function isContentOrientEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.CONTENT_ORIENT_ENABLED === '1'
}
