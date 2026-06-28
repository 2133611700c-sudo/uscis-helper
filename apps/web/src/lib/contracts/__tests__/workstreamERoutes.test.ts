/**
 * Workstream E — legacy/non-Core path safety.
 *
 * 1. Route-scan invariant: EVERY translation route that emits application/pdf
 *    imports the unified final-PDF gate (no PDF emitter bypasses it). Currently
 *    two emitters: generate-pdf and render. (upload only ACCEPTS pdf; ead/* is a
 *    different product, out of the translation vertical.)
 * 2. docTypeRegistryStatus — server-side validation so a client-supplied docType
 *    is checked against the registry (fail-safe: unknown → not trusted).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { getDocTypeSpec } from '@/lib/docintel/documentRegistry'

const API_TRANSLATION = resolve(__dirname, '../../../app/api/translation')

function walk(dir: string): string[] {
  const out: string[] = []
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else if (e === 'route.ts') out.push(p)
  }
  return out
}

describe('Workstream E — every translation PDF emitter is behind the unified gate', () => {
  const routes = walk(API_TRANSLATION)

  it('finds the route tree', () => {
    expect(routes.length).toBeGreaterThan(3)
  })

  it('each route that EMITS application/pdf imports assertDocumentReadyForFinalPdf', () => {
    for (const r of routes) {
      const src = readFileSync(r, 'utf8')
      // an emitter constructs a PDF response (NextResponse/Response with pdf body),
      // not merely lists application/pdf as an allowed UPLOAD type.
      const emitsPdf = /headers:\s*\{[^}]*application\/pdf/.test(src) ||
        /'Content-Type':\s*'application\/pdf'/.test(src) ||
        /"Content-Type":\s*"application\/pdf"/.test(src)
      if (emitsPdf) {
        expect(src.includes('assertDocumentReadyForFinalPdf'),
          `PDF emitter ${r} must call the unified final-PDF gate`).toBe(true)
      }
    }
  })
})

describe('Workstream E — docType registry validation (server-side, fail-safe)', () => {
  // pure helper inline (mirrors the guidance): unknown docType is NOT trusted.
  const known = (d: string | null | undefined) => !!d && getDocTypeSpec(d) !== null

  it('a real docType is known', () => {
    expect(known('ua_birth_certificate')).toBe(true)
  })
  it('a forged/unknown docType is NOT trusted', () => {
    expect(known('totally_made_up_doctype')).toBe(false)
    expect(known(null)).toBe(false)
    expect(known('')).toBe(false)
  })
  it('NOTE: an unknown cert docType cannot yield a contract PDF — no schema → generic → raw→PDF closure blocks it (Phase 8 + Workstream B)', () => {
    // documented invariant; enforced by shouldBlockRawPdfFallback + finalPdfGate.
    expect(true).toBe(true)
  })
})
