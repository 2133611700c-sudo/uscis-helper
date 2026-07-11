/**
 * docintel/normalize/normalizeDocument — the single front-loaded normalization
 * orchestrator. Raw image/PDF docs → ordered per-page normalized upright buffers
 * that BOTH intake and the reader physically consume.
 *
 * FREE + deterministic default path (sharp EXIF + tesseract OSD + projection
 * deskew + sharp rotation). NO paid/LLM calls here. All external effects are
 * injectable (NormalizeDeps) so tests run with zero native/paid work.
 *
 * NEVER throws: a per-source error becomes a NormalizeFailure. A PDF that renders
 * to zero pages is a HARD FAILURE (recorded), never a silent empty success.
 */

import sharp from 'sharp'
import { checkImageQuality } from '@/lib/canonical/core/documentClassPolicy'
import { rasterizePdf, isPdf } from './pdfRaster'
import { detectOrientationOsd, applyOrientation } from './orient'
import { estimateSkewDeg, applyDeskew } from './deskew'
import type {
  NormalizeResult,
  NormalizedPage,
  Orientation,
  RawDoc,
} from './types'

export interface NormalizeDeps {
  rasterizePdf: typeof rasterizePdf
  detectOrientationOsd: (buf: Buffer) => Promise<{ rotation: Orientation; confident: boolean }>
  applyOrientation: (buf: Buffer, r: Orientation) => Promise<Buffer>
  estimateSkewDeg: (buf: Buffer) => Promise<number>
  applyDeskew: (buf: Buffer, d: number) => Promise<Buffer>
  exifNormalize: (buf: Buffer) => Promise<Buffer> // sharp(buf).rotate().toBuffer() — EXIF auto-rotate
  qualityOf: (bytes: number) => 'proceed' | 'resize' | 'needs_better_scan' // wrap checkImageQuality with a generic doc class
}

/** EXIF auto-rotate: sharp(buf).rotate() with NO angle honours the EXIF tag. */
async function defaultExifNormalize(buf: Buffer): Promise<Buffer> {
  return sharp(buf).rotate().toBuffer()
}

/** Wrap checkImageQuality with the generic 'unknown_document' class. */
function defaultQualityOf(bytes: number): 'proceed' | 'resize' | 'needs_better_scan' {
  return checkImageQuality('unknown_document', bytes).action
}

function defaultDeps(): NormalizeDeps {
  return {
    rasterizePdf,
    detectOrientationOsd,
    applyOrientation,
    estimateSkewDeg,
    applyDeskew,
    exifNormalize: defaultExifNormalize,
    qualityOf: defaultQualityOf,
  }
}

/** A page candidate before per-page normalization is applied. */
interface PageCandidate {
  buffer: Buffer
  mimeType: string
  sourceIndex: number
  pageIndex: number
}

export async function normalizeDocument(
  docs: RawDoc[],
  opts?: { maxPages?: number; deps?: Partial<NormalizeDeps> },
): Promise<NormalizeResult> {
  const deps: NormalizeDeps = { ...defaultDeps(), ...(opts?.deps ?? {}) }
  const maxPages = opts?.maxPages ?? 6

  const pages: NormalizedPage[] = []
  const failures: NormalizeResult['failures'] = []

  // Preserve source order, then page order within a source.
  for (let sourceIndex = 0; sourceIndex < docs.length; sourceIndex++) {
    const doc = docs[sourceIndex]
    let candidates: PageCandidate[]

    try {
      if (isPdf(doc.buffer)) {
        const raster = await deps.rasterizePdf(doc.buffer, { maxPages })
        if (raster.error || raster.pages.length === 0) {
          // HARD FAILURE — never emit a page for this source.
          failures.push({
            sourceIndex,
            reason: raster.error ?? 'pdf_had_no_renderable_pages',
          })
          continue
        }
        candidates = raster.pages.map((buffer, pageIndex) => ({
          buffer,
          mimeType: 'image/png',
          sourceIndex,
          pageIndex,
        }))
      } else {
        candidates = [
          {
            buffer: doc.buffer,
            mimeType: doc.mimeType || 'image/jpeg',
            sourceIndex,
            pageIndex: 0,
          },
        ]
      }
    } catch (e) {
      failures.push({
        sourceIndex,
        reason: e instanceof Error ? `source_prepare_failed:${e.message.slice(0, 80)}` : 'source_prepare_failed',
      })
      continue
    }

    for (const cand of candidates) {
      try {
        const page = await normalizeOnePage(cand, deps)
        pages.push(page)
      } catch (e) {
        failures.push({
          sourceIndex,
          reason: e instanceof Error ? `page_normalize_failed:${e.message.slice(0, 80)}` : 'page_normalize_failed',
        })
      }
    }
  }

  return { pages, failures }
}

async function normalizeOnePage(cand: PageCandidate, deps: NormalizeDeps): Promise<NormalizedPage> {
  // 1) EXIF auto-rotate (free, deterministic).
  let buffer = await deps.exifNormalize(cand.buffer)
  let mimeType = cand.mimeType

  // 2) Coarse orientation (deterministic OSD). Only applied when confident.
  let orientationApplied: Orientation = 0
  const osd = await deps.detectOrientationOsd(buffer)
  if (osd.confident && osd.rotation !== 0) {
    buffer = await deps.applyOrientation(buffer, osd.rotation)
    orientationApplied = osd.rotation
  }

  // 3) Deskew (free projection-profile).
  const deskewDeg = await deps.estimateSkewDeg(buffer)
  const deskewed = await deps.applyDeskew(buffer, deskewDeg)
  if (deskewed !== buffer) {
    buffer = deskewed
    // applyDeskew emits JPEG when it actually rotates.
    mimeType = 'image/jpeg'
  }

  const bytes = buffer.length
  const quality = deps.qualityOf(bytes)

  return {
    buffer,
    mimeType,
    sourceIndex: cand.sourceIndex,
    pageIndex: cand.pageIndex,
    orientationApplied,
    deskewDeg,
    quality,
    bytes,
  }
}
