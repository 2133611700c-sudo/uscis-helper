/**
 * canonical/core/crossDocSession.ts — the SESSION-LEVEL wiring for STAGE 3 cross-document
 * reconciliation (crossDocReconcile.ts). It turns the per-session set of persisted canonical
 * documents into the PerDocFields[] the reconciliation engine consumes, then runs it.
 *
 * WHY this exists (honest root-cause, 2026-06-22): each product OCR route reads ONE document
 * and persists it to `canonical_documents` (keyed session_id+product+doc_type). Multiple
 * documents of the SAME person therefore coexist in the DB but were never loaded together, so
 * `reconcileAcrossDocuments` had no caller. This module is the missing glue: a PURE adapter +
 * orchestrator (no I/O — the loader is injected by the route, so this is fully unit-testable).
 *
 * HARD INVARIANTS (inherit crossDocReconcile L5/L6/L7/L8 + CONSTITUTION L10):
 *   - Behind CROSS_DOC_RECONCILE_ENABLED, default OFF. flagOn=false ⇒ zero changes.
 *   - One PerDoc per (doc_type): the MOST RECENT canonical row for that type wins (a re-upload
 *     supersedes the older read). Dedup is deterministic (latest createdAt).
 *   - Pure: no Supabase, no fetch. The caller passes already-loaded CanonicalDocumentResult[].
 *     This keeps L3/L5 boundaries intact and makes the unit test deterministic.
 */
import type { CanonicalDocumentResult } from '../types'
import {
  reconcileAcrossDocuments,
  isCrossDocReconcileEnabled,
  type PerDocFields,
  type ReconcileChange,
} from './crossDocReconcile'

export interface SessionReconcileResult {
  /** Per-document fields, with weaker held fields given a cross-doc suggestedValue. */
  perDoc: PerDocFields[]
  /** Every reconciliation performed (empty when flag OFF or <2 distinct docs). */
  changes: ReconcileChange[]
}

/** One-click cross-doc suggestion for a single document, shaped for an OCR route response. */
export interface CrossDocSuggestion {
  field_key: string
  suggested_value: string
  from_doc_type: string
}

/**
 * Extract the suggestions that apply to ONE document (by docType) from a session reconcile
 * result — the values a stronger sibling anchor pre-filled into this doc's held fields.
 * Pure; returns [] when this docType has no changes.
 */
export function suggestionsForDoc(result: SessionReconcileResult, docType: string): CrossDocSuggestion[] {
  const thisDoc = result.perDoc.find((d) => d.docType === docType)
  if (!thisDoc) return []
  return result.changes
    .filter((c) => c.docId === thisDoc.docId)
    .map((c) => ({ field_key: c.fieldKey, suggested_value: c.suggestedValue, from_doc_type: c.fromDocType }))
}

/**
 * Adapt the session's persisted canonical documents into PerDocFields[], keeping ONE entry
 * per doc_type (the most recently created row for that type). Order is stable (by docType).
 */
export function canonicalDocsToPerDocFields(docs: CanonicalDocumentResult[]): PerDocFields[] {
  // Keep the latest row per doc_type (a re-upload supersedes an earlier read).
  const latestByType = new Map<string, CanonicalDocumentResult>()
  for (const d of docs) {
    const prev = latestByType.get(d.docType)
    if (!prev || (d.createdAt ?? '') > (prev.createdAt ?? '')) {
      latestByType.set(d.docType, d)
    }
  }
  return [...latestByType.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([docType, d]) => ({
      // docId must be unique per document; documentSessionId may be '' so fall back to docType.
      docId: d.documentSessionId && d.documentSessionId.trim() !== '' ? d.documentSessionId : docType,
      docType,
      fields: d.fields,
    }))
}

/**
 * Reconcile all of a session's canonical documents. PURE — the caller supplies the loaded
 * documents. Returns the (copied) per-doc fields with cross-doc suggestions + the change log.
 *
 * @param docs   the session's canonical documents (already loaded by the route)
 * @param flagOn defaults to isCrossDocReconcileEnabled(); pass explicitly in tests.
 */
export function reconcileSessionDocuments(
  docs: CanonicalDocumentResult[],
  flagOn: boolean = isCrossDocReconcileEnabled(),
): SessionReconcileResult {
  const perDocIn = canonicalDocsToPerDocFields(docs)
  const { docs: perDoc, changes } = reconcileAcrossDocuments(perDocIn, flagOn)
  return { perDoc, changes }
}
