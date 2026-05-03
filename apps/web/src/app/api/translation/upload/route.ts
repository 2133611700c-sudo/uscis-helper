import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

function getSupabase() {
  const url = process.env.SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, key, { auth: { persistSession: false } })
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const locale = (formData.get('locale') as string) || 'en'
    const anonUserId = (formData.get('anon_user_id') as string) || randomUUID()

    if (!file) return NextResponse.json({ error: 'file required' }, { status: 400 })
    if (file.size > 10 * 1024 * 1024)
      return NextResponse.json({ error: 'file too large (max 10MB)' }, { status: 400 })

    const supabase = getSupabase()
    const orderId = 'ORD-' + randomUUID().slice(0, 8).toUpperCase()
    const ext = file.name.split('.').pop() ?? 'bin'
    const storageKey = `${orderId}/${randomUUID()}.${ext}`

    const bytes = await file.arrayBuffer()
    const { error: storageError } = await supabase.storage
      .from('documents')
      .upload(storageKey, bytes, { contentType: file.type, upsert: false })

    if (storageError) return NextResponse.json({ error: storageError.message }, { status: 500 })

    const { data, error } = await supabase
      .from('translation_orders')
      .insert({
        order_id: orderId,
        anon_user_id: anonUserId,
        locale,
        storage_key: storageKey,
        status: 'uploaded',
        ocr_status: 'manual_review_required',
        fields_extracted: {
          note: 'OCR not yet implemented. Please fill fields manually.',
        },
      })
      .select('order_id, status, ocr_status')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({
      order_id: data.order_id,
      status: data.status,
      ocr_status: data.ocr_status,
      message: 'Document uploaded. Manual field review required.',
    })
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
