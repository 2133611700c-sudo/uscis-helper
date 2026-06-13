/**
 * liveRealDocs — REAL extraction against the owner's REAL documents + the live
 * Gemini API. NOT a CI test: it only runs when RUN_LIVE_DOCS=1 and a key is set.
 * Loads the key from apps/web/.env.local. Prints the canonical fields so we can
 * see exactly what the pipeline produces on a real document.
 */
import { it, expect } from 'vitest'
import { readFileSync, existsSync, writeFileSync, appendFileSync } from 'node:fs'
import path from 'node:path'
import { readDocument } from '../documentFieldReader'

const OUT = '/tmp/live-results.txt'
const log = (s: string) => appendFileSync(OUT, s + '\n')

const ROOT = path.resolve(__dirname, '../../../../../..')
const DOCS = path.join(ROOT, 'qa-shots/private')

// Load GEMINI_API_KEY* from apps/web/.env.local into process.env.
function loadEnv() {
  const envPath = path.join(ROOT, 'apps/web/.env.local')
  if (!existsSync(envPath)) return
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
  }
}

const RUN = process.env.RUN_LIVE_DOCS === '1'

const CASES: Array<{ file: string; docType: string }> = [
  // His international (biometric) passport — verify SERGII (controlling Latin) +
  // Vinnytsia Oblast (place) + Male (sex).
  { file: 'Passport Sergii REDACTED .jpg', docType: 'ua_international_passport' },
]

it.runIf(RUN)('LIVE: extract owner real docs', async () => {
  loadEnv()
  writeFileSync(OUT, `KEY len: ${(process.env.GEMINI_API_KEY ?? '').length}\n`)
  for (const c of CASES) {
    const p = path.join(DOCS, c.file)
    if (!existsSync(p)) { log('MISSING ' + c.file); continue }
    const buf = readFileSync(p)
    const res = await readDocument(buf, 'image/jpeg', c.docType, { timeoutMs: 85_000, attemptsPerModel: 1, product: 'translation' })
    log(`\n===== ${c.file} (${c.docType}) =====`)
    log(`ok: ${res.ok} status: ${res.status} ms: ${res.ms} model: ${(res as any).model ?? ''}`)
    for (const f of res.fields ?? []) {
      log(`  ${f.field}: "${(f as any).normalized_value ?? (f as any).value ?? ''}"  | raw_cyr: "${(f as any).raw_cyrillic ?? ''}" | review: ${(f as any).review_required}`)
    }
  }
  expect(true).toBe(true)
}, 180_000)
