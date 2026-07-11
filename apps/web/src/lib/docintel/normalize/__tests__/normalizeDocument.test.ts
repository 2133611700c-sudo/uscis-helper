/**
 * normalizeDocument — orchestrator behavior with fully MOCKED deps (no paid,
 * no native pdf/tesseract). Small synthetic images via sharp (installed in CI).
 */

import { describe, it, expect, vi } from 'vitest'
import sharp from 'sharp'
import { normalizeDocument, type NormalizeDeps } from '../normalizeDocument'
import type { Orientation, RawDoc } from '../types'

async function tinyJpeg(r = 200, g = 200, b = 200): Promise<Buffer> {
  return sharp({ create: { width: 64, height: 48, channels: 3, background: { r, g, b } } })
    .jpeg()
    .toBuffer()
}

function pdfBuf(tag = 'x'): Buffer {
  // Starts with %PDF magic so isPdf() routes it to rasterizePdf.
  return Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.from(tag)])
}

/** Base deps that do NOTHING external; each test overrides what it asserts. */
function passthroughDeps(over: Partial<NormalizeDeps> = {}): Partial<NormalizeDeps> {
  return {
    exifNormalize: async (b) => b,
    detectOrientationOsd: async () => ({ rotation: 0 as Orientation, confident: false }),
    applyOrientation: async (b) => b,
    estimateSkewDeg: async () => 0,
    applyDeskew: async (b) => b,
    qualityOf: () => 'proceed',
    rasterizePdf: async () => ({ pages: [] as Buffer[], error: 'unused' }),
    ...over,
  }
}

describe('normalizeDocument — orientation mechanism', () => {
  for (const rotation of [0, 90, 180, 270] as Orientation[]) {
    it(`requests corrective rotation ${rotation} and records orientationApplied`, async () => {
      const img = await tinyJpeg()
      const applyOrientation = vi.fn(async (b: Buffer) => b)
      const deps = passthroughDeps({
        detectOrientationOsd: async () => ({ rotation, confident: rotation !== 0 }),
        applyOrientation,
      })
      const res = await normalizeDocument([{ buffer: img, mimeType: 'image/jpeg' }], { deps })
      expect(res.pages).toHaveLength(1)
      expect(res.pages[0].orientationApplied).toBe(rotation)
      if (rotation === 0) {
        expect(applyOrientation).not.toHaveBeenCalled()
      } else {
        expect(applyOrientation).toHaveBeenCalledWith(expect.any(Buffer), rotation)
      }
    })
  }

  it('does NOT rotate when OSD is not confident even if rotation != 0', async () => {
    const img = await tinyJpeg()
    const applyOrientation = vi.fn(async (b: Buffer) => b)
    const deps = passthroughDeps({
      detectOrientationOsd: async () => ({ rotation: 90 as Orientation, confident: false }),
      applyOrientation,
    })
    const res = await normalizeDocument([{ buffer: img, mimeType: 'image/jpeg' }], { deps })
    expect(res.pages[0].orientationApplied).toBe(0)
    expect(applyOrientation).not.toHaveBeenCalled()
  })
})

describe('normalizeDocument — PDF handling', () => {
  it('splits a PDF into ordered pages with correct sourceIndex/pageIndex', async () => {
    const p0 = await tinyJpeg(10, 10, 10)
    const p1 = await tinyJpeg(20, 20, 20)
    const p2 = await tinyJpeg(30, 30, 30)
    const rasterizePdf = vi.fn(async () => ({ pages: [p0, p1, p2] }))
    const deps = passthroughDeps({ rasterizePdf })
    const res = await normalizeDocument([{ buffer: pdfBuf(), mimeType: 'application/pdf' }], { deps })
    expect(res.failures).toHaveLength(0)
    expect(res.pages).toHaveLength(3)
    expect(res.pages.map((p) => p.pageIndex)).toEqual([0, 1, 2])
    expect(res.pages.every((p) => p.sourceIndex === 0)).toBe(true)
    expect(res.pages.every((p) => p.mimeType === 'image/png')).toBe(true)
  })

  it('records a NormalizeFailure and emits NO page when raster returns empty+error', async () => {
    const rasterizePdf = vi.fn(async () => ({ pages: [] as Buffer[], error: 'boom' }))
    const deps = passthroughDeps({ rasterizePdf })
    const res = await normalizeDocument([{ buffer: pdfBuf(), mimeType: 'application/pdf' }], { deps })
    expect(res.pages).toHaveLength(0)
    expect(res.failures).toEqual([{ sourceIndex: 0, reason: 'boom' }])
  })
})

describe('normalizeDocument — order + deskew', () => {
  it('preserves output order across multiple sources', async () => {
    const a = await tinyJpeg(1, 1, 1)
    const b = await tinyJpeg(2, 2, 2)
    const c = await tinyJpeg(3, 3, 3)
    const deps = passthroughDeps()
    const docs: RawDoc[] = [
      { buffer: a, mimeType: 'image/jpeg' },
      { buffer: b, mimeType: 'image/jpeg' },
      { buffer: c, mimeType: 'image/jpeg' },
    ]
    const res = await normalizeDocument(docs, { deps })
    expect(res.pages.map((p) => p.sourceIndex)).toEqual([0, 1, 2])
    expect(res.pages.map((p) => p.pageIndex)).toEqual([0, 0, 0])
  })

  it('applies deskew and records the signed degrees', async () => {
    const img = await tinyJpeg()
    const applyDeskew = vi.fn(async (b: Buffer) => Buffer.from([...b, 0])) // return a DIFFERENT buffer
    const deps = passthroughDeps({
      estimateSkewDeg: async () => 3.0,
      applyDeskew,
    })
    const res = await normalizeDocument([{ buffer: img, mimeType: 'image/jpeg' }], { deps })
    expect(applyDeskew).toHaveBeenCalledWith(expect.any(Buffer), 3.0)
    expect(res.pages[0].deskewDeg).toBe(3.0)
    expect(res.pages[0].mimeType).toBe('image/jpeg')
  })
})
