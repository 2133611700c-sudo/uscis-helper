/**
 * Google Cloud Vision — DOCUMENT_TEXT_DETECTION provider
 *
 * Uses the REST API (no SDK dependency) with an API key.
 * Returns every word with a stable ID (w_NNNN) and a normalised bbox.
 *
 * Required env var: GOOGLE_CLOUD_VISION_API_KEY
 * If missing → returns OcrBlockedResult (not an error) so the route
 * can surface a 503 with actionable guidance.
 *
 * Do NOT log the API key. Do NOT expose raw response to the client.
 */
import type { OcrProvider, OcrResult, OcrBlockedResult, OcrWord, OcrLine, OcrPage, OcrBoundingBox } from '../types'

const VISION_API_URL = 'https://vision.googleapis.com/v1/images:annotate'
const VISION_TIMEOUT_MS = 12_000   // Google Vision: typically 1–5s; 12s safety margin
const PROVIDER_NAME = 'google_vision'

// ── Google Vision response shapes ────────────────────────────────────────────

interface GVertex { x?: number; y?: number }
interface GBoundingPoly { vertices: GVertex[] }

interface GSymbol {
  text: string
  confidence?: number
  boundingBox?: GBoundingPoly
}

interface GWord {
  symbols: GSymbol[]
  confidence?: number
  boundingBox?: GBoundingPoly
}

interface GParagraph {
  words: GWord[]
  confidence?: number
  boundingBox?: GBoundingPoly
}

interface GBlock {
  paragraphs: GParagraph[]
  confidence?: number
  boundingBox?: GBoundingPoly
}

interface GPageLayout {
  width: number
  height: number
  blocks: GBlock[]
}

interface GFullTextAnnotation {
  text: string
  pages: GPageLayout[]
}

interface GAnnotateResponse {
  fullTextAnnotation?: GFullTextAnnotation
  error?: { code: number; message: string }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function verticesToBbox(vertices: GVertex[], pageW: number, pageH: number): OcrBoundingBox {
  if (!vertices || vertices.length === 0) return { x: 0, y: 0, width: 1, height: 1 }
  const xs = vertices.map(v => v.x ?? 0)
  const ys = vertices.map(v => v.y ?? 0)
  const x0 = Math.min(...xs)
  const y0 = Math.min(...ys)
  const x1 = Math.max(...xs)
  const y1 = Math.max(...ys)
  const safeW = pageW > 0 ? pageW : 1
  const safeH = pageH > 0 ? pageH : 1
  return {
    x: x0 / safeW,
    y: y0 / safeH,
    width:  (x1 - x0) / safeW,
    height: (y1 - y0) / safeH,
  }
}

function wordText(gw: GWord): string {
  return (gw.symbols ?? []).map(s => s.text ?? '').join('')
}

// ── Provider implementation ───────────────────────────────────────────────────

export const googleVisionProvider: OcrProvider = {
  async extractText({ imageBuffer, mimeType }): Promise<OcrResult | OcrBlockedResult> {
    // Accept either env-var name — historically the Translation Engine
    // used GOOGLE_CLOUD_VISION_API_KEY while ops set GOOGLE_VISION_API_KEY
    // in repo .env.local. Reading both keeps every deploy working without
    // a flag-day rename.
    const apiKey =
      process.env.GOOGLE_CLOUD_VISION_API_KEY ||
      process.env.GOOGLE_VISION_API_KEY
    if (!apiKey) {
      return {
        blocked: true,
        reason:
          'Google Cloud Vision API key is not configured. ' +
          'Add GOOGLE_CLOUD_VISION_API_KEY (or GOOGLE_VISION_API_KEY) to your environment variables.',
        required_env_vars: ['GOOGLE_CLOUD_VISION_API_KEY'],
      }
    }

    const startMs = Date.now()
    const imageBase64 = imageBuffer.toString('base64')

    const requestBody = {
      requests: [{
        image: { content: imageBase64 },
        features: [{ type: 'DOCUMENT_TEXT_DETECTION', maxResults: 1 }],
        imageContext: {
          languageHints: ['uk', 'en', 'ru'],  // Ukrainian, English, Russian
        },
      }],
    }

    let gResponse: GAnnotateResponse
    try {
      const res = await fetch(`${VISION_API_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(VISION_TIMEOUT_MS),
      })

      if (!res.ok) {
        const errBody = await res.text().catch(() => '')
        // Do NOT include errBody verbatim — may contain key reflection
        console.error(`[google-vision] HTTP ${res.status} — redacted error body`)
        return buildEmptyResult(Date.now() - startMs, [`Vision API HTTP ${res.status}`])
      }

      const data = await res.json() as { responses?: GAnnotateResponse[] }
      gResponse = data.responses?.[0] ?? {}
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[google-vision] fetch failed:', msg)
      return buildEmptyResult(Date.now() - startMs, [`Vision fetch error: ${msg}`])
    }

    if (gResponse.error) {
      console.error('[google-vision] API error:', gResponse.error.code, gResponse.error.message)
      return buildEmptyResult(Date.now() - startMs, [`Vision error ${gResponse.error.code}`])
    }

    const fta = gResponse.fullTextAnnotation
    if (!fta) {
      return buildEmptyResult(Date.now() - startMs, ['No text detected in image'])
    }

    // ── Parse pages → lines → words with stable IDs ──────────────────────────
    const allPages: OcrPage[] = []
    const allLines: OcrLine[] = []
    const allWords: OcrWord[] = []

    let wordCounter = 0
    let lineCounter = 0

    for (let pi = 0; pi < fta.pages.length; pi++) {
      const gPage = fta.pages[pi]
      const pageNum = pi + 1
      const pageW = gPage.width ?? 1
      const pageH = gPage.height ?? 1

      const pageWords: OcrWord[] = []
      const pageLines: OcrLine[] = []

      for (const gBlock of (gPage.blocks ?? [])) {
        for (const gPara of (gBlock.paragraphs ?? [])) {
          // Treat each paragraph as a line
          const lineId = `l_${String(lineCounter).padStart(4, '0')}`
          lineCounter++

          const lineWords: OcrWord[] = []
          let lineText = ''

          for (const gWord of (gPara.words ?? [])) {
            const text = wordText(gWord)
            if (!text) continue

            const wordId = `w_${String(wordCounter).padStart(4, '0')}`
            wordCounter++

            const bbox = gWord.boundingBox
              ? verticesToBbox(gWord.boundingBox.vertices, pageW, pageH)
              : { x: 0, y: 0, width: 1, height: 1 }

            const word: OcrWord = {
              id: wordId,
              text,
              page: pageNum,
              bbox,
              confidence: gWord.confidence,
              source: PROVIDER_NAME,
            }

            lineWords.push(word)
            pageWords.push(word)
            allWords.push(word)
            lineText += (lineText ? ' ' : '') + text
          }

          if (lineWords.length === 0) continue

          // Line bbox = union of word bboxes
          const lx0 = Math.min(...lineWords.map(w => w.bbox.x))
          const ly0 = Math.min(...lineWords.map(w => w.bbox.y))
          const lx1 = Math.max(...lineWords.map(w => w.bbox.x + w.bbox.width))
          const ly1 = Math.max(...lineWords.map(w => w.bbox.y + w.bbox.height))
          const lineBbox: OcrBoundingBox = { x: lx0, y: ly0, width: lx1 - lx0, height: ly1 - ly0 }

          const avgConf = lineWords.reduce((s, w) => s + (w.confidence ?? 0.9), 0) / lineWords.length

          const line: OcrLine = {
            id: lineId,
            text: lineText,
            page: pageNum,
            bbox: lineBbox,
            words: lineWords,
            confidence: avgConf,
            source: PROVIDER_NAME,
          }

          pageLines.push(line)
          allLines.push(line)
        }
      }

      allPages.push({
        page: pageNum,
        width: pageW,
        height: pageH,
        lines: pageLines,
        words: pageWords,
      })
    }

    const processingMs = Date.now() - startMs

    return {
      provider: PROVIDER_NAME,
      raw_text: fta.text ?? '',
      pages: allPages,
      lines: allLines,
      words: allWords,
      processing_ms: processingMs,
      warnings: [],
      created_at: new Date().toISOString(),
    }
  },
}

function buildEmptyResult(processingMs: number, warnings: string[]): OcrResult {
  return {
    provider: PROVIDER_NAME,
    raw_text: '',
    pages: [],
    lines: [],
    words: [],
    processing_ms: processingMs,
    warnings,
    created_at: new Date().toISOString(),
  }
}
