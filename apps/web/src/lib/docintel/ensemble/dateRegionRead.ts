/**
 * dateRegionRead — read the DATE regions of a document with a zoom + second engine.
 *
 * Live finding (prod smoke 2026-06-10): Google Vision on the FULL handwritten page
 * garbles the month; on a ZOOMED crop of the date region it reads it correctly
 * (proven: "июня" / June, where Gemini read July). So the ensemble's second read
 * must be on the date REGION, not the whole page.
 *
 * Pipeline: Gemini returns date bounding boxes → crop+zoom each → Google Vision OCR
 * on the crop → combined text for the reconciler. Geometric only (crop/zoom),
 * never tonal (greyscale/binarize were proven to HURT — see PREPROCESS_AB_DECISION).
 *
 * Fail-open: any failure returns ''. The caller treats no-text as "ensemble not
 * applied" — it never blocks or breaks the read.
 */
import type { OcrProvider } from '@/lib/ocr/types'
import { isUnusableOcr } from '@/lib/ocr/types'
import { withOcrCostMetrics, computeCacheKeySha, sha256Hex, estCostUsdMicros } from '@/lib/v1/ocrCostMetrics'

interface BBox { ymin: number; xmin: number; ymax: number; xmax: number }

const GEMINI_URL = (model: string, key: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`

/** Coerce one box from either an array [ymin,xmin,ymax,xmax] or a keyed object. */
function coerceBox(b: unknown): BBox | null {
  if (Array.isArray(b) && b.length >= 4 && b.slice(0, 4).every((n) => typeof n === 'number')) {
    return { ymin: b[0], xmin: b[1], ymax: b[2], xmax: b[3] }
  }
  if (b && typeof b === 'object') {
    const o = b as Record<string, unknown>
    const vals = [o.ymin, o.xmin, o.ymax, o.xmax]
    if (vals.every((n) => typeof n === 'number')) return { ymin: o.ymin as number, xmin: o.xmin as number, ymax: o.ymax as number, xmax: o.xmax as number }
  }
  return null
}

// Box detection is a COARSE spatial task (where are the dates), NOT a fine read — so it
// uses a FAST model on a SMALL thumbnail. The premium preview model on a full 7MB image
// timed out at 25s → no_boxes → the proven date-region read never ran (real-doc 2026-06-22).
const DATEBOX_MODEL = process.env.GEMINI_DATEBOX_MODEL || 'gemini-3.5-flash'

async function geminiDateBoxes(imageB64: string, mime: string, model: string, key: string): Promise<BBox[]> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 30_000)
  try {
    // Ask for ARRAY boxes [ymin,xmin,ymax,xmax] — arrays come back far more reliably
    // than keyed objects (the model returned malformed keyed JSON otherwise).
    const prompt =
      'Find EVERY handwritten or printed DATE on this document (date of birth, date of issue, etc.). ' +
      'Return ONLY strict JSON: {"boxes":[[ymin,xmin,ymax,xmax]]} — each box an array of 4 integers ' +
      'normalized 0-1000 (top-left y, top-left x, bottom-right y, bottom-right x). Max 4 boxes.'
    // SHADOW cost metric: this is a real paid Gemini call (date-box detection).
    const cacheKeySha = computeCacheKeySha({
      fileSha256: sha256Hex(imageB64), provider: 'gemini', model,
      promptVersion: 'date_boxes_v1', preprocVersion: 'v1',
    })
    const res = await withOcrCostMetrics(
      {
        product: 'ocr', route: 'provider:gemini_date_boxes', provider: 'gemini',
        model, cacheKeySha, est_cost_usd_micros: estCostUsdMicros('gemini', model),
      },
      () => fetch(GEMINI_URL(model, key), {
        method: 'POST', signal: ctrl.signal, headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mime, data: imageB64 } }] }],
          generationConfig: { temperature: 0, response_mime_type: 'application/json' },
        }),
      }),
    )
    if (!res.ok) return []
    const j = await res.json()
    const txt = j?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}'
    let parsed: unknown
    try { parsed = JSON.parse(txt) } catch {
      // salvage: pull every [a,b,c,d] quartet out of malformed JSON
      const quartets = [...txt.matchAll(/\[?\s*(\d{1,4})\s*,\s*(\d{1,4})\s*,\s*(\d{1,4})\s*,\s*(\d{1,4})\s*\]?/g)]
      parsed = { boxes: quartets.map((m) => [(+m[1]), +m[2], +m[3], +m[4]]) }
    }
    const raw = Array.isArray((parsed as { boxes?: unknown })?.boxes) ? (parsed as { boxes: unknown[] }).boxes : []
    return raw.map(coerceBox).filter((b): b is BBox => b !== null).slice(0, 4)
  } catch { return [] } finally { clearTimeout(t) }
}

/**
 * Read the DATE from a small high-res crop with Gemini. The crop is zoomed+upscaled+
 * sharpened and free of surrounding clutter, so the model reads the handwritten digits
 * far better than on the downscaled full page — and it does NOT depend on Google Vision
 * (which is billing-disabled, HTTP 403, on this account). Returns the date as written
 * (text) for the reconciler; '' on any failure (fail-open).
 */
async function geminiReadDateCrop(cropB64: string, model: string, key: string): Promise<string> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 25_000)
  try {
    // PLAIN-TEXT answer (no JSON mode): a thinking/preview model wraps JSON in a
    // preamble + sometimes truncates it. Asking for ONLY the ISO date and regex-
    // extracting it is far more robust for a single value.
    const prompt =
      'This image is a CROPPED close-up of ONE date from a Ukrainian/Russian document, ' +
      'often HANDWRITTEN. Read it EXACTLY — each digit and the month individually; do NOT ' +
      'guess a typical date. Ukrainian/Russian months (січня/января … грудня/декабря) → 01–12. ' +
      'Reply with ONLY the date as YYYY-MM-DD (e.g. 1990-01-15), and nothing else. ' +
      'If unreadable, reply NONE.'
    const res = await fetch(GEMINI_URL(model, key), {
      method: 'POST', signal: ctrl.signal, headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: 'image/jpeg', data: cropB64 } }] }],
        generationConfig: { temperature: 0, maxOutputTokens: 4096 },
      }),
    })
    if (!res.ok) return ''
    const j = await res.json()
    const txt: string = j?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    const iso = txt.match(/\d{4}-\d{2}-\d{2}/)
    return iso ? iso[0] : ''
  } catch { return '' } finally { clearTimeout(t) }
}

export interface DateRegionReadResult {
  text: string
  /** PII-free diagnostics (no values): how far the pipeline got. */
  diag: { boxes: number; crops: number; chars: number; error?: string }
}

/**
 * Read the document's date regions with a zoomed second-engine pass.
 * Returns combined OCR text from the zoomed date crops + PII-free diagnostics.
 */
export async function readDateRegionsWithVision(opts: {
  imageBuffer: Buffer
  mimeType: string
  geminiApiKey: string
  geminiModel: string
  vision: OcrProvider
}): Promise<DateRegionReadResult> {
  const diag = { boxes: 0, crops: 0, chars: 0 } as DateRegionReadResult['diag']
  try {
    // sharp is server-only; import lazily so the module is edge-safe.
    const sharp = (await import('sharp')).default
    const base = await sharp(opts.imageBuffer).rotate().toBuffer()
    const meta = await sharp(base).metadata()
    const W = meta.width ?? 0, H = meta.height ?? 0
    if (!W || !H) { diag.error = 'no_dims'; return { text: '', diag } }

    // Box detection runs on a SMALL thumbnail with a FAST model: boxes are normalized
    // 0-1000 (resolution-independent), so a downscale costs nothing in accuracy but
    // avoids the preview-model 25s timeout that produced no_boxes on full 7MB scans.
    const thumb = await sharp(base).resize({ width: 1024, withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer()
    const boxes = await geminiDateBoxes(thumb.toString('base64'), 'image/jpeg', DATEBOX_MODEL, opts.geminiApiKey)
    diag.boxes = boxes.length
    if (boxes.length === 0) { diag.error = 'no_boxes'; return { text: '', diag } }

    const texts: string[] = []
    for (const b of boxes.slice(0, 2)) { // cap at 2 regions to bound latency
      // Widen the bbox horizontally (the handwritten month spreads past a tight
      // box) but stay bounded so the request can't time out. Tight crops garbled
      // the month (month_hits=0); full-width bands timed out — this is the middle.
      const hpad = 0.10, vpad = 0.03
      const left = Math.max(0, Math.round((Math.min(b.xmin, b.xmax) / 1000 - hpad) * W))
      const top = Math.max(0, Math.round((Math.min(b.ymin, b.ymax) / 1000 - vpad) * H))
      const w = Math.min(W - left, Math.max(1, Math.round((Math.abs(b.xmax - b.xmin) / 1000 + 2 * hpad) * W)))
      const h = Math.min(H - top, Math.max(1, Math.round((Math.abs(b.ymax - b.ymin) / 1000 + 2 * vpad) * H)))
      if (w < 8 || h < 8) continue
      const crop = await sharp(base)
        .extract({ left, top, width: w, height: h })
        .resize({ width: Math.min(1800, w * 4), withoutEnlargement: false })
        .sharpen()
        .jpeg({ quality: 92 })
        .toBuffer()
      diag.crops++
      // PRIMARY crop reader = Gemini on the high-res crop (Google Vision is billing-
      // disabled on this account). Fall back to the Vision provider IF it ever works.
      const gem = await geminiReadDateCrop(crop.toString('base64'), opts.geminiModel, opts.geminiApiKey)
      if (process.env.DATE_CROP_DEBUG === '1') console.info('[date_crop_debug] crop read:', JSON.stringify(gem))
      if (gem.trim()) { texts.push(gem); continue }
      const r = await opts.vision.extractText({ imageBuffer: crop, mimeType: 'image/jpeg' })
      if (!isUnusableOcr(r) && r.raw_text) texts.push(r.raw_text)
    }
    const text = texts.join('\n')
    diag.chars = text.length
    return { text, diag }
  } catch (e) { diag.error = e instanceof Error ? e.message.slice(0, 60) : 'err'; return { text: '', diag } }
}
