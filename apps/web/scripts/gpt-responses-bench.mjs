#!/usr/bin/env node
/**
 * gpt-responses-bench.mjs — adapter of gpt-model-bench.mjs for OpenAI *-pro / reasoning models
 * that are ONLY served on the /v1/responses endpoint (NOT /v1/chat/completions).
 * Same prompt, same GT-presence scoring, same A↔B variance probe, same PII discipline:
 * FULL real reads → gitignored qa-private/reports/; console prints PII-free matrix only.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dir = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(__dir, '../../..')
const env = existsSync(resolve(REPO, 'apps/web/.env.local')) ? readFileSync(resolve(REPO, 'apps/web/.env.local'), 'utf8') : ''
const KEY = (env.match(/^OPENAI_API_KEY=(.*)$/m)?.[1] || process.env.OPENAI_API_KEY || '').replace(/^["']|["']$/g, '').trim()
if (!KEY) { console.error('FATAL: no OPENAI_API_KEY in apps/web/.env.local'); process.exit(2) }

const MODELS = (process.env.BENCH_MODELS || 'gpt-5.5-pro').split(',').map((s) => s.trim()).filter(Boolean)
// FIX_DIR override lets us upload downscaled copies (OpenAI vision downsamples to ~1536px anyway,
// so 1600px copies are lossless for the model) to avoid undici UND_ERR_SOCKET on multi-MB payloads.
const FIX = process.env.FIX_DIR || resolve(REPO, 'test-fixtures/real-docs')
const GT = resolve(REPO, 'qa-private/ground-truth')
const DOCS = [
  { file: 'internal_passport_01.jpg', gt: 'internal_passport_01.json', kind: 'PRINTED+hw (passport)' },
  { file: 'military_id_p1_01.jpg', gt: 'military_id_p1_01.json', kind: 'PRINTED+hw (military ID)' },
  { file: 'birth_cert_handwritten_01.jpg', gt: 'birth_cert_handwritten_01.json', kind: 'HANDWRITTEN (birth cert)' },
]

const PROMPT = `You are an expert transcriber of Ukrainian/Russian official documents.
Transcribe EVERY line of text visible in this image EXACTLY as written, in the original
Cyrillic, line by line, top to bottom. Preserve names, dates, places, and numbers precisely.
If a word or character is illegible, write [?] — do NOT guess or invent anything.
Output ONLY the transcription (one document line per output line), nothing else.`

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function extractText(j) {
  if (typeof j?.output_text === 'string' && j.output_text) return j.output_text
  let out = ''
  for (const item of j?.output || []) {
    if (item?.type === 'message') for (const c of item.content || []) if (c?.type === 'output_text' && c.text) out += c.text
  }
  return out
}

async function gptResp(model, dataUrl, maxRetry = 4) {
  for (let attempt = 0; ; attempt++) {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 300000)
    const body = {
      model,
      input: [{ role: 'user', content: [{ type: 'input_text', text: PROMPT }, { type: 'input_image', image_url: dataUrl, detail: 'high' }] }],
      max_output_tokens: 16384,
    }
    try {
      const r = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST', signal: ctrl.signal,
        headers: { 'content-type': 'application/json', authorization: 'Bearer ' + KEY },
        body: JSON.stringify(body),
      })
      const j = await r.json()
      if (!r.ok) {
        const msg = j?.error?.message || `HTTP ${r.status}`
        const code = j?.error?.code || j?.error?.type || ''
        const transient = r.status === 429 || r.status >= 500
        if (transient && attempt < maxRetry) { clearTimeout(t); await sleep(Math.min(800 * 2 ** attempt, 10000) + Math.floor(Math.random() * 800)); continue }
        return { error: `${r.status} ${code} ${msg}`.slice(0, 160), retries: attempt }
      }
      const txt = extractText(j)
      return { text: (txt || '').trim(), finish: j?.status, incomplete: j?.incomplete_details?.reason || '', usage: j?.usage, retries: attempt }
    } catch (e) {
      // retry on abort (timeout) AND generic connection-level "fetch failed" (e.g. reset/EPIPE on large payloads)
      if (attempt < maxRetry) { clearTimeout(t); await sleep(1500 + Math.floor(Math.random() * 1000)); continue }
      return { error: e.name === 'AbortError' ? 'timeout(300s)' : `${e.message}${e.cause?.code ? ' / ' + e.cause.code : ''}`, retries: attempt }
    } finally { clearTimeout(t) }
  }
}

function similarity(a, b) {
  const norm = (s) => s.toLocaleLowerCase('uk').replace(/[^а-яіїєґё0-9]/gu, '')
  const x = norm(a), y = norm(b)
  if (!x && !y) return 1
  if (!x || !y) return 0
  const bg = (s) => { const m = new Map(); for (let i = 0; i < s.length - 1; i++) { const g = s.slice(i, i + 2); m.set(g, (m.get(g) || 0) + 1) } return m }
  const A = bg(x), B = bg(y); let inter = 0
  for (const [g, c] of A) if (B.has(g)) inter += Math.min(c, B.get(g))
  return (2 * inter) / ((x.length - 1) + (y.length - 1))
}
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
  const r = read.toLocaleLowerCase('uk')
  if (exp.label === 'dob') { const d = exp.value.replace(/\D/g, ''); return read.includes(d.slice(0, 4)) && (read.includes(d.slice(-2)) || read.includes(d.slice(-4, -2))) }
  const e = exp.value.toLocaleLowerCase('uk').replace(/['’ʼ`]/g, '')
  return r.replace(/['’ʼ`]/g, '').includes(e)
}

;(async () => {
  const runTag = (process.env.BENCH_TAG || 'resp').replace(/[^a-z0-9_.-]/gi, '')
  console.log(`GPT Responses-API bench — HONEST/CRITICAL — models: ${MODELS.join(', ')}\n`)
  const report = ['# GPT Responses-API Bench (real Cyrillic docs) — FULL (gitignored: real reads)', '', `Endpoint: /v1/responses · Models: ${MODELS.join(', ')}`, '']
  const matrix = []
  for (const doc of DOCS) {
    const p = resolve(FIX, doc.file)
    if (!existsSync(p)) { console.log('MISSING IMAGE', doc.file); continue }
    const g = existsSync(resolve(GT, doc.gt)) ? JSON.parse(readFileSync(resolve(GT, doc.gt), 'utf8')) : {}
    const expect = gtExpect(g)
    const dataUrl = `data:image/jpeg;base64,` + readFileSync(p).toString('base64')
    console.log(`\n==== ${doc.file} [${doc.kind}] — GT tokens: ${expect.map((e) => e.label).join(',') || '(none)'} ====`)
    report.push(`\n## ${doc.file} — ${doc.kind}\n`)
    for (const model of MODELS) {
      let a = await gptResp(model, dataUrl)
      await sleep(400)
      // retry once if refused / 1-line / empty
      const refusedRe = /i['’]?m sorry|can['’]?t assist|cannot assist|unable to|i can['’]?t help|won['’]?t be able/i
      const looksBad = (x) => !x.text || x.text.split('\n').filter(Boolean).length <= 1 || refusedRe.test(x.text)
      if (!a.error && looksBad(a)) { await sleep(600); const a2 = await gptResp(model, dataUrl); if (!a2.error && !looksBad(a2)) a = a2; else a._retried = true }
      const b = a.error ? { error: 'skipped' } : await gptResp(model, dataUrl)
      const sim = (a.text && b.text) ? similarity(a.text, b.text) : 0
      const lines = a.text ? a.text.split('\n').filter(Boolean).length : 0
      const refused = a.text ? refusedRe.test(a.text) : false
      const checks = a.text ? expect.map((e) => ({ label: e.label, ok: present(a.text, e) })) : []
      const gtHit = checks.length ? `${checks.filter((c) => c.ok).length}/${checks.length}` : 'n/a'
      const hw = doc.kind.startsWith('HANDWRITTEN')
      const fab = !a.text ? '' : hw ? (sim >= 0.75 ? 'stable' : sim >= 0.5 ? 'partly-unstable' : 'UNSTABLE/guessing') : (sim >= 0.85 ? 'stable' : 'some-variance')
      console.log(`  ${model.padEnd(16)} ${a.error ? 'ERR ' + a.error : `${refused ? 'REFUSED ' : ''}${lines}ln sim ${(sim * 100).toFixed(0)}% GT ${gtHit}${a.incomplete ? ' inc:' + a.incomplete : ''}${a.retries ? ` (retry ${a.retries})` : ''}`}`)
      matrix.push({ doc: doc.file.replace(/_01\.\w+$/, ''), model, avail: !a.error, refused, retries: a.retries ?? 0, lines, sim: a.text ? Math.round(sim * 100) : null, gt: gtHit, fab, err: a.error || '' })
      report.push(`### ${model}\n`)
      if (a.error) { report.push(`**UNAVAILABLE/ERR:** ${a.error} (after ${a.retries} retries)\n`); continue }
      report.push(`- status ${a.finish ?? '?'} · refused **${refused}** · A↔B sim **${(sim * 100).toFixed(0)}%** ${fab} · GT ${checks.map((c) => `${c.label}${c.ok ? '✓' : '✗'}`).join(' ')}${a.incomplete ? ` · incomplete:${a.incomplete}` : ''}`)
      report.push(`\n**Read @A:**\n\n\`\`\`\n${a.text.slice(0, 2500)}\n\`\`\`\n`)
      report.push(`**Read @B:**\n\n\`\`\`\n${(b.text || b.error || '').slice(0, 2500)}\n\`\`\`\n`)
    }
  }
  const outDir = resolve(REPO, 'qa-private/reports'); mkdirSync(outDir, { recursive: true })
  const out = resolve(outDir, `gpt-model-bench-${runTag}.md`); writeFileSync(out, report.join('\n'))
  console.log('\n===== VERDICT MATRIX (PII-free) =====')
  console.log('doc | model | avail | refused | retries | lines | A↔B sim | GT-hit | fabrication')
  for (const r of matrix) console.log(`${r.doc} | ${r.model} | ${r.avail ? 'OK' : 'BLOCKED'} | ${r.refused ? 'YES' : 'no'} | ${r.retries} | ${r.lines} | ${r.sim === null ? '-' : r.sim + '%'} | ${r.gt} | ${r.fab || r.err}`)
  console.log(`\n✓ FULL report (gitignored) → ${out}`)
})()
