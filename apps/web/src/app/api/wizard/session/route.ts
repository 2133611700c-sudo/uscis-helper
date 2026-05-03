import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

function getSupabase() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase not configured')
  return createClient(url, key, { auth: { persistSession: false } })
}

// POST /api/wizard/session — create new session
// Table schema: id (UUID PK auto), anon_user_id, service_slug, locale, current_step, state_json
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { locale = 'en', service_slug = 're-parole-u4u', anon_user_id } = body
    const supabase = getSupabase()
    const { data, error } = await supabase
      .from('wizard_sessions')
      .insert({
        anon_user_id: anon_user_id || randomUUID(),
        locale,
        service_slug,
        current_step: 0,
        state_json: {},
      })
      .select('id, anon_user_id, locale, service_slug, current_step, created_at')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Log wizard_start event (no PII) — fire and forget, non-fatal
    void supabase.from('audit_log').insert({
      action: 'wizard.start',
      target_table: 'wizard_sessions',
      detail: { service_slug, locale, session_id: data.id },
    })

    return NextResponse.json({ session_id: data.id, ...data })
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// GET /api/wizard/session?id=<session_id> — retrieve session
export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('id')
  if (!sessionId) return NextResponse.json({ error: 'id required' }, { status: 400 })
  try {
    const supabase = getSupabase()
    const { data, error } = await supabase
      .from('wizard_sessions')
      .select('id, locale, service_slug, current_step, state_json, created_at, updated_at')
      .eq('id', sessionId)
      .single()
    if (error || !data) return NextResponse.json({ error: 'not found' }, { status: 404 })
    return NextResponse.json({ session_id: data.id, ...data })
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// PATCH /api/wizard/session — update step + partial state
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { session_id, current_step, state_json } = body
    if (!session_id) return NextResponse.json({ error: 'session_id required' }, { status: 400 })
    const supabase = getSupabase()
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (current_step !== undefined) update.current_step = current_step
    if (state_json !== undefined) update.state_json = state_json
    const { data, error } = await supabase
      .from('wizard_sessions')
      .update(update)
      .eq('id', session_id)
      .select('id, current_step, state_json, updated_at')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Log step_save event (no PII — only step number) — fire and forget, non-fatal
    if (current_step !== undefined) {
      void supabase.from('audit_log').insert({
        action: 'wizard.step_save',
        target_table: 'wizard_sessions',
        detail: { session_id, step: current_step },
      })
    }

    return NextResponse.json({ session_id: data.id, ...data })
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
