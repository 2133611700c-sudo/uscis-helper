/**
 * POST /api/order/[id]/resend — re-send the finished translation email
 * (customer lost it). Only for COMPLETED orders; regenerates nothing — sends
 * the operator-approved translated_fields as the existing translation email
 * path does. Tightly rate-limited (the order uuid is the capability token).
 */
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, getClientIP } from '@/lib/security/rate-limit'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { sendTranslationEmail } from '@/lib/email/resend'
import { generateTranslationHTML } from '@/lib/translation/generateTranslationHTML'

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const ip = getClientIP(req)
  // 2/hour per ip+order: resend is a courtesy, not a relay.
  const { id } = await ctx.params
  if (!UUID_RE.test(id)) return NextResponse.json({ ok: false }, { status: 404 })
  const rl = await rateLimit(`order-resend:${ip}:${id}`, 2, 3_600_000)
  if (!rl.allowed) return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 })

  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase
    .from('manual_review_queue')
    .select('id, status, doc_type, contact_email, translated_fields')
    .eq('id', id)
    .single()
  if (error || !data) return NextResponse.json({ ok: false }, { status: 404 })
  if (data.status !== 'completed') {
    return NextResponse.json({ ok: false, error: 'not_completed' }, { status: 409 })
  }
  if (!data.contact_email || !data.translated_fields) {
    return NextResponse.json({ ok: false, error: 'nothing_to_resend' }, { status: 409 })
  }

  const docType = String(data.doc_type ?? 'document')
  const html = generateTranslationHTML(docType, data.translated_fields as Record<string, string>, 'Ukrainian')
  const r = await sendTranslationEmail({
    to: String(data.contact_email),
    docLabel: docType.replace(/[^a-zA-Z0-9\s\-_]/g, '').trim() || 'document',
    htmlContent: html,
    filename: `translation-${id}.html`,
  })
  if (!r.ok) return NextResponse.json({ ok: false, error: 'send_failed' }, { status: 502 })
  console.info('[order-resend]', JSON.stringify({ order_id: id }))
  return NextResponse.json({ ok: true })
}
