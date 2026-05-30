/**
 * bureau-readback.spike.test.ts — ARCHITECTURE SPIKE.
 * Question: do we need React-PDF for golden text-readback tests, or does the
 * EXISTING pdf-lib bureau renderer (renderOfficialTranslation, StandardFonts,
 * English output) already produce selectable/extractable text?
 *
 * If the English values read back from the generated PDF stream → NO React-PDF
 * needed; golden tests work on the existing renderer.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { inflateSync, inflateRawSync } from 'node:zlib'
import { renderOfficialTranslation, type FieldValue } from '../renderOfficialTranslation'
import { birthCertificateSchema } from '../../../../forms/ukraine/schemas/birth-certificate.schema'

function pdfText(buf: Buffer): string {
  const out: string[] = []
  let i = 0
  while (i < buf.length) {
    const s = buf.indexOf('stream', i)
    if (s < 0) break
    if (buf.toString('latin1', s - 3, s) === 'end') { i = s + 6; continue }
    let a = s + 6
    if (buf[a] === 0x0d) a++; if (buf[a] === 0x0a) a++
    const e = buf.indexOf('endstream', a); if (e < 0) break
    let b = e; if (buf[b - 1] === 0x0a) b--; if (buf[b - 1] === 0x0d) b--
    const chunk = buf.subarray(a, b)
    try { out.push(inflateSync(chunk).toString('latin1')) }
    catch { try { out.push(inflateRawSync(chunk).toString('latin1')) } catch { out.push(chunk.toString('latin1')) } }
    i = e + 9
  }
  // pdf-lib (StandardFonts) draws text as <hex> Tj. Decode the hex string operands
  // back to text → the output is fully extractable (selectable in any PDF reader).
  const streams = out.join('\n')
  let decoded = ''
  for (const m of streams.matchAll(/<([0-9A-Fa-f]{2,})>/g)) {
    const hex = m[1]
    if (hex.length % 2 === 0) decoded += Buffer.from(hex, 'hex').toString('latin1')
  }
  return decoded
}

const fv = (value: string, canRead = true, review = false): FieldValue => ({ value, review, canRead })

describe('SPIKE — bureau renderer (pdf-lib) text readback', () => {
  let text = ''
  beforeAll(async () => {
    const values: Record<string, FieldValue> = {
      child_surname: fv('REDACTED'),
      child_given_name: fv('Serhii'),
      date_of_birth: fv('25 June 1986'),
      place_of_birth: fv('Trostianets (urban-type settlement)'),
      oblast_of_birth: fv('Vinnytsia Oblast'),
      act_record_number: fv('84'),
      place_of_registration: fv('Civil Registry Office'),
      series_number: fv('I-AM 428069'),
      date_of_issue: fv('22 June 1986'),
    }
    const { pdf } = await renderOfficialTranslation(birthCertificateSchema, values, { signerName: 'Test Translator' })
    text = pdfText(pdf as Buffer)
  })

  it('renders a valid PDF', () => { expect(text.length).toBeGreaterThan(50) })

  it('VERDICT: English values are extractable from the pdf-lib output', () => {
    // If these pass, the existing pdf-lib bureau renderer supports golden text
    // readback → React-PDF is NOT required for testability.
    expect(text).toContain('Trostianets')
    expect(text).toContain('urban-type settlement')
    expect(text).toContain("REDACTED")
    expect(text).toContain("enter from document") // MISSING visible
    expect(text).toContain('Civil Registry Office')
    expect(text).toContain('Vinnytsia Oblast')
  })
})
