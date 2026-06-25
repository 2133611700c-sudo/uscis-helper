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
import { defaultVisionProvider, primaryGeminiModel } from './providers/geminiVisionProvider'
import { getGeminiApiKey } from '@/lib/gemini/apiKey'
import { autoOrient } from './orientation/autoOrient'
import { orientToUpright, isContentOrientEnabled } from './orientation/detectOrientation'
import {
  recoverEmptyFieldsByTiles, geminiReadFieldsFromCrop, isHiResTileRecoverEnabled, isEmptyField,
} from './ensemble/tileRegionRead'
import { applyDateRoleGuard } from './dates/dateRoleGuard'
import {
  toCanonicalValue,
  isNameSourceScriptAmbiguous,
  documentScriptOf,
  romanizeNameForDocScript,
} from './transliterationPolicy'
import { reconcilePatronymicFields } from './patronymicReconcile'
import { resolveAuthorityFields } from './authorityResolve'
import { isHandwrittenFamily } from './modelMatrix'
import { readHandwrittenRoute } from './ensemble/handwrittenFieldRoute'
import { isHtrSidecarEnabled } from './providers/htrSidecarProvider'
import { applyAntiFabricationGate, HANDWRITTEN_FABRICATION_RISK_CLASSES } from './antiFabricationGate'
import { docintelIdToDocumentClass } from '@/lib/canonical/core/documentClassPolicy'
import {
  identityHash,
  decideStatus,
  applySelfConsistencyOutcome,
  isSelfConsistencyVoteEnabled,
  decideVote,
  applyVoteOutcome,
} from './selfConsistency'
import { applyConsensusAutoDelivery, snapshotOf } from './autoDeliveryConsensus'
import { recordDocumentClassMetric, type MetricProduct } from './documentClassMetric'
import { classifyProviderError } from '@/lib/ocr/ocrErrors'
import { coordinatedDocumentRead } from './coordinatedDocumentRead'
import { OcrCoordinationUnavailable } from '@/lib/v1/ocrCoordination'
import type {
  DocumentReadResult,
  ExtractedDocField,
  VisionProvider,
} from './types'

export async function readDocument(
  imageBuffer: Buffer,
  mimeType: string,
  docTypeId: string,
  opts: {
    provider?: VisionProvider
    timeoutMs?: number
    attemptsPerModel?: number
    product?: MetricProduct
    /** Tenant/session scope bound into the OCR coordination cache key (isolation). */
    cacheScope?: string
    /** STAGE 4: the PRE-DOWNSCALE high-res original upload. When HIRES_TILE_RECOVER_ENABLED and
     *  the read leaves critical fields empty, it is oriented + tiled to recover those fields. */
    originalBuffer?: Buffer
    /** FREE-FIRST (cost): raw-cyrillic values already known for free from a STRONGER sibling document
     *  (cross-doc reconciliation / MRZ), keyed by field. An empty field present here is filled at $0
     *  BEFORE the paid hi-res tile recovery — so Gemini is only spent on what's genuinely unknown. */
    knownValues?: Record<string, string>
  } = {},
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

  // AUTO_ORIENT_ENABLED (default OFF): correct content rotation BEFORE the read.
  // A real birth cert was photographed sideways (90°) and every engine read the
  // cursive sideways. sharp.rotate() fixes only EXIF; this detects + fixes rotated
  // CONTENT. Fail-open. OFF ⇒ byte-identical, no extra cost.
  // CONTENT_ORIENT_ENABLED (default OFF, PREFERRED): content-based upright detection by direct
  // grid comparison — proven 3/3 + stable on real docs where the old detectCw failed (it
  // false-negatived a sideways military ID and false-positived an upright birth cert, and EXIF is
  // unreliable: military + birth carry the same EXIF flag but only one needs it). Fail-open.
  let orientApplied = 0
  if (isContentOrientEnabled()) {
    const apiKey = getGeminiApiKey()
    if (apiKey) {
      const oriented = await orientToUpright(imageBuffer, apiKey, primaryGeminiModel())
      imageBuffer = oriented.buffer
      orientApplied = oriented.applied
      if (orientApplied) console.info('[content_orient] rotated', JSON.stringify({ doc_type_id: docTypeId, cw: orientApplied }))
    }
  } else if (process.env.AUTO_ORIENT_ENABLED === '1') {
    // Legacy iterative detector (deprecated — kept for rollback; see detectOrientation.ts for why).
    const apiKey = getGeminiApiKey()
    if (apiKey) {
      const oriented = await autoOrient(imageBuffer, apiKey, primaryGeminiModel())
      imageBuffer = oriented.buffer
      orientApplied = oriented.applied
      if (orientApplied) console.info('[auto_orient] rotated', JSON.stringify({ doc_type_id: docTypeId, cw: orientApplied }))
    }
  }

  // OCR COORDINATION (issue #161, OCR_DISTRIBUTED_DEDUP_MODE, default off): the ONE
  // provider call runs through the cross-instance lease + secure cache. off ⇒
  // byte-identical direct call. enforce ⇒ a winner-failure/loser-timeout surfaces
  // OcrCoordinationUnavailable, which we map to an honest non-2xx (never a crash).
  const provider = opts.provider ?? defaultVisionProvider
  let read
  try {
    read = await coordinatedDocumentRead(imageBuffer, mimeType, spec, docTypeId, provider, {
      timeoutMs: opts.timeoutMs,
      attemptsPerModel: opts.attemptsPerModel,
      tenantScope: opts.cacheScope,
      product: opts.product,
    })
  } catch (err) {
    if (err instanceof OcrCoordinationUnavailable) {
      return {
        ok: false, doc_type_id: docTypeId, fields: [], anchor_read: false,
        provider: provider.name, model: null, ms: 0,
        status: `ocr_unavailable:${err.errorClass}`,
        error: err.message,
        provider_error: classifyProviderError(503, undefined, { marker: err.errorClass }),
      }
    }
    throw err
  }

  if (!read.ok) {
    // Honest degradation (P1): classify the provider failure into a typed OCR
    // error. A 429 rate-limit / 5xx / timeout is NOT a "successful empty read" —
    // the route inspects provider_error and fails closed (honest non-2xx) instead
    // of returning HTTP 200 + fields:[]. When the failure carries no HTTP status
    // (e.g. 'no GEMINI_API_KEY', 'invalid JSON', 'deadline') we leave
    // provider_error UNSET so the route's existing 0-field handling applies.
    const hasHttpSignal = typeof read.errorStatus === 'number' || read.errorTimeout === true
    const providerError = hasHttpSignal
      ? classifyProviderError(read.errorStatus ?? 0, undefined, {
          timeout: read.errorTimeout === true,
          marker: read.error ?? null,
        })
      : undefined
    return {
      ok: false, doc_type_id: docTypeId, fields: [], anchor_read: false,
      provider: provider.name, model: read.model, ms: read.ms,
      status: `vision_failed:${read.error ?? 'unknown'}`, error: read.error,
      ...(providerError ? { provider_error: providerError } : {}),
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
    // SOURCE-SCRIPT GATE (owner-locked 2026-06-10): a name whose VISIBLE source
    // script is not confirmed (no distinctive UA і/ї/є/ґ nor RU ы/э/ё/ъ) is
    // AMBIGUOUS — visible source controls transliteration, ambiguity blocks final.
    // `value` stays a best-effort KMU-55 candidate (screen isn't empty), but we
    // force review + reason so C3 will not finalize it until the script is
    // confirmed. Better a noisy review than a clean PDF with the wrong name.
    const ambiguousScript = kind === 'name' && isNameSourceScriptAmbiguous(r.cyrillic ?? '', process.env, spec.id)
    fields.push({
      field: r.field,
      kind,
      raw_cyrillic: r.cyrillic || null,
      value,
      confidence: Math.max(0, Math.min(1, r.confidence)),
      // Handwritten fields ALWAYS require human confirmation; printed fields
      // require it below high confidence (v5 §19 critical-field gate);
      // ambiguous source script always reviews (source_script_ambiguous).
      review_required: isHandwritten(spec, r.field) || ambiguousScript ? true : r.confidence < 0.95,
      source: 'vision',
      provider: provider.name,
      ...(ambiguousScript ? { review_reasons: ['source_script_ambiguous'] } : {}),
    })
  }

  // DOC-SCRIPT NAME ROUTING (DOC_SCRIPT_ROUTING_ENABLED, default OFF). This is the
  // ONE place that sees ALL fields, so it can compute a doc-level Russian signal an
  // individual name read cannot (a bare «Андрей» has no distinctive letter). When the
  // aggregate document is clearly Russian (a -еевич patronymic, Russian month/place
  // word forms — detectDocumentScript over EVERY field's raw Cyrillic), an
  // AMBIGUOUS-script NAME is re-romanized via the Russian table (Андрей→Andrey,
  // Тимофеевич→Timofeyevich) instead of the KMU-55 default (Andrei/...). A name
  // with a distinctive UA letter is never force-Russified. Conservative: detector
  // returns 'ru' only on a one-sided signal, else the value is untouched. Flag OFF ⇒
  // no doc-level signal is computed and every `value` is byte-identical to before.
  if (process.env.DOC_SCRIPT_ROUTING_ENABLED === '1' && fields.length > 0) {
    const docScript = documentScriptOf(read.fields.map((r) => r.cyrillic))
    if (docScript === 'ru') {
      let rerouted = 0
      for (const f of fields) {
        if (f.kind !== 'name' || !f.raw_cyrillic) continue
        const next = romanizeNameForDocScript(f.raw_cyrillic, f.value, docScript)
        if (next !== f.value) {
          f.value = next
          rerouted++
        }
      }
      if (rerouted > 0) {
        console.info('[doc_script_routing]', JSON.stringify({ doc_type_id: docTypeId, docScript, rerouted }))
      }
    }
  }

  // REGISTRY BACKFILL (2026-06-11, owner live test): an unread field
  // (can_read:false, or omitted by the model, or empty cyrillic) used to vanish
  // from the response entirely — the UI then showed 5 of 6 booklet fields and a
  // missing patronymic was indistinguishable from "this doc type has no
  // patronymic". Every registry field now ALWAYS appears: unread → value:null +
  // review_required ("enter manually" row). Guarded by fields.length>0 so a
  // totally failed read still reports 0 fields (ok:false semantics unchanged).
  if (fields.length > 0) {
    const present = new Set(fields.map((f) => f.field))
    for (const f of spec.fields) {
      if (present.has(f.field)) continue
      fields.push({
        field: f.field,
        kind: f.kind,
        raw_cyrillic: null,
        value: null,
        confidence: 0,
        review_required: true,
        source: 'vision',
        provider: provider.name,
        review_reasons: ['not_read_manual_entry'],
      })
    }
  }

  // MODEL MATRIX (ADR-018): only the configured primary model is a trusted
  // reader for Cyrillic documents. When the provider fell back (primary
  // timeout/5xx → flash), every field becomes review-required: gemini-2.5-flash
  // was DISQUALIFIED on certificate docs (read a DIFFERENT person — 2026-06-02
  // adjudication). Deterministic, no flag: a fallback read is never silent.
  if (spec.script !== 'latin' && read.model !== null && read.model !== primaryGeminiModel()) {
    for (const f of fields) {
      f.review_required = true
      f.review_reasons = [...(f.review_reasons ?? []), 'fallback_model_used']
    }
    // Observability (P1): PII-free signal — ids + counts only, never field values.
    // Lets prod monitors see fallback-rate without exposing any document content.
    console.warn('[ADR018] fallback_model_used', JSON.stringify({
      doc_type_id: docTypeId, model: read.model, primary: primaryGeminiModel(), fields: fields.length,
    }))
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
    // R5 — when SELF_CONSISTENCY_VOTE_ENABLED is also ON, retain the re-read field
    // arrays so we can MAJORITY-PICK per identity field. OFF → arrays unused (today).
    const voteOn = isSelfConsistencyVoteEnabled()
    const reReadFields: Array<typeof read.fields> = []
    if (first.count >= 2) {
      for (let i = 1; i < runs; i++) {
        try {
          const r2 = await provider.readFields(imageBuffer, mimeType, spec, { timeoutMs: scTimeout })
          others.push(r2.ok ? identityHash(r2.fields) : null)
          if (voteOn && r2.ok && Array.isArray(r2.fields)) reReadFields.push(r2.fields)
        } catch {
          others.push(null)
        }
      }
    }
    const status = decideStatus(first, others)
    finalFields = applySelfConsistencyOutcome(finalFields, status)
    // R5 — majority-pick voting (gated). Runs AFTER the instability outcome so it can
    // only ADD review (minority/no-majority), never lower it. OFF → skipped entirely.
    if (voteOn && first.count >= 2) {
      const outcome = decideVote(read.fields, reReadFields)
      finalFields = applyVoteOutcome(finalFields, outcome)
    }
    selfConsistency = {
      status,
      instability: status === 'mismatch',
      identity_hash_prefix: first.hash.slice(0, 12),
      runs,
    }
  }

  // AUTO_DELIVERY_CONSENSUS_ENABLED (default OFF): the product-fatal default is that
  // ~100% of fields return review_required even when read correctly, so a no-experience
  // user (35-80yo, won't manually fix) gets NOTHING automatically. This re-reads the page
  // K times with the PRIMARY model and AUTO-DELIVERS (review_required=false) ONLY fields
  // whose source text is IDENTICAL across all reads AND high-confidence AND carry no hard
  // review reason. Unstable (e.g. handwritten DOB that varies 07/28↔05/29) / low-confidence
  // / ambiguous-script fields stay in review. Never changes a value. Cost: K-1 extra reads
  // (budget-gated by the flag; a single read's confidence is NOT trustworthy on handwriting).
  let consensusDiag: { auto_delivered: number; reviewed: number; runs: number } | undefined
  if (process.env.AUTO_DELIVERY_CONSENSUS_ENABLED === '1' && finalFields.length > 0) {
    const runs = Math.min(3, Math.max(2, Number(process.env.AUTO_DELIVERY_CONSENSUS_RUNS) || 2))
    const snaps: ReturnType<typeof snapshotOf>[] = []
    for (let i = 1; i < runs; i++) {
      try {
        const rN = await provider.readFields(imageBuffer, mimeType, spec, { timeoutMs: opts.timeoutMs })
        if (rN.ok && Array.isArray(rN.fields)) snaps.push(snapshotOf(rN.fields))
      } catch { /* a failed re-read = no agreement for any field → everything stays review */ }
    }
    if (snaps.length > 0) {
      // Tag each field with its registry handwritten flag so consensus can refuse to
      // auto-deliver a handwritten DATE/number (stably-misread risk) — names still may.
      const withHandwritten = finalFields.map((f) => ({ ...f, handwritten: isHandwritten(spec, f.field) }))
      const res = applyConsensusAutoDelivery(withHandwritten, snaps, {
        confidenceFloor: Number(process.env.AUTO_DELIVERY_CONFIDENCE_FLOOR) || 0.9,
      })
      finalFields = res.fields as typeof finalFields
      consensusDiag = { auto_delivered: res.auto_delivered, reviewed: res.reviewed, runs }
      console.info('[auto_delivery_consensus]', JSON.stringify({ doc_type_id: docTypeId, ...consensusDiag }))
    }
  }
  void consensusDiag

  // DATE-ROLE GUARD (deterministic, no flag): catch role conflation (one date
  // copied into two role fields) and sequence conflicts (issue before birth).
  // Only raises review; never edits a value or lowers a flag. All products inherit it.
  const dateGuard = applyDateRoleGuard(finalFields)
  finalFields = dateGuard.fields
  if (dateGuard.conflicts.length) {
    console.info('[date_role_guard]', JSON.stringify({ doc_type_id: docTypeId, conflicts: dateGuard.conflicts }))
  }

  // STAGE 4 (HIRES_TILE_RECOVER_ENABLED, default OFF): a dense region read at full-page scale
  // (~4-5 px/letter) returns EMPTY for fields that are PRESENT. When the hi-res original is
  // available, orient it (content-based, reliable) and re-read the empty critical fields from
  // hi-res tiles. Additive + fail-open: only empties pursued, never overwrites a read field;
  // recovered values are held for review. Proven live: birth-cert parents/series recovered 4/5.
  // FREE-FIRST (cost-efficiency): fill empty fields from already-known sibling values ($0) BEFORE any
  // paid recovery. A field filled here is held for review (it is borrowed from another doc, not read
  // here) and is then NOT pursued by the expensive tile recovery below. Never overwrites a read value.
  if (opts.knownValues && Object.keys(opts.knownValues).length > 0) {
    const res = applyKnownValues(finalFields, opts.knownValues)
    finalFields = res.fields
    if (res.filled) console.info('[free_first_fill]', JSON.stringify({ doc_type_id: docTypeId, filled: res.filled }))
  }

  if (isHiResTileRecoverEnabled() && opts.originalBuffer) {
    const criticalKeys = new Set(spec.fields.filter((f) => f.handwritten || f.required).map((f) => f.field))
    const hasEmptyCritical = finalFields.some((f) => isEmptyField(f) && criticalKeys.has(f.field))
    const apiKey = getGeminiApiKey()
    if (hasEmptyCritical && apiKey) {
      try {
        const model = primaryGeminiModel()
        // Orient the hi-res original to upright (reliable grid detector) so L/R tiles map to the
        // real page geometry regardless of the main read's orientation flag.
        const oriented = await orientToUpright(opts.originalBuffer, apiKey, model)
        const fieldLabels = Object.fromEntries(spec.fields.map((f) => [f.field, f.label_uk]))
        const rec = await recoverEmptyFieldsByTiles({
          baseFields: finalFields,
          originalBuffer: oriented.buffer,
          fieldLabels,
          cropRead: (crop, flds) => geminiReadFieldsFromCrop(crop, flds, apiKey, model),
          criticalKeys,
        })
        finalFields = rec.fields
        console.info('[hires_tile_recover]', JSON.stringify({ doc_type_id: docTypeId, orient_applied: oriented.applied, ...rec.diag }))
      } catch (e) {
        console.warn('[hires_tile_recover] failed (non-blocking)', e instanceof Error ? e.message : String(e))
      }
    }
  }

  // HTR FIELD-FIRST ROUTE (ADR-026; gated by HTR_SIDECAR_URL, UNSET in prod → disabled, byte-identical).
  // For a HANDWRITTEN doc family the LLM full-page read of a cursive name field is unreliable (it fabricates).
  // When the key-free HTR sidecar is configured, LOCALIZE each handwritten name field, crop it at NATIVE
  // resolution, and read it via raxtemur — this becomes the AUTHORITATIVE raw_cyrillic for that field (canonical
  // Latin is re-derived downstream by D2/codex). ALWAYS review-gated (raxtemur cannot abstain). Fail-open:
  // any error leaves the LLM read in place. This is the route-by-rendering primary path for handwriting.
  if (isHtrSidecarEnabled() && isHandwrittenFamily(docTypeId) && opts.originalBuffer) {
    try {
      const htr = await readHandwrittenRoute(opts.originalBuffer, mimeType)
      if (htr.length) {
        const byField = new Map(htr.map((h) => [h.field, h]))
        finalFields = finalFields.map((f) => {
          const h = byField.get(f.field)
          if (!h || !h.raw_htr_text.trim()) return f
          return {
            ...f,
            raw_cyrillic: h.raw_htr_text.trim(),
            confidence: h.htr_confidence,
            review_required: true,
            review_reasons: [...(f.review_reasons ?? []), h.review_reason],
          }
        })
        console.info('[htr_field_route]', JSON.stringify({ doc_type_id: docTypeId, htr_fields: htr.length }))
      }
    } catch (e) {
      console.warn('[htr_field_route] failed (non-blocking)', e instanceof Error ? e.message : String(e))
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

/**
 * FREE-FIRST fill: set EMPTY fields from already-known sibling/MRZ values ($0), held for review
 * (borrowed, not read here). NEVER overwrites a field the model already read. Pure; returns a new
 * array + the count filled. This runs BEFORE the paid tile recovery so Gemini is spent only on the
 * fields that are still genuinely unknown (cost-efficiency-first).
 */
export function applyKnownValues(
  fields: ExtractedDocField[],
  known: Record<string, string>,
): { fields: ExtractedDocField[]; filled: number } {
  let filled = 0
  const out = fields.map((f) => {
    const v = known[f.field]
    const empty = (f.value ?? '').trim() === '' && (f.raw_cyrillic ?? '').trim() === ''
    if (!v || !v.trim() || !empty) return f
    filled++
    return {
      ...f, raw_cyrillic: v.trim(), confidence: Math.min(f.confidence ?? 0, 0.5) || 0.5,
      review_required: true, review_reasons: [...(f.review_reasons ?? []), 'known_from_sibling'],
    }
  })
  return { fields: out, filled }
}
