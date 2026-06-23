#!/usr/bin/env node
/* stability-audit.mjs — MULTI-RUN honest stability audit of the FULL recognition pipeline on the
 * REAL owner documents. Runs each identity doc N times through readDocument (orient + read + tile
 * recovery), measures per-field VARIANCE ("качели"), orientation stability, recovery stability, and
 * scores the MAJORITY value vs owner GT — using the SAME verdict logic as gt-pipeline-bench.
 *
 * HONEST: a 429 or a non-primary (flash) read is recorded BLOCKED and excluded — never a fake number
 * (ADR-018). Default flags forced ON: CONTENT_ORIENT_ENABLED + HIRES_TILE_RECOVER_ENABLED. The tile
 * vote runs (TILE_VOTE_RUNS) control single-read vs K-vote — set =1 for baseline variance, =3 for the
 * stabilized run, and compare.
 *
 * Run from apps/web:
 *   STAB_RUNS=5 TILE_VOTE_RUNS=1 npx tsx --tsconfig tsconfig.json scripts/stability-audit.mjs
 *   STAB_RUNS=5 TILE_VOTE_RUNS=3 npx tsx --tsconfig tsconfig.json scripts/stability-audit.mjs
 */
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import crypto from 'node:crypto'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
for (const f of ['.env.local', 'apps/web/.env.local']) {
  try { const t = await readFile(path.join(ROOT, f), 'utf8'); for (const l of t.split('\n')) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '') } } catch {}
}
// Measure ONLY orient + tile recovery; delete the other paid re-read stages so they don't contaminate.
process.env.CONTENT_ORIENT_ENABLED = '1'
process.env.HIRES_TILE_RECOVER_ENABLED = '1'
for (const k of ['ANTI_FABRICATION_GATE_ENABLED', 'SELF_CONSISTENCY_GATE_ENABLED', 'SELF_CONSISTENCY_VOTE_ENABLED', 'AUTO_DELIVERY_CONSENSUS_ENABLED', 'DOC_SCRIPT_ROUTING_ENABLED', 'SMART_NORMALIZE_ENABLED']) delete process.env[k]

const N = Math.max(1, Number(process.env.STAB_RUNS) || 5)
const MAX_CALLS = Number(process.env.STAB_MAX_CALLS) || 200
let callsUsed = 0

const { readDocument } = await import(path.join(ROOT, 'apps/web/src/lib/docintel/documentFieldReader.ts'))
const { preprocessImage } = await import(path.join(ROOT, 'apps/web/src/lib/ocr/image-preprocess.ts'))
const { primaryGeminiModel } = await import(path.join(ROOT, 'apps/web/src/lib/docintel/providers/geminiVisionProvider.ts'))
const { detectUprightCw } = await import(path.join(ROOT, 'apps/web/src/lib/docintel/orientation/detectOrientation.ts'))
const { getGeminiApiKey } = await import(path.join(ROOT, 'apps/web/src/lib/gemini/apiKey.ts'))
const { normalizeForCompare } = await import(path.join(ROOT, 'apps/web/src/lib/docintel/selfConsistency.ts'))
const PRIMARY = primaryGeminiModel()
const KEY = getGeminiApiKey()

// ── scoring (verbatim from gt-pipeline-bench.mjs) ─────────────────────────────
const apos = (s) => (s ?? '').toString().replace(/['’ʼ`]/g, "'")
const collapse = (s) => apos((s ?? '').toString().trim().replace(/\s+/g, ' '))
const normLatin = (s) => collapse(s).toLowerCase()
const isEmpty = (s) => collapse(s) === ''
const canonicalSex = (s) => { const v = collapse(s).toLowerCase(); if (/^(m|male|чол|муж|ч)$/.test(v) || v.startsWith('чолов') || v.startsWith('мужск')) return 'm'; if (/^(f|female|жін|жен|ж)$/.test(v) || v.startsWith('жіноч') || v.startsWith('женск')) return 'f'; return v }
const canonicalDate = (s) => { const str = (s ?? '').toString(); let m = str.match(/(\d{4})-(\d{2})-(\d{2})/); if (m) return `${m[1]}-${m[2]}-${m[3]}`; m = str.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/); if (m) return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`; return null }
function classify(expected, got, kind, field = '') {
  const gtEmpty = isEmpty(expected), readEmpty = isEmpty(got)
  if (gtEmpty && readEmpty) return 'CORRECT_EMPTY'
  if (gtEmpty && !readEmpty) return 'FABRICATED'
  if (!gtEmpty && readEmpty) return 'MISS'
  if (field === 'sex') return canonicalSex(expected) === canonicalSex(got) ? 'CORRECT' : 'WRONG'
  if (field === 'dob' || /(_date|date_)/.test(field)) { const ed = canonicalDate(expected), gd = canonicalDate(got); if (ed && gd) return ed === gd ? 'CORRECT' : 'WRONG' }
  const norm = kind === 'latin' ? normLatin : collapse
  return norm(expected) === norm(got) ? 'CORRECT' : 'WRONG'
}
const PERSON = (p = '') => ({ [`${p}family_name`]: { latin: 'family_name_latin', cyr: 'family_name_cyrillic' }, [`${p}given_name`]: { latin: 'given_name_latin', cyr: 'given_name_cyrillic' }, [`${p}patronymic`]: { latin: 'patronymic_latin', cyr: 'patronymic_cyrillic' } })
const FIELD_MAP_BY_DOC = {
  ua_internal_passport_booklet: { ...PERSON(), dob: { latin: 'date_of_birth' }, sex: { latin: 'sex' } },
  ua_military_id: { ...PERSON(), dob: { latin: 'date_of_birth' }, sex: { latin: 'sex' } },
  ua_birth_certificate: { ...PERSON('child_'), dob: { latin: 'date_of_birth' }, sex: { latin: 'sex' } },
}
let DOCS = [
  { img: 'internal_passport_kuropiatnyk.jpg', gt: 'internal_passport_kuropiatnyk.json', docTypeId: 'ua_internal_passport_booklet', key: 'passport' },
  { img: 'military_id_p1_kuropiatnyk.jpg', gt: 'military_id_p1_kuropiatnyk.json', docTypeId: 'ua_military_id', key: 'military' },
  { img: 'birth_cert_handwritten_kuropiatnyk.jpg', gt: 'birth_cert_handwritten_kuropiatnyk.json', docTypeId: 'ua_birth_certificate', key: 'birth' },
]
if (process.env.STAB_DOC) DOCS = DOCS.filter((d) => d.key === process.env.STAB_DOC)
const sha6 = (s) => crypto.createHash('sha256').update(s).digest('hex').slice(0, 6)

console.log(`=== STABILITY AUDIT — N=${N} runs/doc · model ${PRIMARY} · TILE_VOTE_RUNS=${process.env.TILE_VOTE_RUNS || '3(default)'} ===`)
console.log(`est. cost ≤ ${DOCS.length} docs × ${N} × ~(1 orient + 1 read + up-to-2 tiles×vote) calls × $0.002 — cap ${MAX_CALLS} calls\n`)

const overall = { scored: 0, correct: 0, instability: [] }

for (const d of DOCS) {
  const raw = await readFile(path.join(ROOT, 'test-fixtures/real-docs', d.img))
  const gt = JSON.parse(await readFile(path.join(ROOT, 'qa-private/ground-truth', d.gt), 'utf8'))
  const verified = new Set(gt._meta?.owner_verified_fields ?? [])
  const map = FIELD_MAP_BY_DOC[d.docTypeId]
  const pre = await preprocessImage(raw, 'image/jpeg')
  const baseBuf = pre.ok ? pre.buffer : raw
  const mime = pre.ok ? pre.mimeType : 'image/jpeg'

  const runs = [] // each: { blocked, orient, fields:{routeField:{latin,cyr}}, recovered:Set }
  for (let i = 0; i < N; i++) {
    if (callsUsed >= MAX_CALLS) { runs.push({ blocked: 'cost_cap' }); continue }
    // orientation (1 call) — separate so we can measure orientation stability
    let orient = null
    try { orient = await detectUprightCw(baseBuf, KEY, PRIMARY); callsUsed++ } catch { orient = 'ERR' }
    let r
    try { r = await readDocument(baseBuf, mime, d.docTypeId, { attemptsPerModel: 1, timeoutMs: 85_000, originalBuffer: raw }); callsUsed += 3 }
    catch (e) { runs.push({ blocked: 'threw' }); continue }
    if (!r.ok) { runs.push({ blocked: r.status || 'not_ok' }); continue }
    if (r.model !== PRIMARY) { runs.push({ blocked: `fallback:${r.model}` }); continue }
    const fields = {}, recovered = new Set()
    for (const f of r.fields ?? []) {
      fields[f.field] = { latin: f.value ?? '', cyr: f.raw_cyrillic ?? '' }
      if ((f.review_reasons ?? []).includes('hires_tile_recovered')) recovered.add(f.field)
    }
    runs.push({ blocked: null, orient: orient ?? 0, fields, recovered })
  }

  const okRuns = runs.filter((x) => !x.blocked)
  const blocked = runs.length - okRuns.length
  // orientation stability
  const orientSet = new Set(okRuns.map((x) => String(x.orient)))
  // recovery stability (sorted recovered-keys token per run)
  const recTokens = okRuns.map((x) => [...x.recovered].sort().join(','))
  const recSet = new Set(recTokens)
  const recFreq = {}
  for (const x of okRuns) for (const k of x.recovered) recFreq[k] = (recFreq[k] ?? 0) + 1

  console.log(`## ${d.docTypeId}  (${okRuns.length} ok / ${blocked} blocked)`)
  if (blocked) console.log(`   BLOCKED runs: ${runs.filter(x=>x.blocked).map(x=>x.blocked).join(', ')}`)
  console.log(`   orient: ${orientSet.size === 1 ? 'STABLE ' + [...orientSet][0] + '°' : 'UNSTABLE ' + [...orientSet].map(o=>o+'°').join('/')}`)
  if (Object.keys(recFreq).length) console.log(`   recovery: ${recSet.size === 1 ? 'STABLE' : 'UNSTABLE'} — ${Object.entries(recFreq).map(([k,c])=>`${k} ${c}/${okRuns.length}`).join(' · ')}`)
  if (!orientSet.size || orientSet.size > 1) overall.instability.push(`${d.docTypeId}.orient: ${[...orientSet].join('/')}`)
  if (recSet.size > 1) overall.instability.push(`${d.docTypeId}.recovery unstable: ${Object.entries(recFreq).map(([k,c])=>`${k} ${c}/${okRuns.length}`).join(', ')}`)

  // per-field stability + majority verdict
  console.log(`   | field | ch | majority verdict | stability | distinct |`)
  for (const [routeField, gtKeys] of Object.entries(map)) {
    for (const ch of ['cyr', 'latin']) {
      const gtKey = gtKeys[ch]
      if (!gtKey || !verified.has(gtKey)) continue
      const expected = gt[gtKey]
      if (isEmpty(expected)) continue
      // collect per-run released value for this channel
      const vals = okRuns.map((x) => (x.fields[routeField]?.[ch] ?? ''))
      const fold = ch === 'cyr' ? ((s) => normalizeForCompare(s || '')) : normLatin
      const hist = new Map()
      for (const v of vals) { const t = fold(v); const e = hist.get(t) ?? { count: 0, raws: new Map() }; e.count++; e.raws.set(v, (e.raws.get(v) ?? 0) + 1); hist.set(t, e) }
      let bestTok = null, bestCount = 0
      for (const [t, e] of hist) if (e.count > bestCount) { bestCount = e.count; bestTok = t }
      const stability = okRuns.length ? bestCount / okRuns.length : 0
      const distinct = new Set(vals.map(fold)).size
      // majority raw value
      let majRaw = ''
      if (bestTok != null) { let bc = 0; for (const [raw, c] of hist.get(bestTok).raws) if (c > bc) { bc = c; majRaw = raw } }
      const verdict = classify(expected, majRaw, ch, routeField)
      if (['CORRECT', 'WRONG', 'MISS', 'FABRICATED'].includes(verdict)) { overall.scored++; if (verdict === 'CORRECT') overall.correct++ }
      const mark = verdict === 'CORRECT' ? '✓' : verdict === 'CORRECT_EMPTY' ? '·' : '✗'
      const kachели = distinct > 1 ? ` ⚠ ${[...new Set(vals.map(fold))].map((t)=> (t?sha6(t):'∅')).join('/')}` : ''
      console.log(`   | ${routeField} | ${ch} | ${mark} ${verdict} | ${bestCount}/${okRuns.length} | ${distinct}${kachели} |`)
      if (distinct > 1) overall.instability.push(`${d.docTypeId}.${routeField}(${ch}): ${distinct} distinct over ${okRuns.length} (stab ${stability.toFixed(2)})`)
    }
  }
  console.log('')
}

console.log('## OVERALL')
console.log(`accuracy@majority: ${overall.correct}/${overall.scored} = ${overall.scored ? (100*overall.correct/overall.scored).toFixed(1) : '0'}%`)
console.log(`INSTABILITY LIST (${overall.instability.length}):`)
for (const x of overall.instability) console.log(`  - ${x}`)
console.log(`\nVERDICT: ${overall.instability.length === 0 ? 'STABLE — every scored field + orient + recovery consistent across runs' : 'UNSTABLE — see instability list above'}`)
console.log(`(calls used ≈ ${callsUsed})`)
