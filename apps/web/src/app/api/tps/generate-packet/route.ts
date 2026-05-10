/**
 * POST /api/tps/generate-packet
 *
 * Body: TPSAnswers (see lib/tps/answers.ts)
 * Returns: application/zip containing I-821.pdf, I-765.pdf (if requested),
 * and README.txt with instructions.
 *
 * This route does NOT submit anything to USCIS. It does NOT determine
 * eligibility. It takes the user's typed data and produces a draft packet
 * for the user to review, sign, and file themselves.
 *
 * Rate limit: 10 packet generations per 5 minutes per IP — generous enough
 * for legitimate iteration, low enough to discourage abuse.
 */

import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, getClientIP } from '@/lib/security/rate-limit'
import { isMinimallyComplete, type TPSAnswers, defaultEadCategoryFor } from '@/lib/tps/answers'
import { buildPacket } from '@/lib/tps/packetBuilder'

// Run on the Node runtime (filesystem + pdf-lib + jszip need full Node).
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const ip = getClientIP(req)
  const rl = await rateLimit(`tps-generate:${ip}`, 10, 5 * 60_000)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt.getTime() - Date.now()) / 1000)) } },
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ error: 'Body must be a TPSAnswers object' }, { status: 400 })
  }

  // Normalize: fill ead_category from filing_path if missing.
  const answers = body as TPSAnswers
  if (answers.wants_ead && !answers.ead_category) {
    answers.ead_category = defaultEadCategoryFor(answers.filing_path)
  }

  const check = isMinimallyComplete(answers)
  if (!check.ok) {
    return NextResponse.json(
      { error: 'Missing required fields', missing: check.missing },
      { status: 422 },
    )
  }

  try {
    const result = await buildPacket(answers)
    return new NextResponse(new Uint8Array(result.zipBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="tps-packet-draft.zip"',
        'Cache-Control': 'no-store',
        // Surface counts so the wizard can confirm visually what happened.
        'X-TPS-I821-Applied': String(result.i821.applied),
        'X-TPS-I821-Skipped': String(result.i821.skipped),
        'X-TPS-I765-Applied': String(result.i765.applied),
        'X-TPS-I765-Skipped': String(result.i765.skipped),
      },
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: 'Generation failed', detail: msg }, { status: 500 })
  }
}
