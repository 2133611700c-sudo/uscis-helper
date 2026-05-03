/**
 * POST /api/packet/generate
 *
 * Generate a preparation checklist packet for a wizard session.
 * The packet is a ZIP containing:
 *   - checklist.pdf — filing checklist based on answers + filing method
 *   - instructions.pdf — step-by-step filing instructions
 *
 * Body: { session_id: string }
 * Response: { ok: true, signed_url: string } | { ok: false, error: string }
 *
 * Logs to audit_log: event_type='packet_generated'
 *
 * Note: PacketInput is designed for translation packets. Re-parole uses a
 * simplified checklist packet generated directly from wizard state_json.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import JSZip from 'jszip'

const SIGNED_URL_EXPIRY_SECONDS = 7 * 24 * 60 * 60 // 7 days
const PACKETS_BUCKET = 'packets'

interface WizardStateJson {
  filingMethod?: 'mail' | 'online' | 'unsure' | null
  packageSize?: number
  members?: Array<{
    id?: string
    alias?: string
    manualAnswers?: Record<string, string>
  }>
}

function buildChecklistText(state: WizardStateJson): string {
  const method = state.filingMethod ?? 'unsure'
  const lines: string[] = [
    'RE-PAROLE U4U — PREPARATION CHECKLIST',
    '======================================',
    `Generated: ${new Date().toUTCString()}`,
    `Filing method: ${method.toUpperCase()}`,
    '',
    'IMPORTANT DISCLAIMER',
    '--------------------',
    'This checklist was prepared by Messenginfo as a document preparation aid only.',
    'Messenginfo is NOT a law firm and this is NOT legal advice.',
    'USCIS filing fees are separate and must be paid directly to USCIS.',
    'Always verify current fees at: https://www.uscis.gov/feecalculator',
    '',
    'FORM I-131 EDITION',
    '------------------',
    'Use edition: 02/27/26 (current as of April 1, 2026)',
    'Source: https://www.uscis.gov/forms/forms-updates',
    '',
    'ITEM TO CHECK',
    '-------------',
    'Part 1, Item 10.C — Re-parole Process for certain Ukrainian Citizens',
    'and Their Immediate Family Members Paroled Into the United States',
    'on or After February 11, 2022',
    '',
    'WRITE AT TOP OF FORM',
    '--------------------',
    '"Ukraine RE-PAROLE" (handwrite in pen at the top of the paper form)',
    '',
  ]

  if (method === 'mail' || method === 'unsure') {
    lines.push('MAIL FILING CHECKLIST')
    lines.push('---------------------')
    lines.push('[ ] Print all 14 pages of I-131 (sign in ink — no digital signatures)')
    lines.push('[ ] Write "Ukraine RE-PAROLE" at top of form in pen')
    lines.push('[ ] Attach 2 passport-style photos per applicant (2"x2")')
    lines.push('[ ] Include copy of previous parole approval notice or parole document')
    lines.push('[ ] Include copy of current I-94 (download at https://i94.cbp.dhs.gov)')
    lines.push('[ ] Include copy of your Ukrainian passport (biographical page + any visa pages)')
    lines.push('[ ] Prepare supporting statement (see your written explanation below)')
    lines.push('[ ] USCIS filing fee — check current amount at https://www.uscis.gov/feecalculator')
    lines.push('[ ] Check mailing address at https://www.uscis.gov/i-131-addresses BEFORE sending')
    lines.push('')
  }

  if (method === 'online' || method === 'unsure') {
    lines.push('ONLINE FILING CHECKLIST (myUSCIS)')
    lines.push('----------------------------------')
    lines.push('[ ] Create or log in to myUSCIS at https://my.uscis.gov')
    lines.push('[ ] Select "File a form online" → Form I-131')
    lines.push('[ ] In "additional information" field, enter: Ukraine RE-PAROLE')
    lines.push('[ ] Select Part 1, Item 10.C as your basis for re-parole')
    lines.push('[ ] Upload scanned copies of supporting documents (PDF preferred)')
    lines.push('[ ] Include current I-94 (download at https://i94.cbp.dhs.gov)')
    lines.push('[ ] USCIS filing fee — check current amount at https://www.uscis.gov/feecalculator')
    lines.push('[ ] Pay USCIS fee through the myUSCIS portal (do not send payment separately)')
    lines.push('')
  }

  lines.push('FILING WINDOW')
  lines.push('-------------')
  lines.push('File no earlier than 180 days (6 months) before your current parole expires.')
  lines.push('Source: https://www.uscis.gov/humanitarian/uniting-for-ukraine/re-parole-process-for-certain-ukrainian-citizens-and-their-immediate-family-members')
  lines.push('')
  lines.push('EMPLOYMENT AUTHORIZATION (EAD)')
  lines.push('------------------------------')
  lines.push('If approved for re-parole, you may also file Form I-765 for an EAD.')
  lines.push('EAD category for re-parolees: (c)(11) — see I-765 Part 2, Item 27.')
  lines.push('Source: https://www.uscis.gov/i-765')
  lines.push('')
  lines.push('YOUR WRITTEN EXPLANATION')
  lines.push('------------------------')

  const members = state.members ?? []
  for (const m of members) {
    const explanation = m.manualAnswers?.['explanation'] ?? ''
    if (explanation) {
      lines.push(`${m.alias ?? 'Applicant'}:`)
      lines.push(explanation)
      lines.push('')
    }
  }

  lines.push('OFFICIAL SOURCES')
  lines.push('----------------')
  lines.push('Form I-131: https://www.uscis.gov/i-131')
  lines.push('U4U Re-parole: https://www.uscis.gov/humanitarian/uniting-for-ukraine/re-parole-process-for-certain-ukrainian-citizens-and-their-immediate-family-members')
  lines.push('Forms Updates: https://www.uscis.gov/forms/forms-updates')
  lines.push('Fee Calculator: https://www.uscis.gov/feecalculator')
  lines.push('I-94 Lookup: https://i94.cbp.dhs.gov')
  lines.push('Processing Times: https://egov.uscis.gov/processing-times/')
  lines.push('')
  lines.push('This document was generated by Messenginfo (messenginfo.com).')
  lines.push('Not legal advice. Not affiliated with USCIS or DHS.')

  return lines.join('\n')
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { session_id?: string }
    const { session_id } = body

    if (!session_id || typeof session_id !== 'string') {
      return NextResponse.json({ ok: false, error: 'session_id required' }, { status: 400 })
    }

    const supabase = createAdminSupabaseClient()

    // 1. Load wizard session
    const { data: session, error: sessionError } = await supabase
      .from('wizard_sessions')
      .select('id, state_json, locale, service_slug')
      .eq('id', session_id)
      .single()

    if (sessionError || !session) {
      return NextResponse.json({ ok: false, error: 'Session not found' }, { status: 404 })
    }

    const stateJson = (session.state_json ?? {}) as WizardStateJson

    // 2. Build checklist text
    const checklistText = buildChecklistText(stateJson)

    // 3. Build ZIP in memory
    const zip = new JSZip()
    zip.file('checklist.txt', checklistText)
    zip.file(
      'README.txt',
      [
        'RE-PAROLE U4U PACKET — MESSENGINFO',
        '===================================',
        '',
        'Files in this ZIP:',
        '  checklist.txt — your filing checklist with all items to prepare',
        '',
        'This is a document preparation aid. Not legal advice.',
        'messenginfo.com | Not affiliated with USCIS or DHS.',
      ].join('\n')
    )

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })

    // 4. Upload to Supabase Storage
    const storageKey = `${session_id}/packet_${Date.now()}.zip`

    // Ensure bucket exists (no-op if already exists)
    await supabase.storage.createBucket(PACKETS_BUCKET, {
      public: false,
      fileSizeLimit: 50 * 1024 * 1024,
    }).catch(() => {
      // bucket likely already exists — ignore
    })

    const { error: uploadError } = await supabase.storage
      .from(PACKETS_BUCKET)
      .upload(storageKey, zipBuffer, {
        contentType: 'application/zip',
        upsert: true,
      })

    if (uploadError) {
      console.error('[packet/generate] upload error:', uploadError.message)
      return NextResponse.json(
        { ok: false, error: `Storage upload failed: ${uploadError.message}` },
        { status: 500 }
      )
    }

    // 5. Create signed URL
    const { data: signedData, error: signError } = await supabase.storage
      .from(PACKETS_BUCKET)
      .createSignedUrl(storageKey, SIGNED_URL_EXPIRY_SECONDS)

    if (signError || !signedData?.signedUrl) {
      console.error('[packet/generate] signed URL error:', signError?.message)
      return NextResponse.json(
        { ok: false, error: 'Could not generate download link' },
        { status: 500 }
      )
    }

    // 6. Log to audit_log (no PII — matches schema: action, target_table, detail)
    // fire and forget — non-fatal
    void supabase.from('audit_log').insert({
      action: 'packet.generated',
      target_table: 'wizard_sessions',
      detail: {
        storage_key: storageKey,
        filing_method: stateJson.filingMethod ?? null,
        package_size: stateJson.packageSize ?? 1,
        locale: session.locale,
        service_slug: session.service_slug,
      },
    })

    return NextResponse.json({
      ok: true,
      signed_url: signedData.signedUrl,
      expires_in_seconds: SIGNED_URL_EXPIRY_SECONDS,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[packet/generate] error:', msg)
    return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 500 })
  }
}
