#!/usr/bin/env node
/* ablation-bench.mjs — the DECISIVE A/B matrix: is our recall loss caused by the IMAGE we send
 * or by the PROMPT/SCHEMA we impose? For each doc, 2×2:
 *   IMAGE  = { original bytes , our preprocessed bytes }
 *   PROMPT = { FREE "transcribe everything" (no schema) , our STRUCTURED buildPrompt + schema }
 * Same model, same media_resolution(HIGH)/detail(high) held constant, so only image×prompt vary.
 * Metric = GT-presence recall (loose, case/apostrophe-folded, RU/UA tolerant — "did the true tokens
 * appear in what the model produced"). PII: full text → gitignored qa-private; console = PII-free.
 *
 * Run from apps/web:  BENCH_MODELS=gemini-2.5-pro,gpt-5.4 npx tsx --tsconfig tsconfig.json scripts/ablation-bench.mjs
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const env = await readFile(path.join(ROOT, 'apps/web/.env.local'), 'utf8').catch(() => '')
const get = (k) => (env.match(new RegExp('^' + k + '=(.*)$', 'm'))?.[1] || process.env[k] || '').replace(/^["']|["']$/g, '').trim()
const GKEY = get('GEMINI_API_KEY_PAY') || get('GEMINI_API_KEY')
const OKEY = get('OPENAI_API_KEY')

const { buildPrompt, buildResponseSchema } = await import(path.join(ROOT, 'apps/web/src/lib/docintel/providers/geminiVisionProvider.ts'))
const { getDocTypeSpec } = await import(path.join(ROOT, 'apps/web/src/lib/docintel/documentRegistry.ts'))
const { preprocessImage } = await import(path.join(ROOT, 'apps/web/src/lib/ocr/image-preprocess.ts'))

const MODELS = (process.env.BENCH_MODELS || 'gemini-2.5-pro,gpt-5.4').split(',').map((s) => s.trim()).filter(Boolean)
const isGem = (m) => /^gemini/.test(m)
const isReason = (m) => /^o[0-9]|gpt-5/.test(m)
const FREE = `Transcribe EVERY line of text visible in this image EXACTLY as written, in the original Cyrillic, line by line. Preserve names, dates, places, numbers, MRZ precisely. If illegible write [?]; do NOT invent. Output ONLY the transcription.`

const DOCS = [
  { img: 'internal_passport_01.jpg', gt: 'internal_passport_01.json', docTypeId: 'ua_international_passport', key: 'passport' },
  { img: 'military_id_p1_01.jpg', gt: 'military_id_p1_01.json', docTypeId: 'ua_military_id', key: 'military' },
  { img: 'birth_cert_handwritten_01.jpg', gt: 'birth_cert_handwritten_01.json', docTypeId: 'ua_birth_certificate', key: 'birth' },
]
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function gtExpect(g) {
  const out = []
  for (const k of ['family_name_cyrillic', 'given_name_cyrillic', 'patronymic_cyrillic', 'child_family_name_cyrillic', 'child_given_name_cyrillic', 'child_patronymic_cyrillic']) {
    const v = g?.[k]; if (typeof v === 'string' && v.trim().length > 1) out.push({ label: k.replace(/_cyrillic$/, ''), value: v.trim() })
  }
  const dob = g?.date_of_birth; if (typeof dob === 'string' && dob.trim()) out.push({ label: 'dob', value: dob.trim() })
  return out
}
function present(read, exp) {
  if (!read) return false
  const r = read.toLocaleLowerCase('uk').replace(/['’ʼ`]/g, '')
  if (exp.label === 'dob') { const d = exp.value.replace(/\D/g, ''); return read.includes(d.slice(0, 4)) && (read.includes(d.slice(-2)) || read.includes(d.slice(-4, -2))) }
  return r.includes(exp.value.toLocaleLowerCase('uk').replace(/['’ʼ`]/g, ''))
}
const refused = (t) => /i'm sorry|can't assist|cannot assist|unable to/i.test(t || '')

async function callGemini(model, b64, mime, prompt, schema) {
  const body = { contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mime, data: b64 } }] }],
    generationConfig: { temperature: 0, media_resolution: 'MEDIA_RESOLUTION_HIGH', maxOutputTokens: 16384,
      ...(schema ? { response_mime_type: 'application/json', response_schema: schema } : {}) } }
  for (let a = 0; a < 4; a++) {
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 120000)
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GKEY}`, { method: 'POST', signal: ctrl.signal, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      const j = await r.json(); clearTimeout(t)
      if (!r.ok) { const st = r.status, rpc = j?.error?.status || ''; if ((st === 503 || st >= 500 || (st === 429 && !/RESOURCE_EXHAUSTED|QUOTA/.test(rpc))) && a < 3) { await sleep(800 * 2 ** a); continue } return { err: `${st} ${rpc}` } }
      return { text: j?.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join('') ?? '' }
    } catch (e) { clearTimeout(t); if (a < 3) { await sleep(800); continue } return { err: e.name === 'AbortError' ? 'timeout' : e.message } }
  }
  return { err: 'exhausted' }
}
async function callOpenAI(model, b64, mime, prompt, json) {
  const body = { model, messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: `data:${mime};base64,${b64}`, detail: 'high' } }] }] }
  if (isReason(model)) body.max_completion_tokens = 16384; else { body.max_tokens = 16384; body.temperature = 0 }
  if (json) body.response_format = { type: 'json_object' }
  for (let a = 0; a < 4; a++) {
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 120000)
    try {
      const r = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', signal: ctrl.signal, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + OKEY }, body: JSON.stringify(body) })
      const j = await r.json(); clearTimeout(t)
      if (!r.ok) { if ((r.status === 429 || r.status >= 500) && a < 3) { await sleep(800 * 2 ** a); continue } return { err: `${r.status} ${j?.error?.code || ''}` } }
      return { text: j?.choices?.[0]?.message?.content ?? '' }
    } catch (e) { clearTimeout(t); if (a < 3) { await sleep(800); continue } return { err: e.name === 'AbortError' ? 'timeout' : e.message } }
  }
  return { err: 'exhausted' }
}

const report = ['# Ablation matrix — image × prompt (FULL, gitignored)', '']
const matrix = []
for (const model of MODELS) {
  console.log(`\n######## ${model} ########`)
  for (const d of DOCS) {
    const raw = await readFile(path.join(ROOT, 'test-fixtures/real-docs', d.img))
    const gt = JSON.parse(await readFile(path.join(ROOT, 'qa-private/ground-truth', d.gt), 'utf8'))
    const expect = gtExpect(gt)
    const spec = getDocTypeSpec(d.docTypeId)
    const pre = await preprocessImage(raw, 'image/jpeg')
    const images = { orig: { b: raw.toString('base64'), m: 'image/jpeg' }, pre: { b: (pre.ok ? pre.buffer : raw).toString('base64'), m: pre.ok ? pre.mimeType : 'image/jpeg' } }
    const prompts = { free: { p: FREE, schema: null }, struct: { p: buildPrompt(spec), schema: buildResponseSchema(spec) } }
    for (const [imgK, img] of Object.entries(images)) {
      for (const [prK, pr] of Object.entries(prompts)) {
        const res = isGem(model)
          ? await callGemini(model, img.b, img.m, pr.p, pr.schema)
          : await callOpenAI(model, img.b, img.m, pr.p, !!pr.schema)
        await sleep(250)
        let text = res.text || ''
        // for structured JSON, flatten all string values so GT-presence is comparable to free text
        if (pr.schema && text) { try { const o = JSON.parse(text.replace(/^\s*```(?:json)?/i, '').replace(/```\s*$/i, '')); text = JSON.stringify(o) } catch {} }
        const hit = expect.length ? expect.filter((e) => present(text, e)).length : 0
        const rec = expect.length ? Math.round((100 * hit) / expect.length) : 0
        const status = res.err ? `ERR ${res.err}` : refused(text) ? 'REFUSED' : `${hit}/${expect.length}=${rec}%`
        console.log(`  ${d.key.padEnd(9)} ${imgK}/${prK.padEnd(6)} ${status}`)
        matrix.push({ model, doc: d.key, image: imgK, prompt: prK, rec: res.err ? null : rec, status })
        report.push(`## ${model} · ${d.key} · ${imgK} · ${prK}\n- ${status}\n\n\`\`\`\n${(text || res.err || '').slice(0, 1500)}\n\`\`\`\n`)
      }
    }
  }
}
await mkdir(path.join(ROOT, 'qa-private/reports'), { recursive: true })
await writeFile(path.join(ROOT, 'qa-private/reports', `ablation-${(process.env.BENCH_TAG || 'run')}.md`), report.join('\n'))
console.log('\n===== ABLATION MATRIX (PII-free, GT-recall %) =====')
console.log('model | doc | orig/free | orig/struct | pre/free | pre/struct')
const byMD = {}
for (const r of matrix) { (byMD[r.model + '|' + r.doc] ||= {})[r.image + '/' + r.prompt] = r.status }
for (const [k, v] of Object.entries(byMD)) console.log(`${k} | ${v['orig/free'] || '-'} | ${v['orig/struct'] || '-'} | ${v['pre/free'] || '-'} | ${v['pre/struct'] || '-'}`)
console.log(`\n✓ full → qa-private/reports/ablation-${(process.env.BENCH_TAG || 'run')}.md`)
