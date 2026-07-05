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
  opts: { docTypeId?: string | null } = {},
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
          contents: [{ parts: [{ text: buildOrientationPrompt(opts.docTypeId) }, { inline_data: { mime_type: 'image/jpeg', data: gridB64 } }] }],
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

/** K-sample orientation vote count: env ORIENT_VOTE_RUNS, default 3, clamp 1..5. =1 ⇒ single detect. */
export function orientVoteRuns(env: Record<string, string | undefined> = process.env): number {
  const k = Number(env.ORIENT_VOTE_RUNS)
  return Number.isFinite(k) && k >= 1 ? Math.min(5, Math.floor(k)) : 3
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
export async function detectUprightCwVoted(
  buffer: Buffer, apiKey: string, model: string,
  opts: { runs?: number; sampler?: (b: Buffer) => Promise<Cw | null>; docTypeId?: string | null } = {},
): Promise<Cw | null> {
  const runs = opts.runs ?? orientVoteRuns()
  const sample = opts.sampler ?? ((b: Buffer) => detectUprightCw(b, apiKey, model, 20_000, { docTypeId: opts.docTypeId }))
  if (runs <= 1) return sample(buffer)
  const votes: Array<Cw | null> = []
  for (let i = 0; i < runs; i++) {
    try { votes.push(await sample(buffer)) } catch { votes.push(null) }
    if (orientationSettled(votes, runs)) break // COST: stop once the angle is decided (≥2 agree).
  }
  return foldOrientationVotes(votes, runs)
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
  const hint = buildDocOrientationHint(docTypeId)
  return PROMPT_180 + (hint ? ` ${hint}` : '')
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

/**
 * Binary 180° confirm: is `buffer` upright, or is its 180°-rotated twin? ONE paid call.
 * Returns 'candidate' (buffer is upright) | 'flipped' (needs +180°) | null (undecidable/failed —
 * fail-open, never throws; caller treats null as detection failure).
 */
export async function confirmUprightVs180(
  buffer: Buffer, apiKey: string, model: string, timeoutMs = 20_000,
  opts: { docTypeId?: string | null } = {},
): Promise<'candidate' | 'flipped' | null> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const grid = await build180Grid(buffer)
    const gridB64 = grid.toString('base64')
    const cacheKeySha = computeCacheKeySha({
      fileSha256: sha256Hex(gridB64), provider: 'gemini', model,
      promptVersion: 'orient_180_v1', preprocVersion: 'grid1x2_v1',
    })
    const res = await withOcrCostMetrics(
      {
        product: 'ocr', route: 'provider:gemini_orient_180', provider: 'gemini',
        model, cacheKeySha, est_cost_usd_micros: estCostUsdMicros('gemini', model),
      },
      () => fetch(GEMINI_URL(model, apiKey), {
        method: 'POST', signal: ctrl.signal, headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: build180Prompt(opts.docTypeId) }, { inline_data: { mime_type: 'image/jpeg', data: gridB64 } }] }],
          generationConfig: { temperature: 0, response_mime_type: 'application/json' },
        }),
      }),
    )
    if (!res.ok) return null
    const j = await res.json()
    let side: unknown = null
    try { side = JSON.parse(j?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}')?.side } catch { return null }
    if (side === 'left') return 'candidate'
    if (side === 'right') return 'flipped'
    return null
  } catch {
    return null
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
  const cw = await detectUprightCwVoted(buffer, apiKey, model, { docTypeId: opts.docTypeId })
  if (cw === null) return { buffer, applied: 0, detected: false }

  let out = buffer
  let applied: Cw = 0
  if (cw !== 0) {
    try {
      out = await sharp(buffer).rotate(cw).toBuffer()
      applied = cw
    } catch {
      return { buffer, applied: 0, detected: false }
    }
  }

  if (!isOrient180CheckEnabled()) return { buffer: out, applied, detected: true }

  const confirm = await confirmUprightVs180(out, apiKey, model, 20_000, { docTypeId: opts.docTypeId })
  if (confirm === 'candidate') return { buffer: out, applied, detected: true }
  if (confirm === 'flipped') {
    try {
      const fixed = await sharp(out).rotate(180).toBuffer()
      const newApplied = ((applied + 180) % 360) as Cw
      return { buffer: fixed, applied: newApplied, detected: true, disambiguated180: true }
    } catch {
      return { buffer: out, applied, detected: true }
    }
  }
  // undecidable between the two 180°-opposite poses ⇒ honest uncertainty, never a silent guess
  return { buffer: out, applied, detected: false }
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
