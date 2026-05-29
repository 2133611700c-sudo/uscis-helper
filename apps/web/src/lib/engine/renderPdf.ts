/**
 * engine/renderPdf.ts — D6 render: AssembledDoc → real A4 PDF (pdf-lib),
 * bureau-style layout that MIRRORS the official Ukrainian state form
 * (per KMU Resolution No. 1025, 10.11.2010 for civil-status certificates):
 *   centered "UKRAINE" + [State Emblem] + DOCUMENT TITLE, framed body with the
 *   document's fields in official order, [round seal]/[signature] placeholders,
 *   then a separate Translator's Certification box.
 * English output → standard WinAnsi fonts are safe. No certified/USCIS claim.
 */
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import type { AssembledDoc } from './assembler'

export async function renderTranslationPdf(doc: AssembledDoc): Promise<Buffer> {
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const ital = await pdf.embedFont(StandardFonts.HelveticaOblique)
  const W = 595, H = 842, M = 50
  let page = pdf.addPage([W, H])
  const dark = rgb(0.1, 0.09, 0.08), gray = rgb(0.45, 0.45, 0.45), warn = rgb(0.72, 0.4, 0)
  const line = rgb(0.75, 0.75, 0.75)
  let y = H - M

  const center = (txt: string, size: number, f = font, color = dark) => {
    const w = f.widthOfTextAtSize(txt, size)
    page.drawText(txt, { x: (W - w) / 2, y, size, font: f, color }); y -= size + 6
  }
  const left = (txt: string, size: number, f = font, color = dark, x = M) => {
    if (y < M + 40) { page = pdf.addPage([W, H]); y = H - M }
    // wrap
    const maxW = W - 2 * M - (x - M)
    let cur = ''
    for (const wd of txt.split(' ')) {
      const t = cur ? cur + ' ' + wd : wd
      if (f.widthOfTextAtSize(t, size) > maxW) { page.drawText(cur, { x, y, size, font: f, color }); y -= size + 4; cur = wd } else cur = t
    }
    page.drawText(cur, { x, y, size, font: f, color }); y -= size + 4
  }
  const hr = () => { y -= 4; page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.7, color: line }); y -= 10 }

  // ── header (official form mirror) ──
  center('UKRAINE', 13, bold)
  center('[ State Emblem (Coat of Arms) of Ukraine ]', 8, ital, gray)
  center(doc.title || 'OFFICIAL DOCUMENT', 16, bold)
  y -= 4
  center('English translation — AI-assisted draft, pending human review & signature', 8, ital, gray)
  y -= 6; hr()

  // ── body: field rows (skip the header + cert lines from text; use structured rows) ──
  const bodyLines = doc.text.split('\n').slice(3)
  let inCert = false
  for (const raw of bodyLines) {
    const t = raw.replace(/\s+$/, '')
    if (!t.trim()) { y -= 4; continue }
    if (/CERTIFICATION/.test(t)) { hr(); inCert = true; left(t, 11, bold); continue }
    if (/^—\s*—/.test(t)) continue
    const isPlaceholder = /^\[/.test(t)
    const needsAttn = /\[CONFIRM\]|\[enter from document\]/.test(t)
    left(t, isPlaceholder ? 9 : 10, isPlaceholder ? ital : (inCert ? font : font), isPlaceholder ? gray : (needsAttn ? warn : dark), isPlaceholder ? M + 6 : M)
  }

  // frame
  const p0 = pdf.getPages()[0]
  p0.drawRectangle({ x: M - 14, y: 30, width: W - 2 * (M - 14), height: H - 60, borderColor: line, borderWidth: 1 })

  return Buffer.from(await pdf.save())
}
