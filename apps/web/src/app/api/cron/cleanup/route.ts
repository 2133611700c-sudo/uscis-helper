/**
 * GET /api/cron/cleanup
 *
 * Vercel Cron Job — runs daily at 02:00 UTC.
 * Deletes manual_review_queue rows where expires_at < now()
 * and removes any associated files from Supabase Storage.
 *
 * Protected by Vercel CRON_SECRET (Authorization: Bearer header).
 * Set CRON_SECRET in Vercel Dashboard → Environment Variables.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  // ── Auth: Vercel passes Authorization: Bearer <CRON_SECRET> ───────────────
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    console.error('[cron/cleanup] CRON_SECRET not configured')
    return NextResponse.json({ ok: false, error: 'Not configured' }, { status: 500 })
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  const supabase = createAdminSupabaseClient()
  const now = new Date().toISOString()

  // 1. Fetch expired rows (need file_url to delete from Storage)
  const { data: expired, error: fetchErr } = await supabase
    .from('manual_review_queue')
    .select('id, file_url')
    .lt('expires_at', now)

  if (fetchErr) {
    console.error('[cron/cleanup] fetch failed:', fetchErr.message)
    return NextResponse.json({ ok: false, error: fetchErr.message }, { status: 500 })
  }

  if (!expired || expired.length === 0) {
    console.log('[cron/cleanup] nothing to delete')
    return NextResponse.json({ ok: true, deleted: 0 })
  }

  // 2. Delete Storage files (best-effort, non-blocking per file)
  const fileUrls = expired
    .map(r => (r as { id: string; file_url: string | null }).file_url)
    .filter((u): u is string => !!u)

  if (fileUrls.length > 0) {
    const { error: storageErr } = await supabase.storage
      .from('translation-uploads')
      .remove(fileUrls)

    if (storageErr) {
      // Log but don't abort — row deletion is more important for GDPR compliance
      console.warn('[cron/cleanup] storage delete partial error:', storageErr.message)
    }
  }

  // 3. Delete queue rows
  const ids = expired.map(r => (r as { id: string }).id)
  const { error: deleteErr } = await supabase
    .from('manual_review_queue')
    .delete()
    .in('id', ids)

  if (deleteErr) {
    console.error('[cron/cleanup] row delete failed:', deleteErr.message)
    return NextResponse.json({ ok: false, error: deleteErr.message }, { status: 500 })
  }

  console.log(`[cron/cleanup] deleted ${ids.length} expired cases, ${fileUrls.length} files`)
  return NextResponse.json({ ok: true, deleted: ids.length, files_removed: fileUrls.length })
}
