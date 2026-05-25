/**
 * TPS OCR Audit — logs each extraction run to Supabase tps_ocr_audit.
 *
 * Fire-and-forget: never blocks OCR response, never crashes route.
 */

import { createAdminSupabaseClient } from '@/lib/supabase/admin'

export interface OcrAuditInput {
  provider: string
  doc_type_hint: string | null
  document_id: string
  text_length: number
  page_count: number
  field_count: number
  rejected_fields: string[]
  success: boolean
  error_message?: string
  processing_ms: number
  brain_status?: string
}

export async function logOcrRun(input: OcrAuditInput): Promise<void> {
  try {
    const supabase = createAdminSupabaseClient()
    await supabase.from('tps_ocr_audit').insert({
      provider: input.provider,
      doc_type_hint: input.doc_type_hint,
      document_id: input.document_id,
      text_length: input.text_length,
      page_count: input.page_count,
      field_count: input.field_count,
      rejected_fields: JSON.stringify(input.rejected_fields),
      success: input.success,
      error_message: input.error_message || null,
      processing_ms: input.processing_ms,
      brain_status: input.brain_status || null,
    })
  } catch {
    // Fire-and-forget: never crash the OCR response
  }
}
