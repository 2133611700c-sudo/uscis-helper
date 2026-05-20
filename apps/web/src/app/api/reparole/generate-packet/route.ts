/**
 * POST /api/reparole/generate-packet
 *
 * Direct ReParoleAnswers → I-131 ZIP. Mirrors /api/tps/generate-packet
 * but uses the Re-Parole answers contract + I-131 form.
 *
 * Body: ReParoleAnswers JSON (lib/reparole/answers.ts).
 * Response: application/zip with I-131.pdf + README.txt
 *
 * Pre-PDF firewall is identical to TPS — no Cyrillic in PDF-bound
 * fields, dates must be MM/DD/YYYY or YYYY-MM-DD, a_number digits only.
 *
 * Rate limit: 10 packet generations per 5 minutes per IP.
 *
 * This route exists so the new ReparoleWizardV2 can ship without
 * dragging in the legacy WizardProvider / session_id stack used by
 * /api/packet/generate.
 */

import { NextRequest, NextResponse } from 'next/server'
import JSZip from 'jszip'
import { rateLimit, getClientIP } from '@/lib/security/rate-limit'
import { buildReParoleI131 } from '@/lib/reparole/packetBuilder'
import type { ReParoleAnswers } from '@/lib/reparole/answers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const HAS_CYRILLIC = /[Ѐ-ӿ]/
const VALID_DATE = /^(\d{2}\/\d{2}\/\d{4}|\d{4}-\d{2}-\d{2})$/

const LATIN_REQUIRED: ReadonlyArray<keyof ReParoleAnswers> = [
  'family_name', 'given_name', 'middle_name',
  'mailing_street', 'mailing_city', 'mailing_state', 'mailing_zip',
  'physical_street', 'physical_city', 'physical_state', 'physical_zip',
  'a_number',
  'country_of_birth',
] as const

const DATE_FIELDS: ReadonlyArray<keyof ReParoleAnswers> = [
  'dob',
] as const

interface Issue { field: string; reason: string }

function preflightAudit(a: ReParoleAnswers): Issue[] {
  const issues: Issue[] = []
  for (const k of LATIN_REQUIRED) {
    const v = a[k]
    if (typeof v === 'string' && v && HAS_CYRILLIC.test(v)) {
      issues.push({ field: String(k), reason: 'cyrillic_in_pdf_bound_field' })
    }
  }
  for (const k of DATE_FIELDS) {
    const v = a[k]
    if (typeof v === 'string' && v && !VALID_DATE.test(v)) {
      issues.push({ field: String(k), reason: 'date_not_mm_dd_yyyy_or_iso' })
    }
  }
  const an = a.a_number
  if (typeof an === 'string' && an) {
    const digits = an.replace(/\D/g, '')
    if (an !== digits) {
      issues.push({ field: 'a_number', reason: 'a_number_must_be_digits_only' })
    } else if (digits.length < 7 || digits.length > 9) {
      issues.push({ field: 'a_number', reason: 'a_number_digit_count_out_of_range' })
    }
  }
  return issues
}

function minimallyComplete(a: ReParoleAnswers): { ok: boolean; missing: string[] } {
  const missing: string[] = []
  const need: Array<keyof ReParoleAnswers> = [
    'family_name', 'given_name', 'dob',
    'mailing_street', 'mailing_city', 'mailing_state', 'mailing_zip',
    'country_of_birth',
  ]
  for (const k of need) {
    const v = a[k]
    if (v === undefined || v === null || v === '') missing.push(String(k))
  }
  return { ok: missing.length === 0, missing }
}

function readme(a: ReParoleAnswers): string {
  return `Re-Parole U4U packet — DRAFT for ${a.family_name}, ${a.given_name}.

This packet is a DRAFT prepared by Messenginfo for you to review,
sign, and file yourself with USCIS. Messenginfo is not a law firm
and does not submit your application.

WHAT'S IN THIS ZIP
  I-131.pdf       — pre-filled Form I-131 (edition 01/20/25)
  README.txt      — this file

NEXT STEPS
  1. Open I-131.pdf, review every field against your original
     documents. Correct anything that is wrong.
  2. Paper filing: handwrite "Ukraine RE-PAROLE" at the top of
     the first page, sign in BLACK ink. Online filing: transfer
     the values into my.uscis.gov, Box 10.C (U4U Ukraine).
  3. Do NOT file earlier than 180 days before your current parole
     expires. Early applications are rejected without refund.
  4. Parole fee: $1,020 (separate USCIS invoice after conditional
     approval; not waivable).

OFFICIAL SOURCES
  https://www.uscis.gov/i-131
  https://www.uscis.gov/humanitarian/uniting-for-ukraine
`
}

export async function POST(req: NextRequest) {
  const ip = getClientIP(req)
  const rl = await rateLimit(`reparole-generate:${ip}`, 10, 5 * 60_000)
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
    return NextResponse.json({ error: 'Body must be a ReParoleAnswers object' }, { status: 400 })
  }
  const answers = body as ReParoleAnswers

  const check = minimallyComplete(answers)
  if (!check.ok) {
    return NextResponse.json({ error: 'Missing required fields', missing: check.missing }, { status: 422 })
  }

  const audit = preflightAudit(answers)
  if (audit.length > 0) {
    return NextResponse.json(
      { error: 'PDF safety check failed', issues: audit,
        guidance: 'Please correct the listed fields on the review screen before generating the packet.' },
      { status: 422 },
    )
  }

  try {
    const result = await buildReParoleI131(answers)
    const zip = new JSZip()
    zip.file('I-131.pdf', result.i131_bytes)
    zip.file('README.txt', readme(answers))
    const zipBytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' })
    return new NextResponse(new Uint8Array(zipBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="reparole-packet-draft.zip"',
        'Cache-Control': 'no-store',
        'X-I131-Applied': String(result.i131.applied),
        'X-I131-Skipped': String(result.i131.skipped),
        'X-I131-First-Skip': result.i131.firstSkips[0] ?? '',
      },
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: 'Generation failed', detail: msg }, { status: 500 })
  }
}
