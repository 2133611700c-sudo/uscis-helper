/**
 * POST /api/ead/generate-packet
 *
 * Body: EadFieldData (from EADWizard).
 * Returns: application/pdf — filled USCIS I-765.
 *
 * Free self-help endpoint (no Stripe). Per the EAD page docstring:
 * "No Stripe. No USCIS submission. Not legal advice."
 *
 * Rate-limited (10/min/IP) — PDF generation hits disk + pdf-lib.
 */

import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, getClientIP } from '@/lib/security/rate-limit'
import { buildEadPacket } from '@/lib/ead/packetBuilder'
import type { EadFieldData } from '@/lib/ead/i765FieldMap'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const ip = getClientIP(req)
  const rl = await rateLimit(`ead-generate:${ip}`, 10, 60_000)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Wait a minute.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt.getTime() - Date.now()) / 1000)) } },
    )
  }

  let data: EadFieldData
  try {
    data = (await req.json()) as EadFieldData
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Minimum viable input: at least a name. Everything else can be filled by
  // hand on the printed PDF — but generating an empty form is pointless.
  if (!data?.firstName?.trim() && !data?.lastName?.trim()) {
    return NextResponse.json(
      { error: 'At least first or last name is required to generate a draft I-765.' },
      { status: 400 },
    )
  }

  try {
    const result = await buildEadPacket(data)
    return new NextResponse(new Uint8Array(result.pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="I-765-draft-${(data.lastName || 'applicant').replace(/[^A-Za-z0-9]/g, '')}.pdf"`,
        'X-I765-Edition': result.edition,
        'X-Fields-Applied': String(result.applied),
        'X-Fields-Skipped': String(result.skipped),
      },
    })
  } catch (err: any) {
    console.error('[ead/generate-packet] failed:', err?.message ?? err)
    return NextResponse.json(
      { error: 'PDF generation failed. Try again in a moment.' },
      { status: 500 },
    )
  }
}
