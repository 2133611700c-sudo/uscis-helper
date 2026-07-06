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

export interface OsdOrientation {
  cw: Cw | null
  confidence: number | null
  script?: string | null
  scriptConfidence?: number | null
}

async function detectTesseractOrientation(buffer: Buffer): Promise<OsdOrientation | null> {
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

async function confirmUprightByOsdCandidates(
  buffer: Buffer,
  detector: (b: Buffer) => Promise<OsdOrientation | null>,
): Promise<Cw | null> {
  const zeroCandidates: Array<{ cw: Cw; confidence: number }> = []
  for (const cw of [0, 90, 180, 270] as const) {
    const candidate = cw === 0 ? buffer : await sharp(buffer).rotate(cw).toBuffer()
    const detected = await detector(candidate)
    if (detected?.cw === 0 && typeof detected.confidence === 'number') {
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
  } = {},
): Promise<OrientVoteMeta> {
  const runs = opts.runs ?? orientVoteRuns()
  const sample = opts.sampler ?? ((b: Buffer) => detectUprightCw(b, apiKey, model, 20_000, { docTypeId: opts.docTypeId }))
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
    const adjacent90 = await confirmUprightVsAdjacent90(buffer, apiKey, model, 20_000, { docTypeId: opts.docTypeId, osdDetector })
    if (adjacent90 === 'candidate') return { cw: single, layoutBackstopUsed: null }
    if (adjacent90 === 'flipped') return { cw: ((single ?? 0) + 90) as Cw, layoutBackstopUsed: null }
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
    const adjacent90 = await confirmUprightVsAdjacent90(buffer, apiKey, model, 20_000, { docTypeId: opts.docTypeId, osdDetector })
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
  opts: { docTypeId?: string | null; osdDetector?: (b: Buffer) => Promise<OsdOrientation | null> } = {},
): Promise<'candidate' | 'flipped' | null> {
  const osdDetector = opts.osdDetector ?? detectTesseractOrientation
  try {
    const candidate = await osdDetector(buffer).catch(() => null)
    const flipped = await osdDetector(await sharp(buffer).rotate(90).toBuffer()).catch(() => null)
    const candidateUpright = candidate?.cw === 0 && typeof candidate.confidence === 'number'
    const flippedUpright = flipped?.cw === 0 && typeof flipped.confidence === 'number'
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
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const grid = await buildAdjacent90Grid(buffer)
    const gridB64 = grid.toString('base64')
    const cacheKeySha = computeCacheKeySha({
      fileSha256: sha256Hex(gridB64), provider: 'gemini', model,
      promptVersion: 'orient_90_adjacent_v1', preprocVersion: 'grid1x2_adjacent90_v1',
    })
    const res = await withOcrCostMetrics(
      {
        product: 'ocr', route: 'provider:gemini_orient_90_adjacent', provider: 'gemini',
        model, cacheKeySha, est_cost_usd_micros: estCostUsdMicros('gemini', model),
      },
      () => fetch(GEMINI_URL(model, apiKey), {
        method: 'POST', signal: ctrl.signal, headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          contents: [{
          parts: [
            {
              text: 'This image shows the SAME document twice, side by side: LEFT is the current ' +
                'candidate upright pose, RIGHT is that same page rotated 90° clockwise. Exactly ONE ' +
                'side is upright. Which side is upright? Answer ONLY JSON {"side":"left"|"right"}.' +
                (() => {
                  const hints = [buildDocOrientationHint(opts.docTypeId), buildRotationBackstopHint(opts.docTypeId)].filter(Boolean)
                  return hints.length ? ` ${hints.join(' ')}` : ''
                })(),
            },
            { inline_data: { mime_type: 'image/jpeg', data: gridB64 } },
          ],
        }],
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
 * Binary 180° confirm: is `buffer` upright, or is its 180°-rotated twin? ONE paid call.
 * Returns 'candidate' (buffer is upright) | 'flipped' (needs +180°) | null (undecidable/failed —
 * fail-open, never throws; caller treats null as detection failure).
 */
export async function confirmUprightVs180(
  buffer: Buffer, apiKey: string, model: string, timeoutMs = 20_000,
  opts: { docTypeId?: string | null; osdDetector?: (b: Buffer) => Promise<OsdOrientation | null> } = {},
): Promise<'candidate' | 'flipped' | null> {
  const osdDetector = opts.osdDetector ?? detectTesseractOrientation
  try {
    const candidate = await osdDetector(buffer).catch(() => null)
    const flipped = await osdDetector(await sharp(buffer).rotate(180).toBuffer()).catch(() => null)
    const candidateUpright = candidate?.cw === 0 && typeof candidate.confidence === 'number'
    const flippedUpright = flipped?.cw === 0 && typeof flipped.confidence === 'number'
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
  const vote = await detectUprightCwVotedMeta(buffer, apiKey, model, { docTypeId: opts.docTypeId })
  const cw = vote.cw
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
      const confirm90 = await confirmUprightVsAdjacent90(out, apiKey, model, 20_000, { docTypeId: opts.docTypeId })
      if (confirm90 === 'candidate') {
        disambiguated90 = true
      } else if (confirm90 === 'flipped') {
        try {
          out = rotated90
          applied = 270
          disambiguated90 = true
        } catch {
          return { buffer: out, applied, detected: true, disambiguated90: true, ...(vote.layoutBackstopUsed ? { layoutBackstopUsed: vote.layoutBackstopUsed } : {}) }
        }
      } else {
        // Adjunct could not decide between the current pose and its 90° neighbour.
        // Keep the base detector's decision; do not discard an already-applied pose.
        return { buffer: out, applied, detected: true, disambiguated90: true, ...(vote.layoutBackstopUsed ? { layoutBackstopUsed: vote.layoutBackstopUsed } : {}) }
      }
    }
  }

  const run180Check = isOrient180CheckEnabled() || isHandwrittenDocType(opts.docTypeId)
  if (!run180Check) return { buffer: out, applied, detected: true, disambiguated90, ...(vote.layoutBackstopUsed ? { layoutBackstopUsed: vote.layoutBackstopUsed } : {}) }

  const confirm = await confirmUprightVs180(out, apiKey, model, 20_000, { docTypeId: opts.docTypeId })
  if (confirm === 'candidate') return { buffer: out, applied, detected: true, disambiguated90, ...(vote.layoutBackstopUsed ? { layoutBackstopUsed: vote.layoutBackstopUsed } : {}) }
  if (confirm === 'flipped') {
    try {
      const fixed = await sharp(out).rotate(180).toBuffer()
      const newApplied = ((applied + 180) % 360) as Cw
      return { buffer: fixed, applied: newApplied, detected: true, disambiguated180: true, disambiguated90, ...(vote.layoutBackstopUsed ? { layoutBackstopUsed: vote.layoutBackstopUsed } : {}) }
    } catch {
      return { buffer: out, applied, detected: true, disambiguated90, ...(vote.layoutBackstopUsed ? { layoutBackstopUsed: vote.layoutBackstopUsed } : {}) }
    }
  }
  // Adjunct undecidable: preserve the base detector's decision instead of discarding it.
  // The adjunct is a refinement, not a replacement for the underlying pose vote.
  return { buffer: out, applied, detected: true, disambiguated90, ...(vote.layoutBackstopUsed ? { layoutBackstopUsed: vote.layoutBackstopUsed } : {}) }
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
