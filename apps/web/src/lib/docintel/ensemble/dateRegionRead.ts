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
import { isBlocked } from '@/lib/ocr/types'

interface BBox { ymin: number; xmin: number; ymax: number; xmax: number }

const GEMINI_URL = (model: string, key: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`

async function geminiDateBoxes(imageB64: string, mime: string, model: string, key: string): Promise<BBox[]> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 25_000)
  try {
    const prompt =
      'Find EVERY handwritten or printed DATE on this document (date of birth, date of issue, etc.). ' +
      'Return ONLY JSON: {"boxes":[{"ymin":n,"xmin":n,"ymax":n,"xmax":n}]} with coordinates normalized 0-1000. Max 4 boxes.'
    const res = await fetch(GEMINI_URL(model, key), {
      method: 'POST', signal: ctrl.signal, headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mime, data: imageB64 } }] }],
        generationConfig: { temperature: 0, response_mime_type: 'application/json' },
      }),
    })
    if (!res.ok) return []
    const j = await res.json()
    const txt = j?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}'
    const parsed = JSON.parse(txt)
    const boxes = Array.isArray(parsed?.boxes) ? parsed.boxes : []
    return boxes.filter((b: BBox) => [b.ymin, b.xmin, b.ymax, b.xmax].every((n) => typeof n === 'number')).slice(0, 4)
  } catch { return [] } finally { clearTimeout(t) }
}

/**
 * Read the document's date regions with a zoomed second-engine pass.
 * Returns combined OCR text from the zoomed date crops (or '' on any failure).
 */
export async function readDateRegionsWithVision(opts: {
  imageBuffer: Buffer
  mimeType: string
  geminiApiKey: string
  geminiModel: string
  vision: OcrProvider
}): Promise<string> {
  try {
    // sharp is server-only; import lazily so the module is edge-safe.
    const sharp = (await import('sharp')).default
    const base = await sharp(opts.imageBuffer).rotate().toBuffer()
    const meta = await sharp(base).metadata()
    const W = meta.width ?? 0, H = meta.height ?? 0
    if (!W || !H) return ''

    const boxes = await geminiDateBoxes(base.toString('base64'), opts.mimeType, opts.geminiModel, opts.geminiApiKey)
    if (boxes.length === 0) return ''

    const texts: string[] = []
    for (const b of boxes) {
      const pad = 0.04
      const left = Math.max(0, Math.round((Math.min(b.xmin, b.xmax) / 1000 - pad) * W))
      const top = Math.max(0, Math.round((Math.min(b.ymin, b.ymax) / 1000 - pad) * H))
      const w = Math.min(W - left, Math.max(1, Math.round((Math.abs(b.xmax - b.xmin) / 1000 + 2 * pad) * W)))
      const h = Math.min(H - top, Math.max(1, Math.round((Math.abs(b.ymax - b.ymin) / 1000 + 2 * pad) * H)))
      if (w < 8 || h < 8) continue
      const crop = await sharp(base)
        .extract({ left, top, width: w, height: h })
        .resize({ width: Math.min(2000, w * 5), withoutEnlargement: false })
        .sharpen()
        .jpeg({ quality: 95 })
        .toBuffer()
      const r = await opts.vision.extractText({ imageBuffer: crop, mimeType: 'image/jpeg' })
      if (!isBlocked(r) && r.raw_text) texts.push(r.raw_text)
    }
    return texts.join('\n')
  } catch { return '' }
}
