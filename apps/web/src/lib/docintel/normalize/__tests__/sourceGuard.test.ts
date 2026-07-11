/**
 * sourceGuard — read the vision-extract route as TEXT and assert the wiring is
 * present and ordered correctly. Intent-based string checks (imports, indexOf
 * ordering, key identifiers), NOT brittle char-count regexes. This proves:
 *   - normalization is imported + flag-gated,
 *   - the Core reader consumes normalized page buffers when ON,
 *   - the failure branch returns a typed failure (no silent pass-through).
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const routePath = resolve(
  __dirname,
  '../../../../app/api/translation/vision-extract/route.ts',
)
const src = readFileSync(routePath, 'utf8')

describe('vision-extract route — Document Normalization wiring', () => {
  it('imports normalizeDocument and isDocNormalizeEnabled', () => {
    expect(src).toContain('isDocNormalizeEnabled')
    expect(src).toContain('normalizeDocument')
    expect(src).toContain("from '@/lib/docintel/normalize/flags'")
    expect(src).toContain("from '@/lib/docintel/normalize/normalizeDocument'")
  })

  it('flag-gates the normalization block', () => {
    expect(src).toContain('if (isDocNormalizeEnabled())')
  })

  it('assigns normalizedPages BEFORE the Core readDocument call', () => {
    const assignIdx = src.indexOf('normalizedPages = norm.pages')
    const pagesToReadIdx = src.indexOf('const pagesToRead = normalizedPages')
    const readIdx = src.indexOf('const r = await readDocument(buf, mime, effectiveReaderDocTypeId')
    expect(assignIdx).toBeGreaterThan(-1)
    expect(pagesToReadIdx).toBeGreaterThan(-1)
    expect(readIdx).toBeGreaterThan(-1)
    expect(assignIdx).toBeLessThan(pagesToReadIdx)
    expect(pagesToReadIdx).toBeLessThan(readIdx)
  })

  it('Core reader consumes normalized page buffers when normalization is on', () => {
    expect(src).toContain('normalizedPages.map((p) => ({ buf: p.buffer, mime: p.mimeType }))')
  })

  it('intake firstBuf references normalizedPages on the on-branch', () => {
    const firstBufIdx = src.indexOf('const firstBuf = normalizedPages')
    expect(firstBufIdx).toBeGreaterThan(-1)
  })

  it('failure branch returns document_normalization_failed (no silent pass-through)', () => {
    expect(src).toContain("reason: 'document_normalization_failed'")
    // The failure branch triggers on zero normalized pages.
    expect(src).toContain('norm.pages.length === 0')
  })
})
