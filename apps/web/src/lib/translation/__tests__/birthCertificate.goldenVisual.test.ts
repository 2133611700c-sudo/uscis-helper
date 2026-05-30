/**
 * birthCertificate.goldenVisual.test.ts — golden PDF protocol for the ONE pilot
 * document (birth certificate). Proves the rendered bureau PDF has the required
 * English labels, never the forbidden ones, survives overflow inputs, and shows
 * missing fields honestly. This is the machine half of the acceptance protocol;
 * it does NOT replace owner visual (PNG) approval (see docs/reports/GOLDEN_PDF_PROTOCOL_birth.md).
 */
import { describe, it, expect } from 'vitest'
import { inflateSync, inflateRawSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { renderBureauTranslation } from '../bureauTranslation'

function pdfText(buf: Buffer): string {
  const out: string[] = []
  let i = 0
  while (i < buf.length) {
    const s = buf.indexOf('stream', i)
    if (s < 0) break
    if (buf.toString('latin1', s - 3, s) === 'end') { i = s + 6; continue }
    let a = s + 6; if (buf[a] === 0x0d) a++; if (buf[a] === 0x0a) a++
    const e = buf.indexOf('endstream', a); if (e < 0) break
    let b = e; if (buf[b - 1] === 0x0a) b--; if (buf[b - 1] === 0x0d) b--
    const chunk = buf.subarray(a, b)
    try { out.push(inflateSync(chunk).toString('latin1')) }
    catch { try { out.push(inflateRawSync(chunk).toString('latin1')) } catch { out.push(chunk.toString('latin1')) } }
    i = e + 9
  }
  let decoded = ''
  for (const m of out.join('\n').matchAll(/<([0-9A-Fa-f]{2,})>/g)) { const h = m[1]; if (h.length % 2 === 0) decoded += Buffer.from(h, 'hex').toString('latin1') }
  return decoded
}

const REQUIRED_LABELS = ['BIRTH CERTIFICATE', 'Surname', 'Patronymic', 'Date of birth', 'Place of birth']
const FORBIDDEN_LABELS = ['Middle Name', 'Militia', 'Police']

async function render(fields: Parameters<typeof renderBureauTranslation>[1]) {
  const res = await renderBureauTranslation('ua_birth_certificate', fields, { signerName: 'Test Translator' })
  return { res, text: res ? pdfText(res.pdf) : '' }
}

describe('Birth certificate — golden PDF protocol (pilot)', () => {
  it('contains every REQUIRED English label', async () => {
    const { res, text } = await render([
      { field: 'child_full_name', normalized_value: 'REDACTED Serhii Serhiiovych', review_required: true },
      { field: 'date_of_birth', normalized_value: 'June 25, 1986', review_required: false },
      { field: 'place_of_birth', normalized_value: 'Trostianets (urban-type settlement)', review_required: true },
    ])
    expect(res).not.toBeNull()
    for (const label of REQUIRED_LABELS) expect(text).toContain(label)
  })

  it('never emits a FORBIDDEN label (Patronymic≠Middle Name, Militsiya≠Police)', async () => {
    const { text } = await render([
      { field: 'child_full_name', normalized_value: 'REDACTED Serhii Serhiiovych', review_required: true },
    ])
    for (const bad of FORBIDDEN_LABELS) expect(text).not.toContain(bad)
  })

  it('survives an overflow-length name without crashing and keeps the surname readable', async () => {
    const longSurname = 'Naipopuliarnishukrainskoiprizvyshcheznachnodovshenizzvychaineredacted'
    const { res, text } = await render([
      { field: 'child_full_name', normalized_value: `${longSurname} Serhii Serhiiovych`, review_required: true },
    ])
    expect(res).not.toBeNull()
    // the surname must still appear (renderer may wrap, but must not silently drop it)
    expect(text).toContain(longSurname.slice(0, 20))
  })

  it('shows a missing required field as a placeholder, never invented, not certifiable', async () => {
    const { res, text } = await render([
      { field: 'child_full_name', normalized_value: 'REDACTED Serhii Serhiiovych', review_required: true },
      // act_record_number / place_of_registration absent
    ])
    expect(res!.certifiable).toBe(false)
    expect(text.toLowerCase()).toContain('enter from document')
    // a fabricated parent would be a Capitalised name; the honest placeholder is
    // underscores/brackets — so a capitalised word right after "Father:" = invention.
    expect(text).not.toMatch(/Father:\s*[A-Z][a-z]+/)
  })

  it('renders Cyrillic series letters via KMU-55, never silently stripped (I-АМ → I-AM)', async () => {
    const { res, text } = await render([
      { field: 'child_full_name', normalized_value: 'REDACTED Serhii Serhiiovych', review_required: true },
      { field: 'series_number', normalized_value: 'I-АМ 428069', review_required: false },
    ])
    expect(res).not.toBeNull()
    expect(text).toContain('I-AM')           // letters transliterated, not dropped
    expect(text).toContain('428069')
    expect(text).not.toMatch(/I-\s+428069/)  // the "АМ" was NOT silently deleted
  })

  // Artifact writer for owner visual approval (synthetic data only — no PII).
  // Run: GEN_ARTIFACT=1 vitest run …goldenVisual… ; then pdftoppm → PNG.
  it.runIf(process.env.GEN_ARTIFACT)('writes the pilot PDF artifact for visual approval', async () => {
    const { res } = await render([
      { field: 'child_full_name', normalized_value: 'Shevchenko Taras Hryhorovych', review_required: true },
      { field: 'date_of_birth', normalized_value: 'March 9, 1814', review_required: false },
      { field: 'place_of_birth', normalized_value: 'Moryntsi (village)', review_required: true },
      { field: 'oblast_of_birth', normalized_value: 'Cherkasy Oblast', review_required: false },
      { field: 'series_number', normalized_value: 'I-АМ 000001', review_required: false },
      // act_record_number deliberately absent → exercises the honest placeholder
    ])
    expect(res).not.toBeNull()
    const dir = join(process.cwd(), '..', '..', 'docs', 'reports', 'artifacts')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'birth_certificate.pilot.pdf'), res!.pdf)
  })
})
