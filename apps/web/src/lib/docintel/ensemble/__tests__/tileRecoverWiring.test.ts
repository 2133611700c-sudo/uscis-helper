/**
 * tileRecoverWiring.test.ts — STAGE 4 is wired UNIFORMLY: readDocument runs the hi-res tile
 * recovery (behind HIRES_TILE_RECOVER_ENABLED, using opts.originalBuffer), and all 4 OCR routes
 * pass the pre-downscale original (rawBuffer) so the tiles carry real resolution. Source-inspection
 * (the route/reader can't be mounted); the recovery behavior itself is unit-tested in
 * tileRegionRead.test.ts and proven live (test-wired-recover.mjs recovered 7/7).
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, rel), 'utf-8')

describe('readDocument runs tile recovery behind the flag', () => {
  const SRC = read('../../documentFieldReader.ts')
  it('imports the STAGE 4 pieces', () => {
    expect(SRC).toMatch(/recoverEmptyFieldsByTiles/)
    expect(SRC).toMatch(/geminiReadFieldsFromCrop/)
    expect(SRC).toMatch(/isHiResTileRecoverEnabled/)
  })
  it('gates on the flag AND the original buffer, with empty-critical short-circuit', () => {
    expect(SRC).toMatch(/isHiResTileRecoverEnabled\(\)\s*&&\s*opts\.originalBuffer/)
    expect(SRC).toMatch(/hasEmptyCritical/)
  })
  it('orients the hi-res original before tiling (reliable geometry)', () => {
    expect(SRC).toMatch(/orientToUpright\(opts\.originalBuffer/)
  })
  it('declares the originalBuffer opt', () => {
    expect(SRC).toMatch(/originalBuffer\?\:\s*Buffer/)
  })
})

describe('all 4 OCR routes pass the high-res original to readDocument', () => {
  const ROUTES: Array<[string, string]> = [
    ['TPS', '../../../../app/api/tps/ocr/extract/route.ts'],
    ['EAD', '../../../../app/api/ead/ocr/extract/route.ts'],
    ['Re-Parole', '../../../../app/api/reparole/ocr/extract/route.ts'],
    ['Translation', '../../../../app/api/translation/vision-extract/route.ts'],
  ]
  for (const [name, rel] of ROUTES) {
    it(`${name} passes originalBuffer: rawBuffer`, () => {
      expect(read(rel)).toMatch(/originalBuffer:\s*rawBuffer/)
    })
  }
})
