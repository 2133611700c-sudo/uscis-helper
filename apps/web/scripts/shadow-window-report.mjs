#!/usr/bin/env node
/* T1.1 — shadow-window flip report. Feed it the staging/prod function logs; it runs the
 * SAME deterministic aggregator the Watchdog uses (imported from src — no logic fork) and
 * prints the four flip verdicts with the numbers behind them. PII-safe by construction:
 * the aggregator only parses the known keys/counts markers.
 *
 * Usage:
 *   node scripts/shadow-window-report.mjs <logfile>        # file
 *   vercel logs <deploy-url> | node scripts/shadow-window-report.mjs   # stdin
 * Requires Node >=23 (built-in TypeScript stripping for the src import).
 */
import { readFileSync } from 'node:fs'
import { aggregateShadowLogs } from '../src/lib/observability/shadowWatchdog.ts'

const input = process.argv[2]
  ? readFileSync(process.argv[2], 'utf8')
  : readFileSync(0, 'utf8')

const agg = aggregateShadowLogs(input)

console.log('=== SHADOW WINDOW REPORT ===')
console.log(`lines scanned: ${agg.lines_scanned} | markers parsed: ${agg.markers_parsed}`)
if (agg.markers_parsed === 0) {
  console.log('\nNO SHADOW MARKERS FOUND — either the flag is OFF on this deployment,')
  console.log('no documents were processed, or these are the wrong logs. NOT flip evidence.')
  process.exit(2)
}
console.log('\n--- decision engine (ONE_BRAIN_DECISION_SHADOW) ---')
console.log(JSON.stringify(agg.decision_shadow))
console.log('\n--- gates as readers ---')
console.log(JSON.stringify(agg.gates_shadow))
console.log('\n--- tps one-arbitration ---')
console.log(JSON.stringify(agg.one_arbitration_shadow))
console.log('\n--- normalize collapse ---')
console.log(JSON.stringify(agg.normalize_collapse_shadow))
console.log('\n--- other signals ---')
console.log(JSON.stringify({ deepseek: agg.deepseek_contribution, fallback_reads: agg.fallback_model_reads, retry_on_empty: agg.retry_on_empty_fired }))

console.log('\n=== FLIP VERDICTS (docs/ocr/FLIP_CRITERIA.md) ===')
const f = agg.flags
const line = (name, blocked) => console.log(`${blocked ? '⛔ BLOCKED' : '✅ clean '} — ${name}`)
line('decision engine flip', f.decision_flip_blocked)
line('gates-as-readers flip', f.gates_flip_blocked)
line('tps one-arbitration flip', f.arbitration_flip_blocked)
line('normalize-collapse flip', f.normalize_flip_blocked)
for (const n of f.notes) console.log('  note:', n)
console.log('\nRule: a clean verdict on a REAL-traffic window + owner sign-off allows the flip.')
console.log(`Window size here: decision=${agg.decision_shadow.docs} docs, gates=${agg.gates_shadow.docs}, arbitration=${agg.one_arbitration_shadow.docs}, normalize=${agg.normalize_collapse_shadow.docs}. Small N is NOT a window.`)
