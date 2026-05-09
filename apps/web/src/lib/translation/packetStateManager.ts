/**
 * Packet State Manager — Messenginfo v5.0
 * Maintains the full state of a translation session.
 * Persisted to Supabase translation_orders table.
 */
import { PacketState, DocumentType, TranslationStatus, ExtractedField, CertificationRecord } from './types'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { buildScopeTitle } from './bureauStyleRenderer'

export function createPacketState(params: {
  session_id: string
  locale?: string
}): PacketState {
  const now = new Date().toISOString()
  return {
    session_id: params.session_id,
    status: 'created',
    document_type: null,
    controlling_spelling: {},
    uploaded_pages: 0,
    total_pages_declared: 1,
    extracted_fields: [],
    source_traces: [],
    user_corrections: [],
    certification_record: null,
    payment_confirmed: false,
    payment_checkout_id: null,
    qa_result: null,
    scope_title: '',
    locale: params.locale ?? 'en',
    created_at: now,
    updated_at: now,
  }
}

export function advanceStatus(state: PacketState, newStatus: TranslationStatus): PacketState {
  return { ...state, status: newStatus, updated_at: new Date().toISOString() }
}

export function setDocumentType(state: PacketState, docType: DocumentType, totalPages: number): PacketState {
  return {
    ...state,
    document_type: docType,
    total_pages_declared: totalPages,
    scope_title: buildScopeTitle(docType, 0, totalPages),
    updated_at: new Date().toISOString(),
  }
}

export function recordUpload(state: PacketState, pagesUploaded: number): PacketState {
  const uploaded = state.uploaded_pages + pagesUploaded
  return {
    ...state,
    uploaded_pages: uploaded,
    status: 'uploaded',
    scope_title: buildScopeTitle(state.document_type ?? 'other', uploaded, state.total_pages_declared),
    updated_at: new Date().toISOString(),
  }
}

export function setExtractedFields(state: PacketState, fields: ExtractedField[]): PacketState {
  return {
    ...state,
    extracted_fields: fields,
    source_traces: fields.map(f => ({
      field: f.field,
      document_type: state.document_type ?? 'other',
      source_label: f.source_label,
      source_zone: f.source_zone,
      bbox: f.bbox,
      raw_value: f.raw_value,
      normalized_value: f.normalized_value,
      language_layer: f.language_layer,
      confidence: f.confidence,
      review_required: f.review_required,
    })),
    status: 'extracted',
    updated_at: new Date().toISOString(),
  }
}

export function applyUserCorrection(
  state: PacketState,
  field: string,
  correctedValue: string,
  correctionClass: ExtractedField['correction_class']
): PacketState {
  const fields = state.extracted_fields.map(f =>
    f.field === field
      ? { ...f, normalized_value: correctedValue, user_corrected: true, correction_class: correctionClass }
      : f
  )
  const corrections = [
    ...state.user_corrections.filter(c => c.field !== field),
    { ...fields.find(f => f.field === field)! },
  ]
  return {
    ...state,
    extracted_fields: fields,
    user_corrections: corrections,
    updated_at: new Date().toISOString(),
  }
}

export function confirmPayment(state: PacketState, checkoutId: string): PacketState {
  return {
    ...state,
    payment_confirmed: true,
    payment_checkout_id: checkoutId,
    status: 'paid',
    updated_at: new Date().toISOString(),
  }
}

export function setCertificationRecord(state: PacketState, record: CertificationRecord): PacketState {
  return {
    ...state,
    certification_record: record,
    status: 'certified',
    updated_at: new Date().toISOString(),
  }
}

// Supabase persistence
export async function persistPacketState(state: PacketState): Promise<void> {
  try {
    const supabase = createAdminSupabaseClient()
    await supabase.from('translation_orders').upsert({
      session_id: state.session_id,
      status: state.status,
      document_type: state.document_type,
      uploaded_pages: state.uploaded_pages,
      total_pages: state.total_pages_declared,
      payment_confirmed: state.payment_confirmed,
      payment_checkout_id: state.payment_checkout_id,
      scope_title: state.scope_title,
      locale: state.locale,
      qa_status: state.qa_result?.status ?? null,
      updated_at: state.updated_at,
    }, { onConflict: 'session_id' })
  } catch (err) {
    console.error('[PacketStateManager] persist failed:', err)
  }
}
