/**
 * renderOfficialTranslationDeterminism.test.ts — U-STAGE 5.
 *
 * The MIRROR renderer (renderOfficialTranslation, via renderMirrorTranslationPDF)
 * is now the DEFAULT delivered translation PDF for 8 doc types. It must be:
 *
 *   1. BYTE-DETERMINISTIC — two renders of the same input → identical bytes
 *      (V2 immutable-artifact content-address SHA-256 must be stable). Previously
 *      `pdf.save()` had NO metadata pinning, so pdf-lib stamped the wall-clock
 *      CreationDate/ModDate/Producer and bytes drifted every render.
 *   2. The pinned signedAt must really be in the output (a different signedAt
 *      → different bytes), proving determinism is from anchoring, not dropping.
 *   3. LEAK-GATED — ZERO untranslated Cyrillic (U+0400–U+04FF) reaches the output.
 *
 * Mirrors packet/__tests__/{pdfDeterminism,translationPdfVisualAcceptance}.ts for
 * the OTHER (generic) renderer. Poppler gate self-skips where absent; the
 * value-layer leak assertion ALWAYS runs so a skip is never a silent pass.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { createHash } from 'node:crypto'
import { execSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { renderMirrorTranslationPDF } from '../renderMirrorTranslationPDF'
import { getOfficialSchema } from '../../forms/ukraine/schemas/registry'
import { buildMirrorValues, collectMirrorExtras, type ExtractedFieldLite } from '../buildMirrorValues'
import { pdfSafe } from '../renderValue'

const DOC_TYPE = 'ua_birth_certificate'

// Cyrillic INPUT — must be transliterated to Latin in the output, never drawn raw.
const CYRILLIC_FIELDS: ExtractedFieldLite[] = [
  { field: 'child_family_name', normalized_value: 'ШЕВЧЕНКО', review_required: false },
  { field: 'child_given_name', normalized_value: 'ТАРАС', review_required: false },
  { field: 'date_of_birth', normalized_value: '09.03.1814', review_required: false },
  { field: 'place_of_birth_city', normalized_value: 'Моринці', review_required: false },
]

const OPTS = {
  signerName: 'Ivan Ivanenko',
  signerAddress: '1213 Gordon St, Los Angeles, CA 90038',
  signedAt: '2026-05-30T00:00:00Z',
}

const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex')
const CYRILLIC_RE = /[Ѐ-ӿ]/

function popplerAvailable(): boolean {
  try { execSync('pdfinfo -v', { stdio: 'pipe' }); return true } catch { return false }
}
const HAS_POPPLER = popplerAvailable()

describe('U-STAGE 5 — renderOfficialTranslation (mirror) byte determinism', () => {
  it('renders byte-identical bytes for the same input (stable content-address)', async () => {
    const a = await renderMirrorTranslationPDF(DOC_TYPE, CYRILLIC_FIELDS, OPTS)
    const b = await renderMirrorTranslationPDF(DOC_TYPE, CYRILLIC_FIELDS, OPTS)
    expect(a, 'schema resolved for fixture docType').not.toBeNull()
    expect(b).not.toBeNull()
    expect(sha(a!.pdf)).toBe(sha(b!.pdf))
    expect(a!.pdf.length).toBe(b!.pdf.length)
  })

  it('a different signedAt yields different bytes (the pinned date is really in the output)', async () => {
    const a = await renderMirrorTranslationPDF(DOC_TYPE, CYRILLIC_FIELDS, OPTS)
    const b = await renderMirrorTranslationPDF(DOC_TYPE, CYRILLIC_FIELDS, { ...OPTS, signedAt: '2025-01-02T00:00:00Z' })
    expect(sha(a!.pdf)).not.toBe(sha(b!.pdf))
  })
})

describe('U-STAGE 5 — renderOfficialTranslation (mirror) Cyrillic-leak gate', () => {
  // VALUE-LAYER assertion (ALWAYS runs, no poppler needed): nothing with Cyrillic
  // reaches the draw calls. The renderer draws via pdfSafe(...) of every mirror
  // value / extra; assert that the pdfSafe of each candidate string is Cyrillic-free.
  it('no Cyrillic reaches the draw layer (pre-render value gate)', () => {
    const schema = getOfficialSchema(DOC_TYPE)!
    const values = buildMirrorValues(schema, CYRILLIC_FIELDS)
    const extras = collectMirrorExtras(schema, CYRILLIC_FIELDS)

    // At least one fixture field must have survived as a real value (gate is live).
    const drawnValues = Object.values(values).filter((v) => v.canRead && v.value)
    expect(drawnValues.length, 'mirror produced drawable values from the fixture').toBeGreaterThan(0)

    const candidates = [
      ...Object.values(values).map((v) => v.value),
      ...extras.flatMap((e) => [e.label, e.value]),
    ]
    for (const raw of candidates) {
      const drawn = pdfSafe(raw)
      const leaked = [...drawn].filter((c) => CYRILLIC_RE.test(c))
      expect(leaked, `pdfSafe(${JSON.stringify(raw)}) drew Cyrillic: ${leaked.join('')}`).toHaveLength(0)
    }
  })

  // POPPLER gate (self-skips locally): render the mirror PDF and assert the
  // extracted text layer has ZERO U+0400–U+04FF and the transliteration landed.
  describe('rendered-output gate (poppler)', () => {
    let dir: string
    beforeAll(() => { dir = mkdtempSync(join(tmpdir(), 'mirror-leak-')) })

    it.skipIf(!HAS_POPPLER)('rendered PDF has zero Cyrillic leak + transliterated value present', async () => {
      const res = await renderMirrorTranslationPDF(DOC_TYPE, CYRILLIC_FIELDS, OPTS)
      expect(res).not.toBeNull()
      const pdf = join(dir, 'mirror.pdf')
      writeFileSync(pdf, res!.pdf)

      execSync(`pdftoppm -png -r 110 "${pdf}" "${join(dir, 'page')}"`)
      const pngs = readdirSync(dir).filter((f) => f.startsWith('page') && f.endsWith('.png'))
      expect(pngs.length, 'at least one rendered page').toBeGreaterThan(0)
      for (const p of pngs) expect(statSync(join(dir, p)).size, `${p} non-blank`).toBeGreaterThan(3000)

      const text = execSync(`pdftotext "${pdf}" -`).toString()
      expect(text, 'transliterated surname present (Cyrillic input → Latin output)').toMatch(/SHEVCHENKO/i)
      const leaked = [...text].filter((c) => CYRILLIC_RE.test(c))
      expect(leaked, `no Cyrillic leak (found: ${leaked.slice(0, 8).join('')})`).toHaveLength(0)
    })

    it('reports when poppler is unavailable (so a skip is never mistaken for a pass)', () => {
      if (!HAS_POPPLER) console.warn('[mirror leak gate] poppler absent — value-layer gate still ran; install poppler-utils for the rendered gate')
      expect(true).toBe(true)
    })
  })
})
