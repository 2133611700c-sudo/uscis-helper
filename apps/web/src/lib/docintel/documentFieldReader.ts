/**
 * docintel/documentFieldReader — the single entry point every product calls.
 *
 *   readDocument(image, mime, 'ua_birth_certificate') → ExtractedDocField[]
 *
 * Orchestrates: registry lookup → vendor-agnostic vision provider → centralized
 * KMU-55 transliteration → canonical, provenance-tracked, review-flagged fields.
 * TPS, ReParole, EAD and Translation all consume the SAME output shape; each
 * adapts it to its own form/translation needs (see adapters/).
 *
 * Candidate-only: review_required is set per field; the consuming product's
 * Review Gate makes values final. Vision failure → ok:false, never throws.
 */

import { getDocTypeSpec } from './documentRegistry'
import { defaultVisionProvider } from './providers/geminiVisionProvider'
import { toCanonicalValue } from './transliterationPolicy'
import { reconcilePatronymicFields } from './patronymicReconcile'
import type {
  DocumentReadResult,
  ExtractedDocField,
  VisionProvider,
} from './types'

export async function readDocument(
  imageBuffer: Buffer,
  mimeType: string,
  docTypeId: string,
  opts: { provider?: VisionProvider; timeoutMs?: number; attemptsPerModel?: number } = {},
): Promise<DocumentReadResult> {
  const spec = getDocTypeSpec(docTypeId)
  if (!spec) {
    return {
      ok: false, doc_type_id: docTypeId, fields: [], anchor_read: false,
      provider: null, model: null, ms: 0, status: 'unknown_document_type',
      error: `No registry entry for "${docTypeId}"`,
    }
  }

  const provider = opts.provider ?? defaultVisionProvider
  const read = await provider.readFields(imageBuffer, mimeType, spec, {
    timeoutMs: opts.timeoutMs,
    attemptsPerModel: opts.attemptsPerModel,
  })

  if (!read.ok) {
    return {
      ok: false, doc_type_id: docTypeId, fields: [], anchor_read: false,
      provider: provider.name, model: read.model, ms: read.ms,
      status: `vision_failed:${read.error ?? 'unknown'}`, error: read.error,
    }
  }

  const kindByField = new Map(spec.fields.map((f) => [f.field, f.kind]))
  const fields: ExtractedDocField[] = []
  let anchorRead = false

  for (const r of read.fields) {
    if (!r.can_read) continue
    const kind = kindByField.get(r.field)
    if (!kind) continue
    const value = toCanonicalValue(r, kind)
    if (!value) continue
    if (r.field === spec.vision_anchor) anchorRead = true
    fields.push({
      field: r.field,
      kind,
      raw_cyrillic: r.cyrillic || null,
      value,
      confidence: Math.max(0, Math.min(1, r.confidence)),
      // Handwritten fields ALWAYS require human confirmation; printed fields
      // require it below high confidence (v5 §19 critical-field gate).
      review_required: isHandwritten(spec, r.field) ? true : r.confidence < 0.95,
      source: 'vision',
      provider: provider.name,
    })
  }

  // P2.2 (SMART_NORMALIZE_ENABLED, default OFF): reconcile patronymic fields
  // against the sibling given name + inferred sex. A post-pass because it needs
  // the full field set (the per-field toCanonicalValue has no sibling context).
  // No silent correction — any change forces review. Flag OFF → fields untouched.
  const finalFields =
    process.env.SMART_NORMALIZE_ENABLED === '1' ? reconcilePatronymicFields(fields) : fields

  return {
    ok: true, doc_type_id: docTypeId, fields: finalFields, anchor_read: anchorRead,
    provider: provider.name, model: read.model, ms: read.ms,
    status: `ok:${read.model}:${read.ms}ms:${fields.length}f`,
  }
}

function isHandwritten(spec: ReturnType<typeof getDocTypeSpec>, field: string): boolean {
  return !!spec?.fields.find((f) => f.field === field)?.handwritten
}
