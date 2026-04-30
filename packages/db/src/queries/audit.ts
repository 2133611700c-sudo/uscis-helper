import type { ServerClient } from '../client';

interface AuditEntry {
  actor_id?: string | null;
  action: string;
  target_table?: string;
  target_id?: string;
  detail?: Record<string, unknown>;
  ip_hash?: string;
}

export async function writeAuditLog(db: ServerClient, entry: AuditEntry): Promise<void> {
  const { error } = await db.from('audit_log').insert(entry);
  if (error) throw error;
}
