import { describe, test, expect } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import fs from 'fs'
import path from 'path'

describe('PDF signature field inventory', () => {
  test('I-821 signature/attestation fields', async () => {
    const pdfPath = path.resolve('public/uscis/tps/i-821.pdf')
    const pdf = await PDFDocument.load(fs.readFileSync(pdfPath))
    const form = pdf.getForm()
    const sigFields: string[] = []
    for (const f of form.getFields()) {
      const n = f.getName()
      if (n.match(/Part8|Part9|Part10|Sign|sign|Stmt|Signature|Date/i)) {
        sigFields.push(`${f.constructor.name} | ${n}`)
      }
    }
    console.log('I-821 SIGNATURE FIELDS:')
    sigFields.forEach(f => console.log(f))
    expect(sigFields.length).toBeGreaterThan(0)
  })

  test('I-765 signature/attestation fields', async () => {
    const pdfPath = path.resolve('public/uscis/tps/i-765.pdf')
    const pdf = await PDFDocument.load(fs.readFileSync(pdfPath))
    const form = pdf.getForm()
    const sigFields: string[] = []
    for (const f of form.getFields()) {
      const n = f.getName()
      if (n.match(/Part[4-8]|Sign|sign|Stmt|Signature|Applicant/i)) {
        sigFields.push(`${f.constructor.name} | ${n}`)
      }
    }
    console.log('I-765 SIGNATURE FIELDS:')
    sigFields.forEach(f => console.log(f))
    expect(sigFields.length).toBeGreaterThan(0)
  })
})
