/**
 * POST /api/translation/manual-review
 *
 * Triggered when translation confidence is too low (< 0.5) or the user
 * explicitly requests human review. Queues the session for manual processing
 * by a Messenginfo staff translator.
 *
 * Actions:
 *   1. Insert row into Supabase `manual_review_queue` table
 *   2. Email contact@messenginfo.com via Resend with case details
 *   3. Return { ok, case_id, estimated_hours } to the client
 *
 * Request body (JSON):
 *   session_id      string   Wizard session ID
 *   doc_type        string   Document type
 *   source_lang     string   Source language ('ru' | 'uk' | 'uk-soviet')
 *   contact_name?   string   User's name (from Step 2 contact gate)
 *   contact_email?  string   User's email
 *   contact_phone?  string   User's phone
 *   source_fields   Record<string, string|null>  Original OCR fields
 *   confidence      number   Translation confidence that triggered this
 *   reason          string   'low_confidence' | 'user_requested' | 'translate_error'
 *
 * Response:
 *   ok              boolean
 *   case_id         string   UUID for tracking
 *   estimated_hours number   Staff response time estimate (24h default)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

// ─── Lazy init helpers ────────────────────────────────────────────────────────

function getSupabase() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase not configured')
  return createClient(url, key, { auth: { persistSession: false } })
}

function getResend() {
  const key = process.env.RESEND_API_KEY
  if (!key) throw new Error('RESEND_API_KEY not configured')
  return new Resend(key)
}

const STAFF_EMAIL = 'contact@messenginfo.com'
const FROM_EMAIL = (process.env.EMAIL_FROM_ADDRESS ?? 'noreply@messenginfo.com').trim()
const ESTIMATED_HOURS = 24

// ─── Supabase insert ──────────────────────────────────────────────────────────

async function insertReviewQueue(payload: {
  session_id: string
  doc_type: string
  source_lang: string
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  source_fields: Record<string, string | null>
  confidence: number
  reason: string
}): Promise<{ case_id: string }> {
  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('manual_review_queue')
    .insert({
      doc_type: payload.doc_type,
      source_lang: payload.source_lang,
      contact_name: payload.contact_name,
      contact_email: payload.contact_email,
      contact_phone: payload.contact_phone,
      source_fields: payload.source_fields,
      status: 'pending',
    })
    .select('id')
    .single()

  if (error) {
    throw new Error(`Supabase insert failed: ${error.message}`)
  }

  return { case_id: (data as { id: string }).id }
}

// ─── Staff notification email ─────────────────────────────────────────────────

async function notifyStaff(payload: {
  case_id: string
  session_id: string
  doc_type: string
  source_lang: string
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  source_fields: Record<string, string | null>
  confidence: number
  reason: string
}) {
  const resend = getResend()

  const fieldRows = Object.entries(payload.source_fields)
    .filter(([, v]) => v !== null)
    .map(
      ([k, v]) =>
        `<tr><td style="padding:4px 8px;border:1px solid #e2e8f0;font-weight:600;color:#475569">${k}</td>` +
        `<td style="padding:4px 8px;border:1px solid #e2e8f0;color:#1e293b">${v ?? ''}</td></tr>`
    )
    .join('')

  const reasonLabels: Record<string, string> = {
    low_confidence: 'Low translation confidence',
    user_requested: 'User explicitly requested human review',
    translate_error: 'Translation API error',
  }
  const reasonLabel = reasonLabels[payload.reason] ?? payload.reason

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;background:#f8fafc;margin:0;padding:0">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0">
    <tr><td align="center">
      <table width="640" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e2e8f0">
        <tr><td style="background:#dc2626;padding:16px 24px">
          <p style="margin:0;color:#fff;font-size:18px;font-weight:700">🔴 Manual Review Request</p>
          <p style="margin:4px 0 0;color:#fca5a5;font-size:13px">Messenginfo Translation — Staff Action Required</p>
        </td></tr>
        <tr><td style="padding:24px">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:8px 0;color:#64748b;font-size:13px;width:160px">Case ID</td>
              <td style="padding:8px 0;color:#1e293b;font-size:13px;font-weight:600">${payload.case_id}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#64748b;font-size:13px">Session ID</td>
              <td style="padding:8px 0;color:#1e293b;font-size:13px">${payload.session_id}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#64748b;font-size:13px">Document type</td>
              <td style="padding:8px 0;color:#1e293b;font-size:13px">${payload.doc_type}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#64748b;font-size:13px">Source language</td>
              <td style="padding:8px 0;color:#1e293b;font-size:13px">${payload.source_lang}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#64748b;font-size:13px">Trigger reason</td>
              <td style="padding:8px 0;color:#dc2626;font-size:13px;font-weight:600">${reasonLabel}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#64748b;font-size:13px">Auto-confidence</td>
              <td style="padding:8px 0;color:#1e293b;font-size:13px">${Math.round(payload.confidence * 100)}%</td>
            </tr>
          </table>

          <hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0">

          <p style="font-size:14px;font-weight:700;color:#1e293b;margin:0 0 8px">Contact information</p>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:4px 0;color:#64748b;font-size:13px;width:120px">Name</td>
              <td style="padding:4px 0;color:#1e293b;font-size:13px">${payload.contact_name ?? '—'}</td>
            </tr>
            <tr>
              <td style="padding:4px 0;color:#64748b;font-size:13px">Email</td>
              <td style="padding:4px 0;color:#1e293b;font-size:13px">${payload.contact_email ?? '—'}</td>
            </tr>
            <tr>
              <td style="padding:4px 0;color:#64748b;font-size:13px">Phone</td>
              <td style="padding:4px 0;color:#1e293b;font-size:13px">${payload.contact_phone ?? '—'}</td>
            </tr>
          </table>

          <hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0">

          <p style="font-size:14px;font-weight:700;color:#1e293b;margin:0 0 8px">OCR-extracted fields (source language)</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:13px">
            <tr>
              <th style="padding:4px 8px;border:1px solid #e2e8f0;background:#f8fafc;text-align:left;color:#64748b">Field</th>
              <th style="padding:4px 8px;border:1px solid #e2e8f0;background:#f8fafc;text-align:left;color:#64748b">Value</th>
            </tr>
            ${fieldRows}
          </table>

          <p style="font-size:12px;color:#94a3b8;margin:24px 0 0">
            Messenginfo · Automated staff notification · Do not reply to this email<br>
            Please contact the client directly using the contact info above.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  await resend.emails.send({
    from: `Messenginfo Staff <${FROM_EMAIL}>`,
    to: STAFF_EMAIL,
    subject: `[Review Required] ${payload.doc_type} · ${payload.source_lang} · Case ${payload.case_id.slice(0, 8)}`,
    html,
  })
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      session_id?: unknown
      doc_type?: unknown
      source_lang?: unknown
      contact_name?: unknown
      contact_email?: unknown
      contact_phone?: unknown
      source_fields?: unknown
      confidence?: unknown
      reason?: unknown
    }

    // Validate required fields — session_id is optional (translation flow has no session)
    if (typeof body.doc_type !== 'string' || !body.doc_type) {
      return NextResponse.json({ ok: false, error: '"doc_type" is required' }, { status: 400 })
    }

    const validReasons = new Set(['low_confidence', 'user_requested', 'translate_error'])
    const reason =
      typeof body.reason === 'string' && validReasons.has(body.reason)
        ? body.reason
        : 'low_confidence'

    const validLangs = new Set(['ru', 'uk', 'uk-soviet'])
    const source_lang =
      typeof body.source_lang === 'string' && validLangs.has(body.source_lang)
        ? body.source_lang
        : 'ru'

    const source_fields =
      body.source_fields && typeof body.source_fields === 'object' && !Array.isArray(body.source_fields)
        ? (body.source_fields as Record<string, string | null>)
        : {}

    const confidence = typeof body.confidence === 'number' ? Math.min(1, Math.max(0, body.confidence)) : 0

    const payload = {
      // session_id is optional — Re-Parole flow provides it, translation flow does not
      session_id: typeof body.session_id === 'string' ? body.session_id : '',
      doc_type: body.doc_type,
      source_lang,
      contact_name: typeof body.contact_name === 'string' ? body.contact_name.trim() || null : null,
      contact_email: typeof body.contact_email === 'string' ? body.contact_email.trim().toLowerCase() || null : null,
      contact_phone: typeof body.contact_phone === 'string' ? body.contact_phone.trim() || null : null,
      source_fields,
      confidence,
      reason,
    }

    // 1. Insert into Supabase — primary action
    let case_id: string
    try {
      const result = await insertReviewQueue(payload)
      case_id = result.case_id
    } catch (e: unknown) {
      console.error('[manual-review] Supabase insert failed:', String(e))
      return NextResponse.json(
        { ok: false, error: 'Failed to queue review request. Please contact contact@messenginfo.com directly.' },
        { status: 500 }
      )
    }

    // 2. Email staff — non-blocking (don't fail the response if email fails)
    notifyStaff({ ...payload, case_id }).catch((e: unknown) => {
      console.error('[manual-review] staff email failed:', String(e))
    })

    return NextResponse.json({
      ok: true,
      case_id,
      estimated_hours: ESTIMATED_HOURS,
    })
  } catch (e: unknown) {
    console.error('[manual-review] handler error:', String(e))
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}
