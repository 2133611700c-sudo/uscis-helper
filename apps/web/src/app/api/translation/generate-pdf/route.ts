/**
 * POST /api/translation/generate-pdf
 *
 * Called by TranslateWizard v14 after user signs the certification.
 * 1. Saves order record to Supabase (translation_orders table)
 * 2. Sends confirmation email to user via Resend
 * 3. Sends admin notification with full payload
 *
 * PDF is currently delivered as an HTML email attachment.
 * Future: generate actual PDF via headless Chrome / Puppeteer.
 */

import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email/resend'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

interface PdfPayload {
  profile: { name: string; email: string; phone: string; addr: string }
  selectedPlan: 'basic' | 'plus' | 'premium'
  spanishCopy: boolean
  locale: string
  signatureDataUrl: string | null
  signatureMethod: 'drawn_on_screen' | 'manual_wet_signature'
  signedAt: string
  certificationTextVersion: string
}

const PLAN_LABEL: Record<string, string> = {
  basic:   'Basic ($14.99)',
  plus:    'Plus ($19.99)',
  premium: 'Premium ($29.99)',
}

function buildCertHtml(p: PdfPayload): string {
  const plan = PLAN_LABEL[p.selectedPlan] ?? p.selectedPlan
  const sigBlock = p.signatureDataUrl
    ? `<img src="${p.signatureDataUrl}" style="height:60px;border-bottom:1px solid #000;" alt="Signature"/>`
    : `<div style="font-style:italic;color:#666;">[Manual wet signature — paper copy required]</div>`

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>USCIS Translation Certification</title>
<style>
  body{font-family:Georgia,serif;max-width:720px;margin:40px auto;padding:0 24px;color:#1a1714}
  h1{font-size:20px;text-align:center;text-transform:uppercase;letter-spacing:.08em}
  .sub{text-align:center;font-size:13px;color:#555;margin-bottom:32px}
  table{width:100%;border-collapse:collapse;margin-bottom:24px}
  td,th{border:1px solid #ccc;padding:8px 12px;font-size:13px}
  th{background:#f5f4f2;font-weight:700;text-align:left;width:35%}
  .cert{background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;padding:16px 20px;font-size:13px;line-height:1.7;margin-bottom:24px}
  .watermark{color:rgba(200,30,30,.15);font-size:64px;font-weight:900;transform:rotate(-32deg);position:fixed;top:40%;left:5%;pointer-events:none;user-select:none;white-space:nowrap}
</style>
</head>
<body>
<div class="watermark">CERTIFIED COPY</div>
<h1>USCIS Document Translation</h1>
<div class="sub">Self-Certified under 8 CFR §103.2(b)(3) &nbsp;·&nbsp; Messenginfo.com &nbsp;·&nbsp; ${new Date(p.signedAt).toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'})}</div>

<table>
  <tr><th>Full Name</th><td>${p.profile.name}</td></tr>
  <tr><th>Email</th><td>${p.profile.email}</td></tr>
  <tr><th>Phone</th><td>${p.profile.phone}</td></tr>
  <tr><th>US Address</th><td>${p.profile.addr}</td></tr>
  <tr><th>Plan</th><td>${plan}${p.spanishCopy ? ' + Spanish Copy (+$3.00)' : ''}</td></tr>
  <tr><th>Signed</th><td>${new Date(p.signedAt).toLocaleString('en-US')}</td></tr>
  <tr><th>Signature Method</th><td>${p.signatureMethod === 'drawn_on_screen' ? 'Digital (drawn on screen)' : 'Manual wet signature'}</td></tr>
  <tr><th>Certification Version</th><td>${p.certificationTextVersion}</td></tr>
</table>

<div class="cert">
  <strong>TRANSLATOR CERTIFICATION</strong><br/><br/>
  I, ${p.profile.name}, residing at ${p.profile.addr}, certify that I am competent to translate
  from the source language to English, and that the above translation is accurate and complete
  to the best of my knowledge and belief, pursuant to 8 CFR §103.2(b)(3).
</div>

<div style="margin-top:32px">
  <div style="font-size:12px;color:#666;margin-bottom:8px">Translator Signature:</div>
  ${sigBlock}
  <div style="margin-top:16px;font-size:12px;color:#666">Date: ${new Date(p.signedAt).toLocaleDateString('en-US')}</div>
  <div style="font-size:12px;color:#666">Address: ${p.profile.addr}</div>
</div>

<hr style="margin:32px 0;border-color:#e8e5e0"/>
<p style="font-size:11px;color:#888;text-align:center">
  Messenginfo is not a law firm. You signed this certification under 8 CFR §103.2(b)(3)
  and accept full responsibility for the accuracy of the translation.
  Verify current requirements at uscis.gov before filing.
</p>
</body></html>`
}

export async function POST(req: NextRequest) {
  let payload: PdfPayload
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const { profile, selectedPlan, spanishCopy, locale, signedAt } = payload

  if (!profile?.email || !profile?.name || !selectedPlan) {
    return NextResponse.json({ ok: false, error: 'Missing required fields' }, { status: 400 })
  }

  const certHtml = buildCertHtml(payload)
  const planLabel = PLAN_LABEL[selectedPlan] ?? selectedPlan

  // ── 1. Save to Supabase ──────────────────────────────────────────────────────
  try {
    const supabase = createAdminSupabaseClient()
    await supabase.from('translation_orders').insert({
      name: profile.name,
      email: profile.email,
      phone: profile.phone,
      address: profile.addr,
      plan: selectedPlan,
      spanish_copy: spanishCopy,
      locale,
      signed_at: signedAt,
      signature_method: payload.signatureMethod,
      certification_version: payload.certificationTextVersion,
      status: 'signed',
    })
  } catch (e) {
    // Table may not exist yet — log but don't block
    console.error('[generate-pdf] Supabase insert failed:', e)
  }

  // ── 2. Send confirmation to user ─────────────────────────────────────────────
  await sendEmail({
    to: profile.email.trim().toLowerCase(),
    subject: `Your USCIS Translation Certification — ${planLabel}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#1e40af">✅ Your translation certification is ready</h2>
        <p>Hi ${profile.name},</p>
        <p>Your translation document is attached to this email as an HTML file.
           Open it in your browser, then use <strong>File → Print → Save as PDF</strong>
           to create the final PDF for USCIS submission.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <tr><td style="padding:8px;border:1px solid #e5e7eb;background:#f9fafb;font-weight:700">Plan</td>
              <td style="padding:8px;border:1px solid #e5e7eb">${planLabel}</td></tr>
          <tr><td style="padding:8px;border:1px solid #e5e7eb;background:#f9fafb;font-weight:700">Signed</td>
              <td style="padding:8px;border:1px solid #e5e7eb">${new Date(signedAt).toLocaleString('en-US')}</td></tr>
        </table>
        <p style="font-size:13px;color:#6b7280">
          Certified under 8 CFR §103.2(b)(3). You are the translator of record.
          Messenginfo is not a law firm. Verify requirements at uscis.gov before filing.
        </p>
        <p>Questions? Reply to this email or contact <a href="mailto:support@messenginfo.com">support@messenginfo.com</a></p>
      </div>
    `,
    type: 'translation_email',
    attachment: { filename: 'uscis-translation-certification.html', content: certHtml },
  })

  // ── 3. Admin report (no attachments, no documents — text summary only) ────────
  await sendEmail({
    to: '2133611700uscis@gmail.com',
    subject: `[NEW ORDER] Translation ${planLabel} — ${profile.name}`,
    html: `
      <div style="font-family:monospace;font-size:13px;max-width:600px">
        <h3 style="font-family:sans-serif;color:#1e40af">📋 New Translation Order</h3>
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:6px 12px;background:#f3f4f6;font-weight:700;width:40%">Name</td><td style="padding:6px 12px;border-bottom:1px solid #e5e7eb">${profile.name}</td></tr>
          <tr><td style="padding:6px 12px;background:#f3f4f6;font-weight:700">Email</td><td style="padding:6px 12px;border-bottom:1px solid #e5e7eb">${profile.email}</td></tr>
          <tr><td style="padding:6px 12px;background:#f3f4f6;font-weight:700">Phone</td><td style="padding:6px 12px;border-bottom:1px solid #e5e7eb">${profile.phone || '—'}</td></tr>
          <tr><td style="padding:6px 12px;background:#f3f4f6;font-weight:700">Address</td><td style="padding:6px 12px;border-bottom:1px solid #e5e7eb">${profile.addr || '—'}</td></tr>
          <tr><td style="padding:6px 12px;background:#f3f4f6;font-weight:700">Plan</td><td style="padding:6px 12px;border-bottom:1px solid #e5e7eb">${planLabel}${spanishCopy ? ' + Spanish Copy' : ''}</td></tr>
          <tr><td style="padding:6px 12px;background:#f3f4f6;font-weight:700">Locale</td><td style="padding:6px 12px;border-bottom:1px solid #e5e7eb">${locale}</td></tr>
          <tr><td style="padding:6px 12px;background:#f3f4f6;font-weight:700">Signature</td><td style="padding:6px 12px;border-bottom:1px solid #e5e7eb">${payload.signatureMethod === 'drawn_on_screen' ? 'Digital (drawn)' : 'Manual wet signature'}</td></tr>
          <tr><td style="padding:6px 12px;background:#f3f4f6;font-weight:700">Signed at</td><td style="padding:6px 12px">${new Date(signedAt).toLocaleString('en-US')}</td></tr>
        </table>
        <p style="font-family:sans-serif;font-size:12px;color:#9ca3af;margin-top:16px">
          ℹ️ Document not attached — client received their certification directly.
        </p>
      </div>
    `,
    type: 'admin_notification',
  })

  return NextResponse.json({ ok: true })
}
