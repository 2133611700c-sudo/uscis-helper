/**
 * recordGuardBlock — L1 baseline write-hook. Persists a PII-free guard-block event to
 * public.guard_block_events so the rate-alert cron can measure the real block rate.
 *
 * Behind GUARD_BLOCK_METRICS_ENABLED (default OFF → no-op, zero cost). Best-effort:
 * never throws, never blocks the request beyond a single awaited insert. NO field
 * names / values are stored — gate + failure_type + doc_type + session only (LAW 5).
 */
import { createAdminSupabaseClient } from '@/lib/supabase/admin'

export interface GuardBlockEvent {
  gate: string
  failureType: string
  docType?: string | null
  sessionId?: string | null
}

export function isGuardBlockMetricsEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.GUARD_BLOCK_METRICS_ENABLED === '1'
}

/** Record one guard-block event. OFF ⇒ no-op. Never throws. */
export async function recordGuardBlock(e: GuardBlockEvent): Promise<void> {
  if (!isGuardBlockMetricsEnabled()) return
  try {
    const supabase = createAdminSupabaseClient()
    await supabase.from('guard_block_events').insert({
      gate: e.gate,
      failure_type: e.failureType,
      doc_type: e.docType ?? null,
      session_id: e.sessionId ?? null,
    })
  } catch {
    /* metrics must never break the request */
  }
}
