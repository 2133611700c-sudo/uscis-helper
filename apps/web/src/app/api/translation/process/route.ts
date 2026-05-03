import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  const url = process.env.SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, key, { auth: { persistSession: false } })
}

// GET /api/translation/process?order_id=ORD-xxx — get order status + fields
export async function GET(req: NextRequest) {
  const orderId = req.nextUrl.searchParams.get('order_id')
  if (!orderId) return NextResponse.json({ error: 'order_id required' }, { status: 400 })

  try {
    const supabase = getSupabase()
    const { data, error } = await supabase
      .from('translation_orders')
      .select(
        'order_id, status, ocr_status, fields_extracted, fields_reviewed, pdf_storage_key, locale, document_type, created_at, updated_at'
      )
      .eq('order_id', orderId)
      .single()

    if (error || !data) return NextResponse.json({ error: 'order not found' }, { status: 404 })
    return NextResponse.json(data)
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// PATCH /api/translation/process — submit reviewed fields, advance status
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { order_id, fields_reviewed, status } = body

    if (!order_id) return NextResponse.json({ error: 'order_id required' }, { status: 400 })

    const supabase = getSupabase()
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (fields_reviewed !== undefined) update.fields_reviewed = fields_reviewed
    if (status !== undefined) update.status = status

    const { data, error } = await supabase
      .from('translation_orders')
      .update(update)
      .eq('order_id', order_id)
      .select('order_id, status, ocr_status, updated_at')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Log event
    await supabase.from('translation_events').insert({
      order_id,
      event_type: 'fields_reviewed',
      metadata: { status: data.status },
    })

    return NextResponse.json(data)
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
