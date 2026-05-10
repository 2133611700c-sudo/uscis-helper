/**
 * pdfPrefiller — fills USCIS Hybrid XFA+AcroForm PDFs and renders a DRAFT.
 *
 * Why the XFA stream is stripped:
 *   USCIS forms are dynamic XFA with an AcroForm shadow tree. Adobe Reader
 *   prefers the XFA model and ignores AcroForm field values written by
 *   pdf-lib. By removing the /XFA entry from /AcroForm, Adobe falls back to
 *   the AcroForm renderer and our filled values show.
 *
 * Per the source-layer audit (2026-05-10, docs/uscis/forms/tps/AUDIT_REPORT.md),
 * this is the documented mitigation for USCIS forms.
 *
 * Output: a Uint8Array of the filled PDF, with a "DRAFT — Review before
 * signing and mailing" watermark and a small footer line attributing the
 * source-of-truth (edition date of the underlying USCIS PDF).
 */

import { PDFDocument, PDFName, PDFDict, StandardFonts, rgb, degrees } from 'pdf-lib'

export interface PrefillOp {
  field: string
  kind: 'text' | 'checkbox' | 'choice'
  value: string | boolean
}

export interface PrefillResult {
  bytes: Uint8Array
  applied: number
  skipped: Array<{ field: string; reason: string }>
}

export interface PrefillOptions {
  /** Edition date string to print in the footer, e.g. "01/20/25". */
  edition: string
  /** Short label for the watermark, e.g. "TPS DRAFT — review before signing". */
  draftLabel?: string
}

/**
 * Remove /XFA from the /AcroForm dictionary so Adobe uses the AcroForm
 * shadow tree (which is what pdf-lib actually writes to). Best-effort —
 * if the PDF lacks AcroForm or the dict shape is unexpected, just skip:
 * filling still works in most viewers without the strip.
 */
function stripXfa(pdfDoc: PDFDocument): void {
  try {
    const acroForm = pdfDoc.catalog.lookup(PDFName.of('AcroForm'))
    if (!(acroForm instanceof PDFDict)) return
    acroForm.delete(PDFName.of('XFA'))
    // Setting NeedAppearances=true forces Adobe to regenerate visual
    // appearances from the field values we wrote.
    acroForm.set(PDFName.of('NeedAppearances'), pdfDoc.context.obj(true))
  } catch {
    // Strip is an optimization; if it fails, the form still fills.
  }
}

/**
 * Diagonal DRAFT watermark on every page + a single-line provenance footer.
 */
async function stampDraftAndProvenance(pdfDoc: PDFDocument, opts: PrefillOptions): Promise<void> {
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const smallFont = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const pages = pdfDoc.getPages()
  const draft = opts.draftLabel ?? 'DRAFT — REVIEW BEFORE SIGNING'

  for (const page of pages) {
    const { width, height } = page.getSize()
    // Diagonal pale-red watermark across the page
    page.drawText(draft, {
      x: width * 0.10,
      y: height * 0.40,
      size: 60,
      font,
      color: rgb(0.85, 0.1, 0.1),
      opacity: 0.18,
      rotate: degrees(30),
    })
    // Bottom-of-page provenance line (next to the form's own edition stamp).
    page.drawText(
      `Prefilled by Messenginfo — based on USCIS edition ${opts.edition} — you sign & file yourself`,
      {
        x: 36,
        y: 18,
        size: 7,
        font: smallFont,
        color: rgb(0.4, 0.4, 0.4),
      },
    )
  }
}

/**
 * Apply a list of prefill ops to a PDF, strip XFA, and stamp DRAFT.
 *
 * Unknown field names are silently collected in `skipped` rather than
 * throwing — different editions of the same form may rename a few fields,
 * and we'd rather hand the user a mostly-filled PDF than refuse to render.
 */
export async function prefill(
  pdfBytes: Uint8Array,
  ops: PrefillOp[],
  opts: PrefillOptions,
): Promise<PrefillResult> {
  // USCIS PDFs are encrypted with permissive flags (allow filling + printing,
  // forbid content modification). pdf-lib refuses encrypted PDFs by default;
  // ignoreEncryption=true is the documented and supported escape hatch for
  // exactly this case.
  const pdfDoc = await PDFDocument.load(pdfBytes, { updateMetadata: false, ignoreEncryption: true })

  // 1. Strip XFA so Adobe reads AcroForm.
  stripXfa(pdfDoc)

  const form = pdfDoc.getForm()
  const fields = form.getFields()
  const byName = new Map<string, ReturnType<typeof form.getFields>[number]>()
  for (const f of fields) {
    byName.set(f.getName(), f)
  }

  let applied = 0
  const skipped: PrefillResult['skipped'] = []

  for (const op of ops) {
    const f = byName.get(op.field)
    if (!f) {
      skipped.push({ field: op.field, reason: 'field_not_found' })
      continue
    }
    const T = f.constructor.name
    try {
      if (op.kind === 'text' && T === 'PDFTextField') {
        // pdf-lib types are loose here — use the runtime API.
        (f as unknown as { setText: (s: string) => void }).setText(String(op.value ?? ''))
        applied++
      } else if (op.kind === 'checkbox' && T === 'PDFCheckBox') {
        const cb = f as unknown as { check: () => void; uncheck: () => void }
        if (op.value === true) cb.check()
        else cb.uncheck()
        applied++
      } else if (op.kind === 'choice') {
        // USCIS state dropdowns appear as both /Ch (choice) and sometimes
        // as text fields. Try setText first; if that fails, try select().
        if (T === 'PDFDropdown') {
          (f as unknown as { select: (s: string) => void }).select(String(op.value ?? ''))
        } else if (T === 'PDFTextField') {
          (f as unknown as { setText: (s: string) => void }).setText(String(op.value ?? ''))
        } else {
          skipped.push({ field: op.field, reason: `unsupported_choice_type_${T}` })
          continue
        }
        applied++
      } else {
        skipped.push({ field: op.field, reason: `mismatch_${op.kind}_vs_${T}` })
      }
    } catch (e) {
      skipped.push({ field: op.field, reason: `error:${e instanceof Error ? e.message : String(e)}` })
    }
  }

  // 2. Stamp watermark and provenance line.
  await stampDraftAndProvenance(pdfDoc, opts)

  // 3. Update field appearances so the values display in any viewer.
  try {
    form.updateFieldAppearances()
  } catch {
    /* best-effort */
  }

  const bytes = await pdfDoc.save({ useObjectStreams: false })
  return { bytes, applied, skipped }
}
