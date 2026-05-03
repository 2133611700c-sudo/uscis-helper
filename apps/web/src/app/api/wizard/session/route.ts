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
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { locale = 'en', service_slug = 're-parole-u4u', anon_user_id } = body
    const supabase = getSupabase()
    const sessionId = randomUUID()
    const { data, error } = await supabase
      .from('wizard_sessions')
      .insert({
        session_id: sessionId,
        anon_user_id: anon_user_id || randomUUID(),
        locale,
        service_slug,
        current_step: 0,
        status: 'active',
      })
      .select('session_id, id, created_at')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ session_id: data.session_id, id: data.id, created_at: data.created_at })
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
      .select('session_id, locale, service_slug, current_step, status, created_at, updated_at')
      .eq('session_id', sessionId)
      .single()
    if (error || !data) return NextResponse.json({ error: 'not found' }, { status: 404 })
    return NextResponse.json(data)
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// PATCH /api/wizard/session — update step + state
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { session_id, current_step, status } = body
    if (!session_id) return NextResponse.json({ error: 'session_id required' }, { status: 400 })
    const supabase = getSupabase()
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (current_step !== undefined) update.current_step = current_step
    if (status !== undefined) update.status = status
    const { data, error } = await supabase
      .from('wizard_sessions')
      .update(update)
      .eq('session_id', session_id)
      .select('session_id, current_step, status, updated_at')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
