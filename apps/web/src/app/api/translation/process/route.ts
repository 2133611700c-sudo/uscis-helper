import { NextRequest, NextResponse } from 'next/server'
import { getRepositories } from '@/lib/repositories'
import type { OrderRecord } from '@/lib/repositories'
import { generateFullPacket } from '@/lib/packet'
import type { PacketInput } from '@/lib/packet'

/** Map a camelCase OrderRecord back to the snake_case response shape. */
function orderToResponse(o: OrderRecord) {
  return {
    order_id: o.orderId,
    status: o.status,
    ocr_status: o.ocrStatus ?? null,
    fields_extracted: o.fieldsExtracted ?? null,
    fields_reviewed: o.fieldsReviewed ?? null,
    pdf_storage_key: o.pdfStorageKey ?? null,
    locale: o.locale ?? null,
    document_type: o.documentType ?? null,
    created_at: o.createdAt ?? null,
    updated_at: o.updatedAt ?? null,
  }
}

// GET /api/translation/process?order_id=ORD-xxx — get order status + fields
export async function GET(req: NextRequest) {
  const orderId = req.nextUrl.searchParams.get('order_id')
  if (!orderId) return NextResponse.json({ error: 'order_id required' }, { status: 400 })

  try {
    const order = await getRepositories().orders.getOrder(orderId)
    if (!order) return NextResponse.json({ error: 'order not found' }, { status: 404 })
    return NextResponse.json(orderToResponse(order))
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

    const repos = getRepositories()
    const now = new Date().toISOString()
    const updates: Partial<Omit<OrderRecord, 'orderId'>> = {}
    if (fields_reviewed !== undefined) updates.fieldsReviewed = fields_reviewed
    if (status !== undefined) updates.status = status

    const updated = await repos.orders.updateOrder(order_id, updates, now)
    if (!updated) return NextResponse.json({ error: 'order not found' }, { status: 404 })

    // Log event
    await repos.orders.appendEvent(order_id, 'fields_reviewed', { status: updated.status })

    return NextResponse.json({
      order_id: updated.orderId,
      status: updated.status,
      ocr_status: updated.ocrStatus ?? null,
      updated_at: updated.updatedAt ?? null,
    })
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// POST /api/translation/process — generate packet for a reviewed order
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { order_id?: string }
    const { order_id } = body

    if (!order_id) return NextResponse.json({ error: 'order_id required' }, { status: 400 })

    const repos = getRepositories()

    // Fetch order details
    const order = await repos.orders.getOrder(order_id)
    if (!order) {
      return NextResponse.json({ error: 'order not found' }, { status: 404 })
    }

    // Build PacketInput from order data
    // Map legacy field shape to v5 ExtractedField shape
    type LegacyField = { field_name: string; source_text: string; translated_text: string }
    const rawFields = Array.isArray(order.fieldsReviewed)
      ? (order.fieldsReviewed as LegacyField[])
      : []

    const fields = rawFields.map((f: LegacyField) => ({
      field: f.field_name ?? 'unknown',
      source_label: f.field_name ?? '',
      source_zone: 'unknown',
      bbox: [0, 0, 1, 1] as [number, number, number, number],
      raw_value: f.source_text ?? '',
      normalized_value: f.translated_text ?? '',
      language_layer: 'uk' as const,
      confidence: 1.0,
      review_required: false,
    }))

    const input: PacketInput = {
      order_id: order.orderId,
      scopeTitle: `English Translation of Ukrainian Document`,
      documentType: (order.documentType as string) ?? 'other',
      doc_type: (order.documentType as string) ?? 'other',
      source_language: 'Ukrainian',
      target_language: (order.locale as string) ?? 'en',
      translated_at: new Date().toISOString(),
      fields,
      sourceTraces: [],
      certificationRecord: {
        signer_full_name: '',
        language_pair_confirmed: false,
        statement: '',
        signature_typed_name: '',
        signed_at: new Date().toISOString(),
        certification_version: 'v1.0-8cfr-2026',
      },
      sessionId: order.orderId,
    }

    const result = await generateFullPacket(input)

    if (!result.ok) {
      return NextResponse.json({ error: result.error ?? 'Packet generation failed' }, { status: 500 })
    }

    // Update order status
    await repos.orders.updateOrder(order_id, { status: 'packet_ready' }, new Date().toISOString())

    await repos.orders.appendEvent(order_id, 'packet_generated', {
      has_signed_url: !!result.signedUrl,
      files_count: result.files.length,
    })

    return NextResponse.json({
      ok: true,
      order_id,
      download_url: result.signedUrl ?? null,
      expires_at: result.expiresAt?.toISOString() ?? null,
      files: result.files.map((f) => ({ filename: f.filename, contentType: f.contentType })),
    })
  } catch (e: unknown) {
    console.error('[translation/process] packet error:', String(e))
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
