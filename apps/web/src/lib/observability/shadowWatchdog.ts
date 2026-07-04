/**
 * shadowWatchdog — DeepSeek role #1 (AGENTIC_BRAIN_BLUEPRINT): the system's inner voice that
 * "перепроверяет и доносит". It watches the PII-FREE shadow/telemetry markers the one-brain
 * work emits and turns them into an aggregate + anomaly report.
 *
 * SAFETY MODEL:
 *  - INPUT IS PII-FREE BY CONSTRUCTION: it only parses the known marker lines
 *    ([decision_shadow], [tps_one_arbitration_shadow], [deepseek_brain_contribution],
 *    [recognize_retry_on_empty], [ADR018] fallback_model_used) whose payloads are keys,
 *    counts and flags — never field values. Unknown lines are ignored, never forwarded.
 *  - The AGGREGATION is deterministic local code (no network). The optional DeepSeek verdict
 *    runs ONLY behind strict DEEPSEEK_WATCHDOG='1' (key presence is NOT permission — L3),
 *    and receives ONLY the aggregate JSON produced here (double PII barrier).
 */

export interface WatchdogAggregate {
  lines_scanned: number
  markers_parsed: number
  decision_shadow: {
    docs: number
    fields: number
    diffs: number
    diff_keys: Record<string, number>
    unresolved_mismatches: number
  }
  one_arbitration_shadow: {
    docs: number
    missing_in_shadow_total: number
    review_loosened_total: number
    review_tightened_total: number
    value_diff_total: number
    offending_doc_types: string[]
  }
  deepseek_contribution: { docs: number; brain_added_total: number; by_doc_type: Record<string, number> }
  fallback_model_reads: { docs: number; by_model: Record<string, number> }
  retry_on_empty_fired: number
  /** deterministic verdicts — the flip-blocking conditions, computed locally */
  flags: {
    decision_flip_blocked: boolean
    arbitration_flip_blocked: boolean
    notes: string[]
  }
}

const empty = (): WatchdogAggregate => ({
  lines_scanned: 0,
  markers_parsed: 0,
  decision_shadow: { docs: 0, fields: 0, diffs: 0, diff_keys: {}, unresolved_mismatches: 0 },
  one_arbitration_shadow: {
    docs: 0, missing_in_shadow_total: 0, review_loosened_total: 0,
    review_tightened_total: 0, value_diff_total: 0, offending_doc_types: [],
  },
  deepseek_contribution: { docs: 0, brain_added_total: 0, by_doc_type: {} },
  fallback_model_reads: { docs: 0, by_model: {} },
  retry_on_empty_fired: 0,
  flags: { decision_flip_blocked: false, arbitration_flip_blocked: false, notes: [] },
})

function tryJson(s: string): Record<string, unknown> | null {
  const m = s.match(/\{.*\}/)
  if (!m) return null
  try { return JSON.parse(m[0]) as Record<string, unknown> } catch { return null }
}

/** Aggregate a log stream's shadow markers. Pure, deterministic, no I/O. */
export function aggregateShadowLogs(logText: string): WatchdogAggregate {
  const agg = empty()
  for (const line of logText.split('\n')) {
    agg.lines_scanned++
    if (line.includes('[decision_shadow]')) {
      const j = tryJson(line); if (!j) continue
      agg.markers_parsed++
      agg.decision_shadow.docs++
      agg.decision_shadow.fields += Number(j.fields ?? 0)
      agg.decision_shadow.diffs += Number(j.diffs ?? 0)
      for (const k of (j.diff_keys as string[] | undefined) ?? []) {
        agg.decision_shadow.diff_keys[k] = (agg.decision_shadow.diff_keys[k] ?? 0) + 1
      }
      if (j.unresolved_match === false) agg.decision_shadow.unresolved_mismatches++
    } else if (line.includes('[tps_one_arbitration_shadow]')) {
      const j = tryJson(line); if (!j) continue
      agg.markers_parsed++
      const o = agg.one_arbitration_shadow
      o.docs++
      const missing = ((j.missing_in_shadow as string[] | undefined) ?? []).length
      const loosened = ((j.review_loosened_keys as string[] | undefined) ?? []).length
      o.missing_in_shadow_total += missing
      o.review_loosened_total += loosened
      o.review_tightened_total += ((j.review_tightened_keys as string[] | undefined) ?? []).length
      o.value_diff_total += ((j.value_diff_keys as string[] | undefined) ?? []).length
      const dt = String(j.doc_type_hint ?? 'unknown')
      if ((missing > 0 || loosened > 0) && !o.offending_doc_types.includes(dt)) o.offending_doc_types.push(dt)
    } else if (line.includes('[deepseek_brain_contribution]')) {
      const j = tryJson(line); if (!j) continue
      agg.markers_parsed++
      agg.deepseek_contribution.docs++
      const added = Number(j.brain_added ?? 0)
      agg.deepseek_contribution.brain_added_total += added
      const dt = String(j.doc_type_hint ?? 'unknown')
      agg.deepseek_contribution.by_doc_type[dt] = (agg.deepseek_contribution.by_doc_type[dt] ?? 0) + added
    } else if (line.includes('fallback_model_used')) {
      const j = tryJson(line); if (!j) continue
      agg.markers_parsed++
      agg.fallback_model_reads.docs++
      const m = String(j.model ?? 'unknown')
      agg.fallback_model_reads.by_model[m] = (agg.fallback_model_reads.by_model[m] ?? 0) + 1
    } else if (line.includes('[recognize_retry_on_empty]')) {
      agg.markers_parsed++
      agg.retry_on_empty_fired++
    }
  }
  // deterministic flip-blocking verdicts (the same criteria the plan fixed)
  if (agg.decision_shadow.diffs > 0 || agg.decision_shadow.unresolved_mismatches > 0) {
    agg.flags.decision_flip_blocked = true
    agg.flags.notes.push(`decision_shadow: ${agg.decision_shadow.diffs} diffs / ${agg.decision_shadow.unresolved_mismatches} unresolved mismatches — flip forbidden`)
  }
  if (agg.one_arbitration_shadow.missing_in_shadow_total > 0 || agg.one_arbitration_shadow.review_loosened_total > 0) {
    agg.flags.arbitration_flip_blocked = true
    agg.flags.notes.push(`one_arbitration: missing=${agg.one_arbitration_shadow.missing_in_shadow_total} loosened=${agg.one_arbitration_shadow.review_loosened_total} — flip forbidden`)
  }
  return agg
}

export function isDeepseekWatchdogEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.DEEPSEEK_WATCHDOG === '1'
}

/**
 * Optional LLM verdict over the AGGREGATE ONLY (never raw logs). Strict flag; key ≠ permission.
 * Fail-open: any error → null (the deterministic aggregate remains the source of truth).
 */
export async function deepseekWatchdogVerdict(
  agg: WatchdogAggregate,
  fetchImpl: typeof fetch = fetch,
  env: Record<string, string | undefined> = process.env,
): Promise<string | null> {
  if (!isDeepseekWatchdogEnabled(env)) return null
  const key = (env.DEEPSEEK_API_KEY ?? '').trim()
  if (!key) return null
  try {
    const res = await fetchImpl('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: env.DEEPSEEK_WATCHDOG_MODEL || 'deepseek-chat',
        temperature: 0,
        max_tokens: 600,
        messages: [
          {
            role: 'system',
            content:
              'You are the recognition system\'s watchdog. You receive an aggregate of PII-free ' +
              'shadow telemetry (counts/keys only). Report: (1) is anything degrading or anomalous; ' +
              '(2) are the flip-blocking conditions met; (3) one concrete next check. Be terse and honest.',
          },
          { role: 'user', content: JSON.stringify(agg) },
        ],
      }),
    })
    if (!res.ok) return null
    const j = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
    return j.choices?.[0]?.message?.content ?? null
  } catch {
    return null
  }
}
