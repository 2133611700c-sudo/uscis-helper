#!/usr/bin/env node
/* LIVE end-to-end validation of the WIRED STAGE 4: call readDocument with HIRES_TILE_RECOVER_ENABLED=1
 * + originalBuffer (raw). The recovery must run INSIDE readDocument and fill the empties. */
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
for (const f of ['.env.local', 'apps/web/.env.local']) {
  try { const t = await readFile(path.join(ROOT, f), 'utf8'); for (const l of t.split('\n')) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '') } } catch {}
}
process.env.HIRES_TILE_RECOVER_ENABLED = '1' // turn the wired path ON for this validation
delete process.env.ANTI_FABRICATION_GATE_ENABLED
delete process.env.SELF_CONSISTENCY_VOTE_ENABLED

const { readDocument } = await import(path.join(ROOT, 'apps/web/src/lib/docintel/documentFieldReader.ts'))
const { preprocessImage } = await import(path.join(ROOT, 'apps/web/src/lib/ocr/image-preprocess.ts'))

const raw = await readFile(path.join(ROOT, 'test-fixtures/real-docs/birth_cert_handwritten_kuropiatnyk.jpg'))
const pre = await preprocessImage(raw, 'image/jpeg')
const baseBuf = pre.ok ? pre.buffer : raw
console.log('reading birth cert through readDocument (flag ON, originalBuffer=raw)...')
const r = await readDocument(baseBuf, pre.ok ? pre.mimeType : 'image/jpeg', 'ua_birth_certificate', {
  attemptsPerModel: 1, timeoutMs: 85_000, originalBuffer: raw,
})
console.log(`ok=${r.ok} model=${r.model} status=${r.status}`)
for (const k of ['father_full_name', 'mother_full_name', 'certificate_series_number', 'issuing_authority', 'dob', 'child_given_name']) {
  const f = (r.fields ?? []).find((x) => x.field === k)
  if (f) console.log(`  ${k}: value="${f.value ?? ''}" cyr="${f.raw_cyrillic ?? ''}" review=${f.review_required} reasons=${(f.review_reasons ?? []).join('|')}`)
}
console.log('GT: father Куропятник Сергей Леонидович | mother Наталья Степановна | series III-АМ № 428069')
