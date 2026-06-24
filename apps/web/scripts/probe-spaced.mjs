#!/usr/bin/env node
/* Clean, SPACED probe to separate NETWORK/rate-limit from genuine model variance. No burst: one
 * orientation detect every GAP seconds on the birth cert. If answers flip 0/270 with NO errors →
 * genuine VLM variance. If they error/503/timeout → it was the network/rate-limit. */
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
for (const f of ['.env.local', 'apps/web/.env.local']) {
  try { const t = await readFile(path.join(ROOT, f), 'utf8'); for (const l of t.split('\n')) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '') } } catch {}
}
const { detectUprightCw } = await import(path.join(ROOT, 'apps/web/src/lib/docintel/orientation/detectOrientation.ts'))
const { preprocessImage } = await import(path.join(ROOT, 'apps/web/src/lib/ocr/image-preprocess.ts'))
const { primaryGeminiModel } = await import(path.join(ROOT, 'apps/web/src/lib/docintel/providers/geminiVisionProvider.ts'))
const { getGeminiApiKey } = await import(path.join(ROOT, 'apps/web/src/lib/gemini/apiKey.ts'))
const KEY = getGeminiApiKey(), MODEL = primaryGeminiModel()
const GAP = Number(process.env.GAP) || 8
const RUNS = Number(process.env.PROBE_RUNS) || 6

const raw = await readFile(path.join(ROOT, 'test-fixtures/real-docs/birth_cert_handwritten_01.jpg'))
const pre = await preprocessImage(raw, 'image/jpeg')
const buf = pre.ok ? pre.buffer : raw
console.log(`SPACED orientation probe — birth cert · ${RUNS} detects · ${GAP}s apart · model ${MODEL}`)
const results = []
for (let i = 0; i < RUNS; i++) {
  const t0 = Date.now()
  let r
  try { r = await detectUprightCw(buf, KEY, MODEL) } catch (e) { r = 'THREW:' + (e?.cause?.code ?? e?.message) }
  const ms = Date.now() - t0
  console.log(`  #${i + 1}: ${r === null ? 'null(undecidable/err)' : r + '°'}  (${ms}ms)`)
  results.push(r)
  if (i < RUNS - 1) await new Promise((res) => setTimeout(res, GAP * 1000))
}
const valid = results.filter((r) => r === 0 || r === 90 || r === 180 || r === 270)
const distinct = new Set(valid.map(String))
console.log(`\nvalid detects: ${valid.length}/${RUNS} · distinct angles: ${[...distinct].map(a=>a+'°').join('/') || 'none'}`)
console.log(distinct.size > 1
  ? 'VERDICT: GENUINE MODEL VARIANCE — the detector returns different VALID angles with no errors (not a network problem).'
  : valid.length < RUNS
    ? 'VERDICT: NETWORK/RATE-LIMIT involved — some calls errored/were undecidable.'
    : `VERDICT: STABLE this pass — all ${RUNS} agree at ${[...distinct][0]}° (earlier flip may have been load/network).`)
