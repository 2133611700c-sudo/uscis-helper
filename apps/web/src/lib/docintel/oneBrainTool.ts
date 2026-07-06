/**
 * oneBrainTool — thin canonical probe for document posture + handwritten Cyrillic reads.
 *
 * This is intentionally not a second OCR stack. It wraps the existing shared spine:
 *   preprocess/orientation/posture -> readDocument -> canonical fields
 * and adds a compact summary that is useful for manual inspection, scripts, and benches.
 */

import { getDocTypeSpec } from './documentRegistry'
import { readDocument } from './documentFieldReader'
import type { DocumentReadResult } from './types'
import type { DocumentPostureEnvelope } from './posture/documentPostureEnvelope'
import type { VisionProvider } from './types'

export interface OneBrainReadSummary {
  doc_type_id: string
  ok: boolean
  status: string
  posture_gate: DocumentPostureEnvelope['posture_gate'] | 'not_measured'
  orientation_status: DocumentPostureEnvelope['orientation_status']
  orientation_source: DocumentPostureEnvelope['orientation_source']
  orientation_confidence: DocumentPostureEnvelope['orientation_confidence']
  orientation_backstop_used: DocumentPostureEnvelope['orientation_backstop_used']
  handwritten_fields: number
  handwritten_review_required: number
  fields_with_cyrillic: number
}

export interface OneBrainReadResult {
  read: DocumentReadResult
  summary: OneBrainReadSummary
  handwritten_reads: Array<{
    field: string
    raw_cyrillic: string | null
    value: string | null
    review_required: boolean
    confidence: number
  }>
}

function summarizeFields(docTypeId: string, read: DocumentReadResult): OneBrainReadResult['handwritten_reads'] {
  const spec = getDocTypeSpec(docTypeId)
  if (!spec) return []
  const handwritten = new Set(spec.fields.filter((f) => f.handwritten).map((f) => f.field))
  return read.fields
    .filter((f) => handwritten.has(f.field))
    .map((f) => ({
      field: f.field,
      raw_cyrillic: f.raw_cyrillic ?? null,
      value: f.value ?? null,
      review_required: f.review_required,
      confidence: f.confidence,
    }))
}

function summarize(read: DocumentReadResult, docTypeId: string): OneBrainReadSummary {
  const posture = read.posture
  const handwrittenReads = summarizeFields(docTypeId, read)
  return {
    doc_type_id: docTypeId,
    ok: read.ok,
    status: read.status,
    posture_gate: posture?.posture_gate ?? 'not_measured',
    orientation_status: posture?.orientation_status ?? 'not_measured',
    orientation_source: posture?.orientation_source ?? 'not_measured',
    orientation_confidence: posture?.orientation_confidence ?? 'unknown',
    orientation_backstop_used: posture?.orientation_backstop_used ?? 'none',
    handwritten_fields: handwrittenReads.length,
    handwritten_review_required: handwrittenReads.filter((f) => f.review_required).length,
    fields_with_cyrillic: read.fields.filter((f) => typeof f.raw_cyrillic === 'string' && f.raw_cyrillic.trim().length > 0).length,
  }
}

export async function orientAndReadDocument(
  imageBuffer: Buffer,
  mimeType: string,
  docTypeId: string,
  opts: {
    provider?: VisionProvider
    timeoutMs?: number
    attemptsPerModel?: number
    product?: 'tps' | 'reparole' | 'ead' | 'translation'
    cacheScope?: string
    originalBuffer?: Buffer
    knownValues?: Record<string, string>
    forensic?: {
      runId: string
      sourceSha256?: string | null
      sourceDimensions?: { width: number; height: number } | null
      exifOrientation?: number | null
      preprocessRotation?: number | null
      outputDimensions?: { width: number; height: number } | null
    }
    qualityStatus?: DocumentPostureEnvelope['quality_status']
  } = {},
): Promise<OneBrainReadResult> {
  const read = await readDocument(imageBuffer, mimeType, docTypeId, opts)
  return {
    read,
    summary: summarize(read, docTypeId),
    handwritten_reads: summarizeFields(docTypeId, read),
  }
}

export function formatOneBrainReadResult(result: OneBrainReadResult): string {
  const lines: string[] = []
  lines.push(`DOC_TYPE: ${result.summary.doc_type_id}`)
  lines.push(`STATUS: ${result.summary.status}`)
  lines.push(`OK: ${result.summary.ok}`)
  lines.push(`POSTURE: gate=${result.summary.posture_gate} orientation=${result.summary.orientation_status} source=${result.summary.orientation_source} confidence=${result.summary.orientation_confidence} backstop=${result.summary.orientation_backstop_used}`)
  lines.push(`HANDWRITTEN: fields=${result.summary.handwritten_fields} review_required=${result.summary.handwritten_review_required}`)
  for (const f of result.handwritten_reads) {
    lines.push(`  - ${f.field}: cyr="${f.raw_cyrillic ?? ''}" value="${f.value ?? ''}" review=${f.review_required} conf=${f.confidence.toFixed(2)}`)
  }
  return lines.join('\n')
}
