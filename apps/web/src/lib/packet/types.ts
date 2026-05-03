/**
 * apps/web/src/lib/packet/types.ts
 *
 * Shared types for document packet generation.
 */

export interface TranslatedField {
  field_name: string
  source_text: string
  translated_text: string
}

export interface PacketInput {
  order_id: string
  doc_type: string
  source_language: string
  target_language: string
  translated_at: Date
  fields: TranslatedField[]
  // Optional metadata
  client_name?: string
  certifier_statement?: string
}

export interface DocumentFile {
  filename: string
  contentType: 'application/pdf' | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' | 'application/zip'
  buffer: Buffer
}

export interface PacketOutput {
  ok: boolean
  orderId: string
  files: DocumentFile[]
  signedUrl?: string
  expiresAt?: Date
  error?: string
}
