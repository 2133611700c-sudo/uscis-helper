/**
 * packetBuilder — top-level: TPSAnswers → ZIP { i-821.pdf, i-765.pdf, README.txt }.
 *
 * Reads the official USCIS PDFs from apps/web/public/uscis/tps/, applies the
 * field maps via pdfPrefiller, and bundles the result into a ZIP via jszip.
 *
 * This file is server-only (uses fs).
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import JSZip from 'jszip'

import type { TPSAnswers } from './answers'
import { buildI821Ops } from './forms/i821FieldMap'
import { buildI765Ops } from './forms/i765FieldMap'
import { prefill } from './pdfPrefiller'

// Edition dates verified against uscis.gov on 2026-05-10 and stamped on the
// PDF footers. If USCIS publishes a new edition, scripts/uscis/refresh_tps_forms.sh
// re-downloads and re-validates; the build will fail until both this constant
// and the underlying PDF are refreshed in lockstep.
const I821_EDITION = '01/20/25'
const I765_EDITION = '08/21/25'

function publicPdfPath(name: string): string {
  return path.join(process.cwd(), 'public', 'uscis', 'tps', name)
}

export interface PacketResult {
  zipBytes: Uint8Array
  i821: { applied: number; skipped: number; firstSkips: string[] }
  i765: { applied: number; skipped: number; firstSkips: string[] }
}

export async function buildPacket(answers: TPSAnswers): Promise<PacketResult> {
  // Read official PDFs from the public/ bundle (Vercel includes these in the
  // serverless function's filesystem).
  const [i821Bytes, i765Bytes] = await Promise.all([
    fs.readFile(publicPdfPath('i-821.pdf')),
    fs.readFile(publicPdfPath('i-765.pdf')),
  ])

  // Build prefill operations from the field maps.
  const i821Ops = buildI821Ops(answers)
  // Skip I-765 entirely if the user didn't ask for an EAD.
  const i765Ops = answers.wants_ead ? buildI765Ops(answers) : []

  // Run the prefiller on each.
  const i821Filled = await prefill(new Uint8Array(i821Bytes), i821Ops, {
    edition: I821_EDITION,
    draftLabel: 'DRAFT — REVIEW & SIGN BEFORE MAILING',
  })
  const i765Filled = answers.wants_ead
    ? await prefill(new Uint8Array(i765Bytes), i765Ops, {
        edition: I765_EDITION,
        draftLabel: 'DRAFT — REVIEW & SIGN BEFORE MAILING',
      })
    : null

  // Bundle into a ZIP with a README.
  const zip = new JSZip()
  zip.file('I-821.pdf', i821Filled.bytes)
  if (i765Filled) zip.file('I-765.pdf', i765Filled.bytes)
  zip.file('README.txt', buildReadme(answers, i821Filled, i765Filled))

  const zipBytes = await zip.generateAsync({ type: 'uint8array' })

  return {
    zipBytes,
    i821: {
      applied: i821Filled.applied,
      skipped: i821Filled.skipped.length,
      firstSkips: i821Filled.skipped.slice(0, 5).map((s) => `${s.field} (${s.reason})`),
    },
    i765: i765Filled
      ? {
          applied: i765Filled.applied,
          skipped: i765Filled.skipped.length,
          firstSkips: i765Filled.skipped.slice(0, 5).map((s) => `${s.field} (${s.reason})`),
        }
      : { applied: 0, skipped: 0, firstSkips: [] },
  }
}

function buildReadme(
  a: TPSAnswers,
  i821: { applied: number; skipped: { field: string; reason: string }[] },
  i765: { applied: number; skipped: { field: string; reason: string }[] } | null,
): string {
  const ts = new Date().toISOString()
  return [
    'Messenginfo — TPS Ukraine packet draft',
    `Generated: ${ts}`,
    '',
    'WHAT THIS IS',
    '  Two PDFs prefilled with the data you typed into the wizard:',
    `    I-821 (Application for TPS) — edition ${I821_EDITION}, ${i821.applied} fields prefilled`,
    a.wants_ead && i765
      ? `    I-765 (Application for EAD) — edition ${I765_EDITION}, ${i765.applied} fields prefilled, category (${a.ead_category === 'a12' ? 'a' : 'c'})(${a.ead_category === 'a12' ? '12' : '19'})`
      : '    I-765 was not generated (you chose not to request an EAD).',
    '',
    'WHAT TO DO',
    '  1. Open each PDF in Adobe Acrobat Reader or Preview.',
    '  2. Carefully review every prefilled field. Correct anything that is wrong.',
    '  3. Complete every field that we could not fill (signature, certain Part 3/4 items).',
    '  4. Print, sign in INK, and assemble your supporting documents.',
    '  5. Mail to the USCIS Lockbox address listed in the I-821 Instructions.',
    '',
    'WHAT WE DID NOT DO',
    '  - We did NOT submit anything to USCIS on your behalf.',
    '  - We did NOT give you legal advice.',
    '  - We did NOT determine your eligibility — please verify on uscis.gov.',
    '',
    'SOURCE FORMS',
    `  These PDFs were generated from the latest official USCIS PDFs as of`,
    `  2026-05-10, verified against uscis.gov pages and PDF footer edition stamps.`,
    '  See messenginfo.com/services/tps-ukraine/sources for the official USCIS links.',
    '',
    'If a field looks wrong, do NOT mail the form. Edit it in Adobe first or',
    'come back to messenginfo.com and re-run the wizard with corrected data.',
  ].join('\n')
}
