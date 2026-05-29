/** D7 Auditor — evidence ledger. Records every field's provenance for any
 *  product (one shared ledger). In-memory now; production persists to Supabase.
 *  No PDF/output is trustworthy without an auditId + per-field source. */
export interface AuditField { field: string; value: string; source: string; can_read: boolean; review_required: boolean }
export interface AuditEntry { auditId: string; product: string; ts: number; fields: AuditField[]; officialSources: string[] }

let seq = 0
const store = new Map<string, AuditEntry>()

export function recordAudit(e: Omit<AuditEntry, 'auditId' | 'ts'>, now = 0): string {
  const auditId = `aud_${e.product}_${++seq}`
  store.set(auditId, { ...e, auditId, ts: now })
  return auditId
}
export function getAudit(id: string): AuditEntry | null { return store.get(id) ?? null }
export function auditCount(): number { return store.size }
