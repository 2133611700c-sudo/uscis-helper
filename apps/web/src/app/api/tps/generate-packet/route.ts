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

// R1A Phase 6 — pre-PDF firewall.
// Final safety net BEFORE pdf-lib touches anything. Three checks:
//   1) No Cyrillic in fields that USCIS expects in Latin. KMU-55
//      transliteration happens upstream; if any Cyrillic slipped through
//      it's a bug and we refuse to render it into a PDF the user would
//      sign and mail to a federal agency.
//   2) Dates are in USCIS MM/DD/YYYY format (or empty). Anything else
//      is rejected — better to ask the user to correct than to write a
//      malformed date into an I-821 field.
//   3) A-number is digits-only (7–9). The I-821 / I-765 A-number fields
//      do not accept dashes or letters.
const HAS_CYRILLIC = /[Ѐ-ӿ]/
const USCIS_DATE = /^(\d{2})\/(\d{2})\/(\d{4})$/
const LATIN_REQUIRED_FIELDS: ReadonlyArray<keyof TPSAnswers> = [
  'family_name', 'given_name', 'middle_name',
  'us_address_street', 'us_address_city', 'us_address_state', 'us_address_zip',
  'passport_number', 'passport_country_of_issuance',
  'country_of_birth', 'country_of_nationality',
  'i94_admission_number',
  'a_number',
] as const
const DATE_FIELDS: ReadonlyArray<keyof TPSAnswers> = [
  'dob', 'passport_expiration_date', 'last_entry_date',
] as const

interface FirewallIssue {
  field: string
  reason: string
}

function preflightAudit(answers: TPSAnswers): FirewallIssue[] {
  const issues: FirewallIssue[] = []
  for (const k of LATIN_REQUIRED_FIELDS) {
    const v = answers[k]
    if (typeof v === 'string' && v && HAS_CYRILLIC.test(v)) {
      issues.push({ field: k, reason: 'cyrillic_in_pdf_bound_field' })
    }
  }
  for (const k of DATE_FIELDS) {
    const v = answers[k]
    if (typeof v === 'string' && v && !USCIS_DATE.test(v)) {
      issues.push({ field: k, reason: 'date_not_mm_dd_yyyy' })
    }
  }
  const a = answers.a_number
  if (typeof a === 'string' && a) {
    const digits = a.replace(/\D/g, '')
    if (a !== digits) {
      issues.push({ field: 'a_number', reason: 'a_number_must_be_digits_only' })
    } else if (digits.length < 7 || digits.length > 9) {
      issues.push({ field: 'a_number', reason: 'a_number_digit_count_out_of_range' })
    }
  }
  return issues
}

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

  // R1A Phase 6: pre-PDF firewall. Stop unsafe values from reaching
  // pdf-lib. The wizard already filters at the UI layer and the OCR
  // route already filters by slot contract — this is the last line.
  const audit = preflightAudit(answers)
  if (audit.length > 0) {
    return NextResponse.json(
      {
        error: 'PDF safety check failed',
        issues: audit,
        guidance: 'Please correct the listed fields on the review screen before generating the packet.',
      },
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
        'X-TPS-I821-First-Skip': result.i821.firstSkips[0] ?? '',
        'X-TPS-I765-Applied': String(result.i765.applied),
        'X-TPS-I765-Skipped': String(result.i765.skipped),
        'X-TPS-I765-First-Skip': result.i765.firstSkips[0] ?? '',
      },
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: 'Generation failed', detail: msg }, { status: 500 })
  }
}
