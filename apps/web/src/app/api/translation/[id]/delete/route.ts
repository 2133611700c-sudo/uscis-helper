/**
 * GET /api/translation/[id]/delete?token=<signed-token>
 *
 * On-demand GDPR delete for a specific manual_review_queue case.
 * Called from the delete link in the client confirmation email.
 *
 * Token format: base64url( JSON({ id, exp }) ) + '.' + HMAC-SHA256-hex
 * Signed with ADMIN_SECRET. Valid 90 days. Idempotent (already-deleted = ok).
 *
 * On success: redirects to a simple "Your data has been deleted" page.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

// ── Token helpers ─────────────────────────────────────────────────────────────

function b64url(s: string) {
  return Buffer.from(s).toString('base64url')
}

/** Generate a signed delete token. Called from manual-review email template. */
export function generateDeleteToken(caseId: string, secret: string): string {
  const payload = b64url(JSON.stringify({ id: caseId, exp: Date.now() + 90 * 24 * 60 * 60 * 1000 }))
  const sig = createHmac('sha256', secret).update(payload).digest('hex')
  return `${payload}.${sig}`
}

function verifyDeleteToken(token: string, secret: string): { id: string } | null {
  try {
    const dot = token.lastIndexOf('.')
    if (dot === -1) return null
    const payload = token.slice(0, dot)
    const sig = token.slice(dot + 1)

    // Timing-safe signature check
    const expected = createHmac('sha256', secret).update(payload).digest('hex')
    if (!timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'))) return null

    const data = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { id: string; exp: number }
    if (!data.id || !data.exp || Date.now() > data.exp) return null

    return { id: data.id }
  } catch {
    return null
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: pathId } = await params
  const token = req.nextUrl.searchParams.get('token')
  const secret = process.env.ADMIN_SECRET

  if (!secret) {
    return NextResponse.json({ ok: false, error: 'Not configured' }, { status: 500 })
  }

  if (!token) {
    return new NextResponse(null, { status: 404 })
  }

  const verified = verifyDeleteToken(token, secret)
  if (!verified || verified.id !== pathId) {
    return new NextResponse(null, { status: 404 })
  }

  const supabase = createAdminSupabaseClient()

  // Fetch row to get file_url (idempotent — if already gone, return success)
  const { data } = await supabase
    .from('manual_review_queue')
    .select('id, file_url')
    .eq('id', pathId)
    .maybeSingle()

  if (data) {
    // Delete Storage file if present
    const fileUrl = (data as { id: string; file_url: string | null }).file_url
    if (fileUrl) {
      await supabase.storage.from('translation-uploads').remove([fileUrl])
    }

    // Delete queue row
    await supabase.from('manual_review_queue').delete().eq('id', pathId)
  }

  // Redirect to confirmation page
  const url = req.nextUrl.clone()
  url.pathname = '/delete-confirmed'
  url.search = ''
  return NextResponse.redirect(url)
}
