#!/usr/bin/env node
/* FRUGAL live 3-reader comparison — Gemini (pipeline) vs DeepSeek (text) vs GT, on REAL docs.
 * Hard cost cap: attemptsPerModel=1 (exactly 1 attempt per model); if the PRIMARY model is not
 * the one that answered, the read is marked BLOCKED and NOT scored (ADR-018 — never report a
 * flash read as acceptance). Run with: DOC=passport node apps/web/scripts/test-three-readers.mjs
 * (DOC ∈ passport|military|birth). Claude's own image read is recorded separately by me. */
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
for (const f of ['.env.local', 'apps/web/.env.local']) {
  try {
    const txt = await readFile(path.join(ROOT, f), 'utf8')
    for (const line of txt.split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  } catch {}
}
// Safety: do NOT let re-read gates fire extra Gemini calls.
delete process.env.ANTI_FABRICATION_GATE_ENABLED
delete process.env.SELF_CONSISTENCY_VOTE_ENABLED

const DOCS = {
  passport: { img: 'internal_passport_kuropiatnyk.jpg', gt: 'internal_passport_kuropiatnyk.json', docType: 'ua_international_passport' },
  military: { img: 'military_id_p1_kuropiatnyk.jpg', gt: 'military_id_p1_kuropiatnyk.json', docType: 'ua_military_id' },
  birth: { img: 'birth_cert_handwritten_kuropiatnyk.jpg', gt: 'birth_cert_handwritten_kuropiatnyk.json', docType: 'ua_birth_certificate' },
}
const which = process.env.DOC || 'passport'
const cfg = DOCS[which]
if (!cfg) { console.error('DOC must be one of', Object.keys(DOCS)); process.exit(1) }

const { readDocument } = await import(path.join(ROOT, 'apps/web/src/lib/docintel/documentFieldReader.ts'))
const { primaryGeminiModel } = await import(path.join(ROOT, 'apps/web/src/lib/docintel/providers/geminiVisionProvider.ts'))
const { preprocessImage } = await import(path.join(ROOT, 'apps/web/src/lib/ocr/image-preprocess.ts'))
const { autoOrient } = await import(path.join(ROOT, 'apps/web/src/lib/docintel/orientation/autoOrient.ts'))
const { orientToUpright } = await import(path.join(ROOT, 'apps/web/src/lib/docintel/orientation/detectOrientation.ts'))
const { getGeminiApiKey } = await import(path.join(ROOT, 'apps/web/src/lib/gemini/apiKey.ts'))

let imageBuffer = await readFile(path.join(ROOT, 'test-fixtures/real-docs', cfg.img))
let mime = 'image/jpeg'
// Mirror the PROD route: downscale huge images (CORE_PREPROCESS) before the Gemini call so we
// test the same payload prod sends (a raw 6.7MB image deadlines; prod sends ≤2048px).
const pre = await preprocessImage(imageBuffer, mime)
if (pre.ok) {
  console.log(`preprocess: ${imageBuffer.length} bytes → ${pre.buffer.length} bytes (${pre.width}x${pre.height}, scale ${pre.scaleFactor.toFixed(2)})`)
  imageBuffer = pre.buffer; mime = pre.mimeType
} else {
  console.log(`preprocess skipped: ${pre.code}`)
}
const gt = JSON.parse(await readFile(path.join(ROOT, 'qa-private/ground-truth', cfg.gt), 'utf8'))
const PRIMARY = primaryGeminiModel()

console.log(`=== 3-READER LIVE TEST — doc=${which} (${cfg.docType}) primary=${PRIMARY} ===\n`)

// DUAL TEST (ORIENT=1): how the system ROTATES a sideways doc (autoOrient detect+rotate) AND how
// recognition changes once it is upright. The birth cert + military are photographed sideways.
if (process.env.ORIENT === '1') {
  const key = getGeminiApiKey()
  const o = await autoOrient(imageBuffer, key, PRIMARY)
  console.log(`AUTO-ORIENT(old): applied=${o.applied}° iterations=${o.iterations}`)
  imageBuffer = o.buffer
}
if (process.env.CORIENT === '1') {
  const key = getGeminiApiKey()
  const o = await orientToUpright(imageBuffer, key, PRIMARY)
  console.log(`CONTENT-ORIENT(grid): applied=${o.applied}° detected=${o.detected} (${o.applied === 0 ? 'already upright' : 'rotated to upright'})`)
  imageBuffer = o.buffer
}

const t0 = Date.now()
let g
try {
  g = await readDocument(imageBuffer, mime, cfg.docType, { attemptsPerModel: 1, timeoutMs: 85_000, product: 'tps' })
} catch (e) {
  console.error('readDocument threw:', e?.message ?? e); process.exit(2)
}
console.log(`GEMINI: ok=${g.ok} model=${g.model || '(none)'} status=${g.status || ''} ms=${Date.now() - t0} fields=${g.fields?.length ?? 0}`)
const usedPrimary = g.model === PRIMARY
if (!usedPrimary) console.log(`  ⚠ NOT primary model (${g.model}) → BLOCKED for acceptance (ADR-018); read shown for debug only`)

// Print Gemini fields (raw cyrillic + value)
const gByKey = {}
for (const f of g.fields ?? []) {
  gByKey[f.field] = f
  console.log(`  [G] ${f.field}: value="${f.value ?? ''}" cyr="${f.cyrillic ?? f.raw_cyrillic ?? ''}" review=${f.review_required ?? f.can_read === false}`)
}

// GT (owner-verified only)
console.log('\nGROUND TRUTH (owner-verified):')
const verified = gt._meta?.owner_verified_fields ?? Object.keys(gt).filter(k => !k.startsWith('_'))
for (const k of verified) if (gt[k]) console.log(`  [GT] ${k}: ${gt[k]}`)

console.log('\n(Claude image read + DeepSeek text leg recorded separately.)')
console.log(`\nCOST NOTE: Gemini calls this run = ${usedPrimary ? 1 : '>1 (fallback fired)'}`)
