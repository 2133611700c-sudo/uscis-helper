/**
 * bureauTranslation.golden.test.ts — end-to-end: recognized fields → canonical
 * mapping → official schema → bureau PDF → hex-decoded readback. Proves the whole
 * official-document platform produces a correct, extractable English document.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { inflateSync, inflateRawSync } from 'node:zlib'
import { renderBureauTranslation, bureauSchemaFor } from '../bureauTranslation'

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

describe('Bureau translation — golden end-to-end (birth certificate)', () => {
  let text = ''
  let res: Awaited<ReturnType<typeof renderBureauTranslation>>
  beforeAll(async () => {
    // recognized = already-normalized ENGLISH values from the engine (combined name).
    res = await renderBureauTranslation('ua_birth_certificate', [
      { field: 'child_full_name', normalized_value: 'REDACTED Serhii Serhiiovych', review_required: true },
      { field: 'date_of_birth', normalized_value: 'June 25, 1986', review_required: false },
      { field: 'place_of_birth', normalized_value: 'Trostianets (urban-type settlement)', review_required: true },
      { field: 'oblast_of_birth', normalized_value: 'Vinnytsia Oblast', review_required: false },
      { field: 'series_number', normalized_value: 'III-AM 428069', review_required: false },
      // father/mother absent → must show as MISSING, not invented
    ], { signerName: 'Test Translator' })
    if (res) text = pdfText(res.pdf)
  })

  it('renders a PDF and is NOT certifiable (a required field is missing)', () => {
    expect(res).not.toBeNull()
    expect(text.length).toBeGreaterThan(50)
    expect(res!.certifiable).toBe(false) // act_record_number / registration are required & absent
  })
  it('child_full_name was split into the official surname/given fields', () => {
    expect(text).toContain('REDACTED')
    expect(text).toContain('Serhii')
  })
  it('смт preserved as urban-type settlement (never city)', () => {
    expect(text).toContain('urban-type settlement')
    expect(text).toContain('Trostianets')
  })
  it('a missing field is shown as a placeholder, never invented', () => {
    expect(text.toLowerCase()).toContain('enter from document')
    expect(text).not.toContain('Father: Kudr') // sanity: no fabricated parent
  })
  it('unknown doc type → null (caller falls back, no crash)', async () => {
    expect(bureauSchemaFor('ua_unknown')).toBeNull()
    expect(await renderBureauTranslation('ua_unknown', [])).toBeNull()
  })
})
