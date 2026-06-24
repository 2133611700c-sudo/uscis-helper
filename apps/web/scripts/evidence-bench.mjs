#!/usr/bin/env node
/* evidence-bench.mjs — STAGE-ISOLATED evidence. Answers ONE question with proof: does the model
 * VISUALLY read the Cyrillic, separate from transport/preprocess/schema/normalization/scorer?
 *
 * Method (per the independent-auditor brief):
 *   - send ORIGINAL bytes, inline, FREE raw-transcription prompt (no schema, no asserted type) = Pass 1.
 *   - EVIDENCE ENVELOPE per call: source/submitted sha+dims+mime+bytes, transport, model_requested vs
 *     model_RETURNED, api request id, http_status, finish_reason, tokens, latency.
 *   - CHANNEL-SPLIT scorer: for each name field score the raw-Cyrillic form AND the official-Latin form
 *     SEPARATELY (so "GT=ШЕВЧЕНКО, model=SHEVCHENKO" is a LATIN hit, NOT a Cyrillic miss).
 *   - FAILURE TAXONOMY: SUCCESS / PROVIDER_TIMEOUT / MODEL_REFUSAL / PROVIDER_5XX / PROVIDER_RATE_LIMIT /
 *     RAW_TRANSCRIPTION_ERROR — a timeout/refusal is NEVER scored as OCR=0.
 * PII: full transcription + envelope → gitignored qa-private; console = PII-free.
 *   BENCH_MODELS=gemini-2.5-pro,gpt-4.1 npx tsx --tsconfig tsconfig.json scripts/evidence-bench.mjs
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
const isGem = (m) => /^gemini/.test(m)
const isReason = (m) => /^o[0-9]|gpt-5/.test(m)
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex').slice(0, 16)

const FREE = `Transcribe EVERY visible character EXACTLY as shown, in the original script (Ukrainian Cyrillic, Russian Cyrillic, Latin, digits, punctuation, apostrophes, MRZ). Do NOT translate, do NOT transliterate, do NOT normalize, do NOT correct, do NOT infer. For uncertain characters use [?]. Output ONLY the raw transcription, line by line.`

const DOCS = [
  { img: 'internal_passport_01.jpg', gt: 'internal_passport_01.json', key: 'passport' },
  { img: 'military_id_p1_01.jpg', gt: 'military_id_p1_01.json', key: 'military' },
  { img: 'birth_cert_handwritten_01.jpg', gt: 'birth_cert_handwritten_01.json', key: 'birth' },
]
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const fold = (s) => (s || '').toLocaleLowerCase('uk').replace(/['’ʼ`\s]/g, '')

// channel-split GT: raw cyrillic forms + official latin forms (+ dob digits)
function channels(g) {
  const cyr = [], lat = []
  for (const base of ['family_name', 'given_name', 'patronymic', 'child_family_name', 'child_given_name', 'child_patronymic']) {
    const c = g[base + '_cyrillic'], l = g[base + '_latin']
    if (typeof c === 'string' && c.trim().length > 1) cyr.push(c.trim())
    if (typeof l === 'string' && l.trim().length > 1) lat.push(l.trim())
  }
  const dob = typeof g.date_of_birth === 'string' ? g.date_of_birth.replace(/\D/g, '') : ''
  return { cyr, lat, dob }
}
const hitList = (text, list) => list.filter((v) => fold(text).includes(fold(v))).length
const refused = (t) => /i'?m sorry|can'?t assist|cannot assist|unable to (?:help|assist|process)/i.test(t || '')

async function callGemini(model, b64, mime) {
  const t0 = Date.now()
  const body = { contents: [{ parts: [{ text: FREE }, { inline_data: { mime_type: mime, data: b64 } }] }],
    generationConfig: { temperature: 0, media_resolution: 'MEDIA_RESOLUTION_HIGH', maxOutputTokens: 16384 } }
  const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 120000)
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GKEY}`, { method: 'POST', signal: ctrl.signal, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    const reqId = r.headers.get('x-request-id') || ''
    const j = await r.json(); clearTimeout(timer)
    const env2 = { http: r.status, model_returned: j?.modelVersion || '', finish: j?.candidates?.[0]?.finishReason || '', in_tok: j?.usageMetadata?.promptTokenCount ?? 0, out_tok: j?.usageMetadata?.candidatesTokenCount ?? 0, req_id: j?.responseId || reqId, ms: Date.now() - t0 }
    if (!r.ok) return { env: env2, tax: r.status === 429 ? 'PROVIDER_RATE_LIMIT' : r.status >= 500 ? 'PROVIDER_5XX' : 'RAW_TRANSCRIPTION_ERROR', err: j?.error?.status || `HTTP ${r.status}` }
    return { env: env2, text: j?.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join('') ?? '' }
  } catch (e) { clearTimeout(timer); return { env: { ms: Date.now() - t0 }, tax: e.name === 'AbortError' ? 'PROVIDER_TIMEOUT' : 'RAW_TRANSCRIPTION_ERROR', err: e.message } }
}
async function callOpenAI(model, b64, mime) {
  const t0 = Date.now()
  const body = { model, messages: [{ role: 'user', content: [{ type: 'text', text: FREE }, { type: 'image_url', image_url: { url: `data:${mime};base64,${b64}`, detail: 'high' } }] }] }
  if (isReason(model)) body.max_completion_tokens = 16384; else { body.max_tokens = 16384; body.temperature = 0 }
  const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 120000)
  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', signal: ctrl.signal, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + OKEY }, body: JSON.stringify(body) })
    const reqId = r.headers.get('x-request-id') || ''
    const j = await r.json(); clearTimeout(timer)
    const env2 = { http: r.status, model_returned: j?.model || '', finish: j?.choices?.[0]?.finish_reason || '', in_tok: j?.usage?.prompt_tokens ?? 0, out_tok: j?.usage?.completion_tokens ?? 0, req_id: j?.id || reqId, ms: Date.now() - t0 }
    if (!r.ok) return { env: env2, tax: r.status === 429 ? 'PROVIDER_RATE_LIMIT' : r.status >= 500 ? 'PROVIDER_5XX' : 'RAW_TRANSCRIPTION_ERROR', err: j?.error?.code || `HTTP ${r.status}` }
    return { env: env2, text: j?.choices?.[0]?.message?.content ?? '' }
  } catch (e) { clearTimeout(timer); return { env: { ms: Date.now() - t0 }, tax: e.name === 'AbortError' ? 'PROVIDER_TIMEOUT' : 'RAW_TRANSCRIPTION_ERROR', err: e.message } }
}

const report = ['# Evidence bench — Pass-1 raw transcription, channel-split + envelope (gitignored)', '']
const matrix = []
for (const model of MODELS) {
  console.log(`\n######## ${model} ########`)
  for (const d of DOCS) {
    const raw = await readFile(path.join(ROOT, 'test-fixtures/real-docs', d.img))
    const gt = JSON.parse(await readFile(path.join(ROOT, 'qa-private/ground-truth', d.gt), 'utf8'))
    const ch = channels(gt)
    const meta = await sharp(raw).metadata()
    const b64 = raw.toString('base64')
    const res = isGem(model) ? await callGemini(model, b64, 'image/jpeg') : await callOpenAI(model, b64, 'image/jpeg')
    await sleep(300)
    const text = res.text || ''
    let tax = res.tax || (refused(text) ? 'MODEL_REFUSAL' : 'SUCCESS')
    // channel-split recall on the RAW transcription
    const cyrR = ch.cyr.length ? `${hitList(text, ch.cyr)}/${ch.cyr.length}` : 'n/a'
    const latR = ch.lat.length ? `${hitList(text, ch.lat)}/${ch.lat.length}` : 'n/a'
    const dobHit = ch.dob ? (text.includes(ch.dob.slice(0, 4)) && (text.includes(ch.dob.slice(-2)) || text.includes(ch.dob.slice(-4, -2))) ? 'Y' : 'N') : '-'
    const envS = `model_ret=${res.env?.model_returned || '?'} http=${res.env?.http ?? '-'} finish=${res.env?.finish || '-'} out_tok=${res.env?.out_tok ?? '-'} ${res.env?.ms}ms req=${(res.env?.req_id || '').slice(0, 12)}`
    console.log(`  ${d.key.padEnd(9)} ${tax.padEnd(18)} CYR ${cyrR}  LAT ${latR}  DOB ${dobHit}  | ${envS}`)
    matrix.push({ model, doc: d.key, tax, cyr: cyrR, lat: latR, dob: dobHit, env: res.env })
    report.push(`## ${model} · ${d.key}\n- taxonomy: ${tax} · CYR ${cyrR} · LAT ${latR} · DOB ${dobHit}\n- envelope: source_sha=${sha(raw)} dims=${meta.width}x${meta.height} bytes=${raw.length} transport=inline · ${JSON.stringify(res.env)}\n\n**Raw transcription:**\n\n\`\`\`\n${(text || res.err || '').slice(0, 2500)}\n\`\`\`\n`)
  }
}
await mkdir(path.join(ROOT, 'qa-private/reports'), { recursive: true })
await writeFile(path.join(ROOT, 'qa-private/reports', `evidence-${process.env.BENCH_TAG || 'run'}.md`), report.join('\n'))
console.log('\n===== EVIDENCE MATRIX (PII-free) — does the model SEE the Cyrillic? =====')
console.log('model | doc | taxonomy | CYR-recall (raw chan) | LAT-recall | DOB | model_returned | finish')
for (const r of matrix) console.log(`${r.model} | ${r.doc} | ${r.tax} | ${r.cyr} | ${r.lat} | ${r.dob} | ${r.env?.model_returned || '?'} | ${r.env?.finish || '-'}`)
console.log(`\n✓ full+envelope → qa-private/reports/evidence-${process.env.BENCH_TAG || 'run'}.md`)
