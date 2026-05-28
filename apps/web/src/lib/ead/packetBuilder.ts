/**
 * EAD packet builder — EadFieldData → filled I-765.pdf bytes.
 *
 * Server-only (uses fs). Reads the official USCIS I-765 PDF from
 * apps/web/public/uscis/tps/i-765.pdf (same form used by TPS — the document is
 * identical regardless of which eligibility category fills it). Applies the
 * EAD-specific field map via the shared prefiller.
 *
 * No payment, no Stripe — EAD page is a free self-help wizard (see
 * /services/ead-work-permit/start/page.tsx docstring).
 */

import fs from 'node:fs/promises'
import path from 'node:path'

import type { EadFieldData } from './i765FieldMap'
import { buildEadI765Ops } from './i765FieldMap'
import { prefill } from '@/lib/tps/pdfPrefiller'
import { assertFormIntegrity } from '@/lib/tps/formIntegrity'

const I765_EDITION = '08/21/25'

function pdfPath(): string {
  // Shared PDF asset — same form for TPS / EAD / asylum / etc.
  return path.join(process.cwd(), 'public', 'uscis', 'tps', 'i-765.pdf')
}

export interface EadPacketResult {
  pdfBytes: Uint8Array
  applied: number
  skipped: number
  firstSkips: string[]
  edition: string
}

export async function buildEadPacket(data: EadFieldData): Promise<EadPacketResult> {
  const pdfBytes = await fs.readFile(pdfPath())
  // PDF integrity check: hash must match the pinned SHA in formIntegrity, else
  // someone replaced the PDF without re-validating the field map → refuse.
  assertFormIntegrity('i-765.pdf', pdfBytes)

  const ops = buildEadI765Ops(data)
  const result = await prefill(pdfBytes, ops, {
    edition: I765_EDITION,
    draftLabel: 'EAD DRAFT — review before signing',
  })

  return {
    pdfBytes: result.bytes,
    applied: result.applied,
    skipped: result.skipped.length,
    firstSkips: result.skipped.slice(0, 5).map((s) => `${s.field}: ${s.reason}`),
    edition: I765_EDITION,
  }
}
