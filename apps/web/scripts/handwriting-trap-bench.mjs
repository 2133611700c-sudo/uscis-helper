#!/usr/bin/env node
/* handwriting-trap-bench.mjs — adversarial handwriting test on the birth certificate, with TRAPS that
 * expose fabrication (don't trust a single "it read it"). Per model:
 *   TRAP 1 — BLANK CONTROL: send a blank white image with the same prompt. A model that returns a
 *            non-empty name INVENTS a person from nothing → any "read" it gives is untrustworthy.
 *   TRAP 2 — CONSISTENCY: 3 reads of the SAME handwritten cert. Different surnames across runs =
 *            fabrication (the model guesses a new fake person each time).
 *   TRAP 3 — GT channel match: does any run match the TRUE person (Cyrillic or Latin channel)?
 *   TRAP 4 — TARGETED CROP: crop the child-name region and read it — does cropping rescue handwriting?
 * Focused prompt asks ONLY child family/given/patronymic + says empty-beats-wrong, so runs are comparable.
 * PII: prints only HASHES + booleans (no names). Full reads → gitignored qa-private.
 *   BENCH_MODELS=gemini-2.5-pro,gpt-4.1,gpt-5.4 npx tsx --tsconfig tsconfig.json scripts/handwriting-trap-bench.mjs
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import crypto from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const env = await readFile(path.join(ROOT, 'apps/web/.env.local'), 'utf8').catch(() => '')
const get = (k) => (env.match(new RegExp('^' + k + '=(.*)$', 'm'))?.[1] || process.env[k] || '').replace(/^["']|["']$/g, '').trim()
const GKEY = get('GEMINI_API_KEY_PAY') || get('GEMINI_API_KEY')
const OKEY = get('OPENAI_API_KEY')
const MODELS = (process.env.BENCH_MODELS || 'gemini-2.5-pro,gpt-4.1').split(',').map((s) => s.trim()).filter(Boolean)
const RUNS = Math.max(1, Number(process.env.TRAP_RUNS) || 3)
const isGem = (m) => /^gemini/.test(m)
const isReason = (m) => /^o[0-9]|gpt-5/.test(m)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const fold = (s) => (s || '').toLocaleLowerCase('uk').replace(/['’ʼ`\s.\-]/g, '')
const sha6 = (s) => s ? crypto.createHash('sha256').update(fold(s)).digest('hex').slice(0, 6) : '∅'

const PROMPT = `This is a Ukrainian/Soviet birth certificate. Read the CHILD's surname, given name, and patronymic EXACTLY as written, in the original Cyrillic. If a field is illegible, faded, or NOT present, return "" for it. Do NOT guess, do NOT invent, do NOT infer a typical name — an EMPTY value is correct and far better than a wrong one. Output ONLY JSON: {"family":"","given":"","patronymic":""}`

function parseJson(t) { try { return JSON.parse(String(t).replace(/^\s*```(?:json)?/i, '').replace(/```\s*$/i, '').trim()) } catch { return null } }

async function gem(model, b64, mime) {
  const body = { contents: [{ parts: [{ text: PROMPT }, { inline_data: { mime_type: mime, data: b64 } }] }], generationConfig: { temperature: 0, media_resolution: 'MEDIA_RESOLUTION_HIGH', maxOutputTokens: 8192, response_mime_type: 'application/json' } }
  for (let a = 0; a < 3; a++) { const c = new AbortController(); const t = setTimeout(() => c.abort(), 120000)
    try { const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GKEY}`, { method: 'POST', signal: c.signal, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); const j = await r.json(); clearTimeout(t)
      if (!r.ok) { if ((r.status === 503 || r.status >= 500) && a < 2) { await sleep(900 * 2 ** a); continue } return { err: `${r.status} ${j?.error?.status || ''}` } }
      return { text: j?.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join('') ?? '' }
    } catch (e) { clearTimeout(t); if (a < 2) { await sleep(900); continue } return { err: e.name === 'AbortError' ? 'timeout' : e.message } } }
  return { err: 'exhausted' }
}
async function oai(model, b64, mime) {
  const body = { model, messages: [{ role: 'user', content: [{ type: 'text', text: PROMPT }, { type: 'image_url', image_url: { url: `data:${mime};base64,${b64}`, detail: 'high' } }] }], response_format: { type: 'json_object' } }
  if (isReason(model)) body.max_completion_tokens = 8192; else { body.max_tokens = 4096; body.temperature = 0 }
  for (let a = 0; a < 3; a++) { const c = new AbortController(); const t = setTimeout(() => c.abort(), 120000)
    try { const r = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', signal: c.signal, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + OKEY }, body: JSON.stringify(body) }); const j = await r.json(); clearTimeout(t)
      if (!r.ok) { if ((r.status === 429 || r.status >= 500) && a < 2) { await sleep(900 * 2 ** a); continue } return { err: `${r.status} ${j?.error?.code || ''}` } }
      return { text: j?.choices?.[0]?.message?.content ?? '' }
    } catch (e) { clearTimeout(t); if (a < 2) { await sleep(900); continue } return { err: e.name === 'AbortError' ? 'timeout' : e.message } } }
  return { err: 'exhausted' }
}
const call = (m, b64, mime) => isGem(m) ? gem(m, b64, mime) : oai(m, b64, mime)
const famOf = (res) => { const o = parseJson(res.text); return res.err ? { err: res.err } : { fam: (o?.family || '').trim(), given: (o?.given || '').trim() } }

// inputs
const cert = await readFile(path.join(ROOT, 'test-fixtures/real-docs/birth_cert_handwritten_01.jpg'))
const meta = await sharp(cert).metadata()
const certB64 = cert.toString('base64')
// blank control
const blankB64 = (await sharp({ create: { width: 1240, height: 1750, channels: 3, background: { r: 252, g: 251, b: 248 } } }).jpeg().toBuffer()).toString('base64')
// targeted crop of the child-name region (upper-left block of this cert)
const cx = Math.round(meta.width * 0.04), cy = Math.round(meta.height * 0.11), cw = Math.round(meta.width * 0.52), chh = Math.round(meta.height * 0.30)
const cropB64 = (await sharp(cert).extract({ left: cx, top: cy, width: cw, height: chh }).jpeg({ quality: 95 }).toBuffer()).toString('base64')
// GT child family
const gt = JSON.parse(await readFile(path.join(ROOT, 'qa-private/ground-truth/birth_cert_handwritten_01.json'), 'utf8'))
const gtFamCyr = gt.child_family_name_cyrillic || gt.family_name_cyrillic || ''
const gtFamLat = gt.child_family_name_latin || gt.family_name_latin || ''
const gtHash = sha6(gtFamCyr)
const matchesGT = (fam) => !!fam && (fold(fam) === fold(gtFamCyr) || fold(fam) === fold(gtFamLat))

const report = ['# Handwriting trap bench — birth certificate (gitignored: real reads)', '', `GT family hash=${gtHash}`, '']
const matrix = []
for (const model of MODELS) {
  console.log(`\n######## ${model} ########`)
  // TRAP 2: consistency — RUNS reads of the full cert
  const runs = []
  for (let i = 0; i < RUNS; i++) { const r = famOf(await call(model, certB64, 'image/jpeg')); runs.push(r); await sleep(300) }
  const okRuns = runs.filter((r) => !r.err)
  const famHashes = okRuns.map((r) => sha6(r.fam))
  const distinct = new Set(famHashes).size
  const anyGT = okRuns.some((r) => matchesGT(r.fam))
  // TRAP 1: blank control
  const blank = famOf(await call(model, blankB64, 'image/jpeg')); await sleep(300)
  const blankInvents = !blank.err && !!blank.fam // returned a name on a BLANK image = invents
  // TRAP 4: targeted crop
  const crop = famOf(await call(model, cropB64, 'image/jpeg')); await sleep(300)
  const cropGT = !crop.err && matchesGT(crop.fam)

  const verdict = anyGT ? (distinct === 1 ? 'READS (consistent, matches GT)' : 'PARTIAL (matched GT in some runs)')
    : blankInvents ? 'FABRICATES (invents on a BLANK image)'
    : distinct > 1 ? 'FABRICATES (different fake person each run)'
    : okRuns.length === 0 ? 'BLOCKED (no successful run)'
    : 'WRONG-STABLE (same wrong/empty every run)'
  console.log(`  consistency: ${famHashes.join('/')} (distinct ${distinct}/${okRuns.length}) · matchesGT ${anyGT ? 'Y' : 'N'}`)
  console.log(`  TRAP blank-control: ${blank.err ? 'err:' + blank.err : blankInvents ? '⚠ INVENTED a name on BLANK (hash ' + sha6(blank.fam) + ')' : 'correctly empty'}`)
  console.log(`  TRAP crop: ${crop.err ? 'err:' + crop.err : 'hash ' + sha6(crop.fam) + (cropGT ? ' ✓matchesGT' : ' ✗')}`)
  console.log(`  ⇒ VERDICT: ${verdict}`)
  matrix.push({ model, distinct, okRuns: okRuns.length, anyGT, blankInvents, cropGT, verdict, famHashes })
  report.push(`## ${model}\n- consistency hashes: ${famHashes.join(', ')} (distinct ${distinct}); matchesGT=${anyGT}\n- blank-control invents=${blankInvents} (hash ${sha6(blank.fam)}); crop matchesGT=${cropGT}\n- VERDICT: ${verdict}\n- raw: runs=${JSON.stringify(runs)} blank=${JSON.stringify(blank)} crop=${JSON.stringify(crop)}\n`)
}
// TRAP 3 cross-model: do models AGREE on the cert person?
const allHashes = matrix.flatMap((m) => m.famHashes).filter((h) => h !== '∅')
const crossDistinct = new Set(allHashes).size
await mkdir(path.join(ROOT, 'qa-private/reports'), { recursive: true })
await writeFile(path.join(ROOT, 'qa-private/reports', `handwriting-trap-${process.env.BENCH_TAG || 'run'}.md`), report.join('\n'))
console.log('\n===== TRAP MATRIX (PII-free) =====')
console.log('model | runs ok | distinct-people | matchesGT | blank-invents | crop-matchesGT | verdict')
for (const m of matrix) console.log(`${m.model} | ${m.okRuns} | ${m.distinct} | ${m.anyGT ? 'Y' : 'N'} | ${m.blankInvents ? '⚠Y' : 'n'} | ${m.cropGT ? 'Y' : 'n'} | ${m.verdict}`)
console.log(`\nCROSS-MODEL agreement on the cert person: ${crossDistinct} distinct surnames across all models' runs (GT hash ${gtHash}).`)
console.log(crossDistinct > 1 && !matrix.some((m) => m.anyGT) ? '⇒ models DISAGREE and none match GT → collective fabrication on handwriting.' : '')
console.log(`✓ full → qa-private/reports/handwriting-trap-${process.env.BENCH_TAG || 'run'}.md`)
