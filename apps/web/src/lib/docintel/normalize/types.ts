/**
 * docintel/normalize/types — shared shapes for the front-loaded document
 * normalization layer. Raw image/PDF → per-page normalized upright buffers
 * that BOTH intake and the reader physically consume. No paid/LLM types here.
 */

export type Orientation = 0 | 90 | 180 | 270

export interface NormalizedPage {
  buffer: Buffer
  mimeType: string // always 'image/jpeg' or 'image/png' after normalization
  sourceIndex: number // index into the original uploaded files
  pageIndex: number // 0-based page within that source (PDF multi-page)
  orientationApplied: Orientation
  deskewDeg: number // signed degrees applied (0 if none)
  quality: 'proceed' | 'resize' | 'needs_better_scan'
  bytes: number
}

export interface NormalizeFailure {
  sourceIndex: number
  reason: string
}

export interface NormalizeResult {
  pages: NormalizedPage[]
  failures: NormalizeFailure[]
}

export interface RawDoc {
  buffer: Buffer
  mimeType: string
}
