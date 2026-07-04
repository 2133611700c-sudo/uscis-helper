#!/usr/bin/env tsx
/**
 * shadow-watchdog.ts
 *
 * Local operator/agent helper over the One Brain shadow markers.
 *
 * INPUT:
 *   - a file path as argv[2], OR
 *   - stdin
 *
 * OUTPUT:
 *   - deterministic aggregate + flip-blocking verdicts (always)
 *   - optional DeepSeek prose verdict over the aggregate only when
 *     DEEPSEEK_WATCHDOG='1' and DEEPSEEK_API_KEY is present
 *
 * No raw field values are parsed or emitted here. This helper is for engineers/agents,
 * not for product decisions.
 */
import { readFileSync } from 'node:fs'
import { stdin as input } from 'node:process'
import { aggregateShadowLogs, deepseekWatchdogVerdict } from '@/lib/observability/shadowWatchdog'

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of input) chunks.push(Buffer.from(chunk))
  return Buffer.concat(chunks).toString('utf8')
}

async function main() {
  const file = process.argv[2]
  const logText = file ? readFileSync(file, 'utf8') : await readStdin()
  const aggregate = aggregateShadowLogs(logText)
  const deepseek = await deepseekWatchdogVerdict(aggregate)
  const out = {
    aggregate,
    ...(deepseek ? { deepseek_verdict: deepseek } : {}),
  }
  process.stdout.write(`${JSON.stringify(out, null, 2)}\n`)
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.stack || err.message : String(err)}\n`)
  process.exit(1)
})
