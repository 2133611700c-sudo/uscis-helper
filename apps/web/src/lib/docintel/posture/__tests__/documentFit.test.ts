/**
 * documentFit — conservative page-fit helper.
 *
 * Real-doc evidence is used for the full-page path, and one synthetic border-heavy crop
 * exercises the cropped-or-partial branch without relying on a hidden oracle.
 */
import { readFile, access } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import sharp from 'sharp'
import { assessDocumentFit } from '../documentFit'

const ROOT = path.resolve(process.cwd(), '..', '..')
const REAL_DOCS = path.join(ROOT, 'test-fixtures/real-docs')

// CI FIX (2026-07-06): test-fixtures/real-docs is gitignored (owner's real documents —
// never committed, per project PII policy). This test unconditionally read from it and
// therefore ALWAYS failed in CI (ENOENT) since the file was added — it only ever passed
// on a local machine with the private fixtures on disk. Self-skip when absent, matching
// the existing HAS_POPPLER convention elsewhere in this repo, so a skip is loud (reported)
// rather than a silent CI failure. A local run with the fixtures present still exercises it.
async function realDocsAvailable(): Promise<boolean> {
  try { await access(REAL_DOCS); return true } catch { return false }
}
const HAS_REAL_DOCS = await realDocsAvailable()

describe('assessDocumentFit — real docs can remain full_page_visible', () => {
  it.skipIf(!HAS_REAL_DOCS)('birth cert and military id remain full-page visible', async () => {
    const fixtures = [
      'birth_cert_handwritten_01.jpg',
      'military_id_p1_01.jpg',
      'divorce_blank_template.jpg',
    ] as const

    for (const file of fixtures) {
      const buffer = await readFile(path.join(REAL_DOCS, file))
      const fit = await assessDocumentFit(buffer, 'full_page_image')
      expect(fit.document_fit, file).toBe('full_page_visible')
    }
  })

  it('reports when the private real-docs fixture set is unavailable (so a skip is never mistaken for a pass)', () => {
    if (!HAS_REAL_DOCS) console.warn('[documentFit] test-fixtures/real-docs absent (CI/no local fixtures) — real-doc fit assertions skipped')
    expect(true).toBe(true)
  })
})

describe('assessDocumentFit — explicit manual crops and obvious partials', () => {
  it('manual_crop is preserved as manual_crop', async () => {
    const buffer = await sharp({
      create: { width: 64, height: 64, channels: 3, background: '#fff' },
    }).jpeg().toBuffer()
    const fit = await assessDocumentFit(buffer, 'manual_crop')
    expect(fit.document_fit).toBe('manual_crop')
  })

  it('obvious edge-to-edge crop is classified as cropped_or_partial', async () => {
    const partial = await sharp(Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96">' +
      '<rect width="96" height="96" fill="white"/>' +
      '<rect y="0" width="96" height="5" fill="black"/>' +
      '<rect y="91" width="96" height="5" fill="black"/>' +
      '<rect x="0" width="5" height="96" fill="black"/>' +
      '<rect x="91" width="5" height="96" fill="black"/>' +
      '</svg>',
    )).png().toBuffer()
    const fit = await assessDocumentFit(partial, 'full_page_image')
    expect(fit.document_fit).toBe('cropped_or_partial')
    expect(fit.edge_contact_count).toBe(4)
  })
})
