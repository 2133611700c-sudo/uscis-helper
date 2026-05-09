/**
 * OCR Provider Types — Messenginfo v6.0
 *
 * Architecture: Dedicated OCR provider returns words/lines with stable IDs
 * and bounding boxes. DeepSeek Text then maps fields by referencing those IDs.
 * The backend resolves IDs → exact bboxes. No coordinates are ever sent to
 * DeepSeek for calculation.
 */

// ── Bounding box ──────────────────────────────────────────────────────────────

/**
 * Normalised bounding box (0–1 relative to image dimensions).
 * x, y = top-left corner; width, height extend right and down.
 */
export interface OcrBoundingBox {
  x: number       // left edge  (0–1)
  y: number       // top edge   (0–1)
  width: number   // (0–1)
  height: number  // (0–1)
}

/** Convert bbox to [x0, y0, x1, y1] tuple used in ExtractedField */
export function bboxToTuple(b: OcrBoundingBox): [number, number, number, number] {
  return [b.x, b.y, b.x + b.width, b.y + b.height]
}

/** Compute union of multiple bounding boxes */
export function unionBboxes(boxes: OcrBoundingBox[]): OcrBoundingBox {
  if (boxes.length === 0) return { x: 0, y: 0, width: 1, height: 1 }
  const x0 = Math.min(...boxes.map(b => b.x))
  const y0 = Math.min(...boxes.map(b => b.y))
  const x1 = Math.max(...boxes.map(b => b.x + b.width))
  const y1 = Math.max(...boxes.map(b => b.y + b.height))
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 }
}

// ── Token types ───────────────────────────────────────────────────────────────

export interface OcrWord {
  id: string            // stable ID, e.g. "w_0012"
  text: string          // verbatim text as recognised
  page: number          // 1-indexed page number
  bbox: OcrBoundingBox  // normalised 0–1
  confidence?: number   // 0.0–1.0 if provider supplies it
  source: string        // provider name
}

export interface OcrLine {
  id: string            // stable ID, e.g. "l_001"
  text: string          // concatenated words
  page: number
  bbox: OcrBoundingBox
  words: OcrWord[]
  confidence?: number
  source: string
}

export interface OcrPage {
  page: number          // 1-indexed
  width: number         // pixels (original image)
  height: number        // pixels
  lines: OcrLine[]
  words: OcrWord[]      // flat list (same as words within lines)
}

// ── Provider result ───────────────────────────────────────────────────────────

export interface OcrResult {
  provider: string        // e.g. 'google_vision'
  raw_text: string        // full text concatenation
  pages: OcrPage[]        // one per processed image page
  lines: OcrLine[]        // flattened across all pages
  words: OcrWord[]        // flattened across all pages
  processing_ms: number   // wall-clock time for the OCR call
  warnings: string[]
  created_at: string      // ISO 8601
}

// ── Provider interface ────────────────────────────────────────────────────────

export interface OcrProvider {
  /**
   * Run OCR on a single image buffer.
   * Must return stable word IDs and normalised bounding boxes.
   * If credentials are missing, must return a BLOCKED result (not throw).
   */
  extractText(params: {
    imageBuffer: Buffer
    mimeType: string      // 'image/jpeg' | 'image/png' | 'image/webp'
  }): Promise<OcrResult | OcrBlockedResult>
}

// ── BLOCKED sentinel ──────────────────────────────────────────────────────────

/**
 * Returned when required environment variables are missing.
 * The route handler inspects this and returns HTTP 503 with instructions.
 */
export interface OcrBlockedResult {
  blocked: true
  reason: string
  required_env_vars: string[]   // exact names, no values
}

export function isBlocked(r: OcrResult | OcrBlockedResult): r is OcrBlockedResult {
  return (r as OcrBlockedResult).blocked === true
}
