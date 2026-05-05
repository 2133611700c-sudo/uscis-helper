import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'
import { rateLimit, getClientIP } from '@/lib/security/rate-limit'
import {
  isUUID,
  sanitiseLocale,
  sanitiseServiceSlug,
  isValidStep,
  isStateJsonWithinLimit,
} from '@/lib/security/validation'

function getSupabase() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase not configured')
  return createClient(url, key, { auth: { persistSession: false } })
}

// POST /api/wizard/session — create new session
export async function POST(req: NextRequest) {
  // Rate limit: 30 sessions per minute per IP
  const ip = getClientIP(req)
  const rl = await rateLimit(`wizard-session-post:${ip}`, 30, 60_000)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt.getTime() - Date.now()) / 1000)) } }
    )
  }

  try {
    const body = await req.json().catch(() => ({}))
    const { anon_user_id } = body

    // Sanitise locale + service_slug (use whitelist, never trust raw input)
    const locale = sanitiseLocale(body.locale)
    const service_slug = sanitiseServiceSlug(body.service_slug)

    // Validate anon_user_id if provided — must be a UUID
    const userId = anon_user_id && isUUID(anon_user_id) ? anon_user_id : randomUUID()

    const supabase = getSupabase()
    const { data, error } = await supabase
      .from('wizard_sessions')
      .insert({
        anon_user_id: userId,
        locale,
        service_slug,
        current_step: 0,
        state_json: {},
      })
      .select('id, anon_user_id, locale, service_slug, current_step, created_at')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

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
  // Rate limit: 60 reads per minute per IP (higher — used for progress display)
  const ip = getClientIP(req)
  const rl = await rateLimit(`wizard-session-get:${ip}`, 60, 60_000)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const sessionId = req.nextUrl.searchParams.get('id')
  if (!sessionId) return NextResponse.json({ error: 'id required' }, { status: 400 })

  // Must be a valid UUID — reject probing attempts
  if (!isUUID(sessionId)) {
    return NextResponse.json({ error: 'invalid id format' }, { status: 400 })
  }

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
  // Rate limit: 60 saves per minute per IP
  const ip = getClientIP(req)
  const rl = await rateLimit(`wizard-session-patch:${ip}`, 60, 60_000)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  try {
    const body = await req.json()
    const { session_id, current_step, state_json } = body

    if (!session_id) return NextResponse.json({ error: 'session_id required' }, { status: 400 })

    // Validate session_id format
    if (!isUUID(session_id)) {
      return NextResponse.json({ error: 'invalid session_id format' }, { status: 400 })
    }

    // Validate step number if provided
    if (current_step !== undefined && !isValidStep(current_step)) {
      return NextResponse.json({ error: 'invalid step value' }, { status: 400 })
    }

    // Validate state_json size if provided
    if (state_json !== undefined && !isStateJsonWithinLimit(state_json)) {
      return NextResponse.json({ error: 'state_json exceeds size limit' }, { status: 400 })
    }

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
