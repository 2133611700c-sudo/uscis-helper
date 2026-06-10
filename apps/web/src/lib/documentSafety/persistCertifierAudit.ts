/**
 * persistCertifierAudit — L3 T0 durable receiver for certifier_override audit records.
 * Writes to public.certifier_override_audit (owner-applied, append-only via triggers).
 * Behind CERTIFIER_AUDIT_PERSIST_ENABLED (default OFF → no-op). Best-effort, never throws.
 *
 * Matches the owner's EXACT schema + satisfies its 5 DB CHECK constraints in CODE
 * (defense-in-depth — we never attempt an insert the DB would reject):
 *   1. reason_code ∈ the 6 certifier codes (NOT 'user_confirmed' — that's the user self-path)
 *   2. tier ∈ {1,2,3}
 *   3. other_with_text ⇒ reason_note non-empty
 *   4. unreadable_per_source ⇒ new_value_sha256 IS NULL; else NOT NULL
 *   5. user_clarified ⇒ tier 3 only
 * Only ACTED overrides are persisted (decision finalize | refused_null) — a block/reject
 * did not produce an attestation. certifier_id is a uuid column → OWNER_CERTIFIER_ID env.
 */
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { asUuidOrNull } from './recordGuardBlock'
import type { CertifierAuditRecord, CertifierReasonCode } from './certifierAuthority'

const CERTIFIER_REASON_CODES: ReadonlySet<string> = new Set<CertifierReasonCode>([
  'source_verified', 'source_corroborated_user_value', 'user_clarified',
  'dual_witness', 'unreadable_per_source', 'other_with_text',
])

export function isCertifierAuditPersistEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.CERTIFIER_AUDIT_PERSIST_ENABLED === '1'
}

/**
 * Decide whether a record is persistable (all DB constraints satisfiable) and return the
 * row to insert, or null with a reason. Pure — testable without a DB.
 */
export function buildAuditRow(
  rec: CertifierAuditRecord,
  opts: { note?: string | null; ownerCertifierId?: string | null } = {},
): { ok: true; row: Record<string, unknown> } | { ok: false; reason: string } {
  if (!CERTIFIER_REASON_CODES.has(rec.reason_code)) return { ok: false, reason: 'not_a_certifier_reason_code' } // e.g. user_confirmed
  if (rec.decision !== 'finalize' && rec.decision !== 'refused_null') return { ok: false, reason: 'not_an_acted_override' }
  if (rec.tier !== 1 && rec.tier !== 2 && rec.tier !== 3) return { ok: false, reason: 'invalid_tier' }

  const reason = rec.reason_code
  const isRefusal = reason === 'unreadable_per_source'
  // constraint 4: refusal ⇒ new hash null; otherwise must be non-null
  if (isRefusal && rec.new_value_hash !== null) return { ok: false, reason: 'refusal_must_have_null_new_value' }
  if (!isRefusal && rec.new_value_hash === null) return { ok: false, reason: 'non_refusal_needs_new_value' }
  // constraint 3
  if (reason === 'other_with_text' && !(opts.note && opts.note.trim())) return { ok: false, reason: 'other_with_text_needs_note' }
  // constraint 5
  if (reason === 'user_clarified' && rec.tier !== 3) return { ok: false, reason: 'user_clarified_tier3_only' }

  const certifierId = asUuidOrNull(opts.ownerCertifierId)
  if (!certifierId) return { ok: false, reason: 'missing_owner_certifier_uuid' } // certifier_id is NOT NULL uuid

  return {
    ok: true,
    row: {
      field_name: rec.field_name,
      doc_type: rec.document_class,
      tier: rec.tier,
      reason_code: reason,
      reason_note: reason === 'other_with_text' ? (opts.note ?? null) : null,
      certifier_id: certifierId,
      previous_value_sha256: rec.previous_value_hash,
      new_value_sha256: rec.new_value_hash,
      session_id: asUuidOrNull(rec.session_id),
      linked_pdf_doc_id: asUuidOrNull(rec.linked_pdf_doc_id),
      cross_doc_anchor_id: asUuidOrNull(rec.cross_doc_anchor_id),
      immutable_signature: rec.immutable_marker,
    },
  }
}

/** Persist one certifier audit record. OFF ⇒ no-op. Never throws. */
export async function persistCertifierAudit(
  rec: CertifierAuditRecord,
  opts: { note?: string | null } = {},
): Promise<void> {
  if (!isCertifierAuditPersistEnabled()) return
  const built = buildAuditRow(rec, { note: opts.note, ownerCertifierId: process.env.OWNER_CERTIFIER_ID })
  if (!built.ok) {
    // PII-free: log WHY a record was not persisted (so a silent gap is visible).
    console.warn('[certifier_audit] not_persisted', JSON.stringify({ reason: built.reason, reason_code: rec.reason_code, tier: rec.tier }))
    return
  }
  try {
    const supabase = createAdminSupabaseClient()
    const { error } = await supabase.from('certifier_override_audit').insert(built.row)
    if (error) {
      // PII-free: surface a persist failure (e.g. the certifier_id→profiles FK) so a
      // durable-audit gap is VISIBLE, not silent. The console line is the fallback chain.
      console.warn('[certifier_audit] persist_failed', JSON.stringify({ code: error.code ?? null, reason_code: rec.reason_code }))
    }
  } catch {
    /* durable persist is best-effort; the console audit line is the fallback */
  }
}
