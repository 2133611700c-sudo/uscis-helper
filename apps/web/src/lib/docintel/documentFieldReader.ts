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
import { resolveAuthorityFields } from './authorityResolve'
import { applyAntiFabricationGate, HANDWRITTEN_FABRICATION_RISK_CLASSES } from './antiFabricationGate'
import { docintelIdToDocumentClass } from '@/lib/canonical/core/documentClassPolicy'
import { identityHash, decideStatus, applySelfConsistencyOutcome } from './selfConsistency'
import { recordDocumentClassMetric, type MetricProduct } from './documentClassMetric'
import type {
  DocumentReadResult,
  ExtractedDocField,
  VisionProvider,
} from './types'

export async function readDocument(
  imageBuffer: Buffer,
  mimeType: string,
  docTypeId: string,
  opts: { provider?: VisionProvider; timeoutMs?: number; attemptsPerModel?: number; product?: MetricProduct } = {},
): Promise<DocumentReadResult> {
  const spec = getDocTypeSpec(docTypeId)
  if (!spec) {
    return {
      ok: false, doc_type_id: docTypeId, fields: [], anchor_read: false,
      provider: null, model: null, ms: 0, status: 'unknown_document_type',
      error: `No registry entry for "${docTypeId}"`,
    }
  }

  // PII-free document-class metric (logging only; silent unless flag on).
  if (opts.product) recordDocumentClassMetric({ product: opts.product, docTypeId })

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
    if (!value) {
      // Phase 2.0 bug-C fix: do NOT silently drop a field when toCanonicalValue
      // fails (e.g. date with no iso_date, agency with no Cyrillic in later fields).
      // If the vision provider DID read something (r.cyrillic non-empty), emit the
      // field as a review-required candidate with the raw Cyrillic as fallback value.
      // D2 will have a chance to normalize it; human review is always required.
      // When r.cyrillic is also empty there is nothing to emit — skip normally.
      if (r.cyrillic) {
        if (r.field === spec.vision_anchor) anchorRead = true
        fields.push({
          field: r.field,
          kind,
          raw_cyrillic: r.cyrillic,
          value: r.cyrillic,  // unresolved canonical; D2 may normalize from Cyrillic
          confidence: Math.max(0, Math.min(1, r.confidence)),
          review_required: true,
          source: 'vision',
          provider: provider.name,
          review_reasons: ['canonical_value_unresolved'],
        })
      }
      continue
    }
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

  // SMART_NORMALIZE_ENABLED (default OFF): document-level post-passes that need
  // the full field set (the per-field toCanonicalValue has no sibling context
  // and returns a bare string, dropping any review signal).
  //   P2.2 — reconcile patronymic vs sibling given name + inferred sex.
  //   P2.3 — resolve issuing authority (agency) via the sourced registry.
  // No silent correction; never lowers a review flag. Flag OFF → fields untouched.
  let finalFields =
    process.env.SMART_NORMALIZE_ENABLED === '1'
      ? resolveAuthorityFields(reconcilePatronymicFields(fields))
      : fields

  // ANTI_FABRICATION_GATE_ENABLED (default OFF): on hard-case document classes,
  // force review on identity/document-critical fields (the model's own
  // review_required=false is not trusted there). Only raises review; never
  // changes values. Applied here so all 4 products inherit it via this one door.
  if (process.env.ANTI_FABRICATION_GATE_ENABLED === '1') {
    finalFields = applyAntiFabricationGate(finalFields, docTypeId)
  }

  // SELF_CONSISTENCY_GATE_ENABLED (default OFF): instability detector for the
  // handwritten-risk allowlist. Acts ONLY when ANTI_FABRICATION_GATE_ENABLED is
  // also ON (no hidden second reads / paid behavior). Re-reads the SAME image with
  // the SAME provider, compares the raw-identity hash; disagreement / incomplete /
  // sparse → force review on identity fields (NEVER changes values, NEVER claims
  // correctness; agreement does NOT lower review). NOT a majority vote.
  let selfConsistency: DocumentReadResult['self_consistency']
  const scOn =
    process.env.ANTI_FABRICATION_GATE_ENABLED === '1' &&
    process.env.SELF_CONSISTENCY_GATE_ENABLED === '1' &&
    HANDWRITTEN_FABRICATION_RISK_CLASSES.has(docintelIdToDocumentClass(docTypeId))
  if (scOn) {
    const runs = Math.min(4, Math.max(2, Number(process.env.SELF_CONSISTENCY_RUNS) || 2))
    const scTimeout = Number(process.env.SELF_CONSISTENCY_TIMEOUT_MS) || opts.timeoutMs
    const first = identityHash(read.fields)
    const others: Array<{ hash: string; count: number } | null> = []
    if (first.count >= 2) {
      for (let i = 1; i < runs; i++) {
        try {
          const r2 = await provider.readFields(imageBuffer, mimeType, spec, { timeoutMs: scTimeout })
          others.push(r2.ok ? identityHash(r2.fields) : null)
        } catch {
          others.push(null)
        }
      }
    }
    const status = decideStatus(first, others)
    finalFields = applySelfConsistencyOutcome(finalFields, status)
    selfConsistency = {
      status,
      instability: status === 'mismatch',
      identity_hash_prefix: first.hash.slice(0, 12),
      runs,
    }
  }

  return {
    ok: true, doc_type_id: docTypeId, fields: finalFields, anchor_read: anchorRead,
    provider: provider.name, model: read.model, ms: read.ms,
    status: `ok:${read.model}:${read.ms}ms:${fields.length}f`,
    ...(selfConsistency ? { self_consistency: selfConsistency } : {}),
  }
}

function isHandwritten(spec: ReturnType<typeof getDocTypeSpec>, field: string): boolean {
  return !!spec?.fields.find((f) => f.field === field)?.handwritten
}
