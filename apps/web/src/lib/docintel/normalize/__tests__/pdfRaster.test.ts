/**
 * pdfRaster — isPdf magic-byte detection only. We do NOT invoke real pdfjs /
 * @napi-rs/canvas here: those native deps may be absent when tests run without a
 * full install, and rasterizePdf's contract (never throw) is exercised via the
 * mocked orchestrator test instead. Keeping to isPdf keeps this green with no dep.
 */

import { describe, it, expect } from 'vitest'
import { isPdf } from '../pdfRaster'

describe('isPdf', () => {
  it('true for a %PDF-prefixed buffer', () => {
    expect(isPdf(Buffer.from('%PDF-1.7\n...rest'))).toBe(true)
  })

  it('false for a JPEG magic buffer', () => {
    // JPEG SOI marker 0xFF 0xD8 0xFF
    expect(isPdf(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe(false)
  })

  it('false for a PNG magic buffer', () => {
    expect(isPdf(Buffer.from([0x89, 0x50, 0x4e, 0x47]))).toBe(false)
  })

  it('false for buffers shorter than 4 bytes', () => {
    expect(isPdf(Buffer.from([0x25, 0x50]))).toBe(false)
  })
})
