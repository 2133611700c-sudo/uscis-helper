/**
 * certifierOverrideApply — the single helper that wires the `certifierAuthority`
 * primitive into a request. ALL override logic lives here (pure + testable); the
 * generate-pdf route makes ONE guarded call so the sensitive payment/PDF path gets
 * the smallest possible surface change.
 *
 * Behind CERTIFIER_OVERRIDE_ENABLED (the route passes `enabled`). When disabled the
 * helper returns the fields untouched (byte-identical prod). When enabled, each field
 * carrying a `certifier_override` is evaluated per ADR-021 / LAW 2#5; on finalize the
 * field's final_value is set and its review flag cleared; a block (anchor conflict /
 * invalid) is returned for the route to surface as 422. Every decision is audited.
 */
import {
  evaluateCertifierOverride,
  buildCertifierAuditRecord,
  recordCertifierOverride,
  type AuthorityInput,
} from './certifierAuthority'
import { persistCertifierAudit } from './persistCertifierAudit'

export interface CertifierOverridePayload {
  reason_code: AuthorityInput
  certifier_id: string
  /** the value to release; defaults to the field's normalized_value */
  proposed_value?: string | null
  /** a cross-document anchor value (MRZ/EAD) for this field, if present */
  anchor_value?: string | null
  /** applicant case/person key (ADDITION B) */
  cross_doc_anchor_id?: string | null
  /** required free text for reason_code='other_with_text' */
  note?: string | null
}

export interface FieldWithMaybeOverride {
  field: string
  normalized_value?: string | null
  final_value?: string | null
  review_required?: boolean
  certifier_override?: CertifierOverridePayload
  [k: string]: unknown
}

export interface ApplyCtx {
  enabled: boolean
  docType: string
  documentClass: string
  sessionId: string
  linkedPdfDocId?: string | null
  /** caller stamps UTC ISO (injected for testability) */
  timestampUtc: string
  /** allow post-launch-only reason codes (dual_witness). Default false. */
  postLaunchEnabled?: boolean
}

export interface OverrideBlock {
  field: string
  reason: string
}

/**
 * Apply every field's certifier_override in place. Returns the (mutated) fields and
 * the FIRST block encountered (anchor conflict or invalid authority) for the route to
 * turn into a 422. No override / disabled ⇒ fields untouched, block=null.
 */
export async function applyCertifierOverrides(
  fields: FieldWithMaybeOverride[],
  ctx: ApplyCtx,
): Promise<{ fields: FieldWithMaybeOverride[]; block: OverrideBlock | null }> {
  if (!ctx.enabled) return { fields, block: null }

  for (const f of fields) {
    const ov = f.certifier_override
    if (!ov) continue

    const proposed = ov.proposed_value !== undefined ? ov.proposed_value : (f.normalized_value ?? null)
    const result = evaluateCertifierOverride({
      docType: ctx.docType,
      field: f.field,
      proposedValue: proposed,
      authority: ov.reason_code,
      note: ov.note ?? null,
      anchorValue: ov.anchor_value ?? null,
      postLaunchEnabled: ctx.postLaunchEnabled,
    })

    // Audit EVERY decision (finalize, refusal, block, reject) — no silent overrides.
    const auditRecord = buildCertifierAuditRecord({
      authority: ov.reason_code,
      tier: result.tier,
      field: f.field,
      documentClass: ctx.documentClass,
      previousValue: f.final_value ?? (f.normalized_value ?? null),
      newValue: result.finalValue,
      certifierId: ov.certifier_id,
      timestampUtc: ctx.timestampUtc,
      sessionId: ctx.sessionId,
      linkedPdfDocId: ctx.linkedPdfDocId ?? null,
      crossDocAnchorId: ov.cross_doc_anchor_id ?? null,
      decision: result.decision,
    })
    recordCertifierOverride(auditRecord) // console fallback (always)
    // L3 T0: durable append-only persistence (CERTIFIER_AUDIT_PERSIST_ENABLED, OFF=no-op).
    await persistCertifierAudit(auditRecord, { note: ov.note ?? null })

    switch (result.decision) {
      case 'finalize':
        f.final_value = result.finalValue
        f.review_required = false // certifier attested → resolves the review gate
        break
      case 'refused_null':
        f.final_value = null // documented refusal stays unresolved (review_required untouched)
        break
      case 'block_escalate':
        return { fields, block: { field: f.field, reason: 'anchor_conflict' } }
      case 'reject_invalid':
        return { fields, block: { field: f.field, reason: result.reasons[0] ?? 'invalid_override' } }
    }
  }

  return { fields, block: null }
}
