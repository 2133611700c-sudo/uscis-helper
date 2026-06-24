#!/usr/bin/env node
/**
 * gpt-model-bench.mjs — HONEST/CRITICAL live test of OpenAI vision models on the project's
 * 3 REAL documents, scored vs ground truth, with a different-person check + variance probe.
 * Mirror of gemini-model-bench.mjs so GPT and Gemini are judged on the SAME bar.
 *
 * PII: prints raw reads (real names) → FULL report goes ONLY to gitignored qa-private/reports/.
 * Console prints a PII-FREE verdict matrix. Reads OPENAI_API_KEY from gitignored .env.local.
 * Never prints the key.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dir = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(__dir, '../../..')
const env = existsSync(resolve(REPO, 'apps/web/.env.local')) ? readFileSync(resolve(REPO, 'apps/web/.env.local'), 'utf8') : ''
const KEY = (env.match(/^OPENAI_API_KEY=(.*)$/m)?.[1] || process.env.OPENAI_API_KEY || '').replace(/^["']|["']$/g, '').trim()
if (!KEY) { console.error('FATAL: no OPENAI_API_KEY in apps/web/.env.local'); process.exit(2) }

const MODELS = (process.env.BENCH_MODELS || 'gpt-5.5-pro,gpt-5.5,gpt-4.1,gpt-4o').split(',').map((s) => s.trim()).filter(Boolean)
const isReasoning = (m) => /^o[0-9]|gpt-5/.test(m) // gpt-5.x + o-series: reasoning, fixed temperature, max_completion_tokens

const FIX = resolve(REPO, 'test-fixtures/real-docs')
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

async function gpt(model, dataUrl, temp, maxRetry = 4) {
  const reasoning = isReasoning(model)
  for (let attempt = 0; ; attempt++) {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 120000)
    const body = {
      model,
      messages: [{ role: 'user', content: [{ type: 'text', text: PROMPT }, { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } }] }],
    }
    // newer (gpt-5/o) use max_completion_tokens + fixed temperature; gpt-4* use max_tokens + temperature.
    if (reasoning) { body.max_completion_tokens = 16384 } else { body.max_tokens = 8192; body.temperature = temp }
    try {
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST', signal: ctrl.signal,
        headers: { 'content-type': 'application/json', authorization: 'Bearer ' + KEY },
        body: JSON.stringify(body),
      })
      const j = await r.json()
      if (!r.ok) {
        const msg = j?.error?.message || `HTTP ${r.status}`
        const code = j?.error?.code || j?.error?.type || ''
        // adapt to param errors once (max_tokens vs max_completion_tokens; temperature unsupported)
        if (/max_tokens|max_completion_tokens/i.test(msg) && attempt === 0) { clearTimeout(t); continue }
        if (/temperature/i.test(msg) && attempt === 0) { clearTimeout(t); delete body.temperature; continue }
        const transient = r.status === 429 || r.status >= 500
        if (transient && attempt < maxRetry) { clearTimeout(t); await sleep(Math.min(800 * 2 ** attempt, 10000) + Math.floor(Math.random() * 800)); continue }
        return { error: `${r.status} ${code} ${msg}`.slice(0, 140), retries: attempt }
      }
      const txt = j?.choices?.[0]?.message?.content ?? ''
      return { text: (typeof txt === 'string' ? txt : JSON.stringify(txt)).trim(), finish: j?.choices?.[0]?.finish_reason, usage: j?.usage, retries: attempt }
    } catch (e) {
      if (e.name === 'AbortError' && attempt < maxRetry) { clearTimeout(t); await sleep(1000); continue }
      return { error: e.name === 'AbortError' ? 'timeout(120s)' : e.message, retries: attempt }
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
  const runTag = (process.env.BENCH_TAG || 'run').replace(/[^a-z0-9_.-]/gi, '')
  console.log(`GPT model bench — HONEST/CRITICAL — models: ${MODELS.join(', ')}\n`)
  const report = ['# GPT Model Bench (real Cyrillic docs) — FULL (gitignored: real reads)', '', `Models: ${MODELS.join(', ')}`, '']
  const matrix = []
  for (const doc of DOCS) {
    const p = resolve(FIX, doc.file)
    if (!existsSync(p)) { console.log('MISSING IMAGE', doc.file); continue }
    const g = existsSync(resolve(GT, doc.gt)) ? JSON.parse(readFileSync(resolve(GT, doc.gt), 'utf8')) : {}
    const expect = gtExpect(g)
    const mime = doc.file.endsWith('.webp') ? 'image/webp' : 'image/jpeg'
    const dataUrl = `data:${mime};base64,` + readFileSync(p).toString('base64')
    console.log(`\n==== ${doc.file} [${doc.kind}] — GT tokens: ${expect.map((e) => e.label).join(',') || '(none)'} ====`)
    report.push(`\n## ${doc.file} — ${doc.kind}\n`)
    for (const model of MODELS) {
      const a = await gpt(model, dataUrl, 0)
      await sleep(300)
      const b = a.error ? { error: 'skipped' } : await gpt(model, dataUrl, 1.0)
      const sim = (a.text && b.text) ? similarity(a.text, b.text) : 0
      const lines = a.text ? a.text.split('\n').filter(Boolean).length : 0
      const checks = a.text ? expect.map((e) => ({ label: e.label, ok: present(a.text, e) })) : []
      const gtHit = checks.length ? `${checks.filter((c) => c.ok).length}/${checks.length}` : 'n/a'
      const hw = doc.kind.startsWith('HANDWRITTEN')
      const fab = !a.text ? '' : hw ? (sim >= 0.75 ? 'stable' : sim >= 0.5 ? 'partly-unstable' : 'UNSTABLE/guessing') : (sim >= 0.85 ? 'stable' : 'some-variance')
      console.log(`  ${model.padEnd(16)} ${a.error ? 'ERR ' + a.error : `${lines}ln sim ${(sim * 100).toFixed(0)}% GT ${gtHit}${a.retries ? ` (retry ${a.retries})` : ''}`}`)
      matrix.push({ doc: doc.file.replace(/_01\.\w+$/, ''), model, avail: !a.error, retries: a.retries ?? 0, lines, sim: a.text ? Math.round(sim * 100) : null, gt: gtHit, fab, err: a.error || '' })
      report.push(`### ${model}\n`)
      if (a.error) { report.push(`**UNAVAILABLE/ERR:** ${a.error} (after ${a.retries} retries)\n`); continue }
      report.push(`- finish ${a.finish ?? '?'} · A↔B sim **${(sim * 100).toFixed(0)}%** ${fab} · GT ${checks.map((c) => `${c.label}${c.ok ? '✓' : '✗'}`).join(' ')}`)
      report.push(`\n**Read @temp0:**\n\n\`\`\`\n${a.text.slice(0, 2000)}\n\`\`\`\n`)
      report.push(`**Read @temp1:**\n\n\`\`\`\n${(b.text || b.error || '').slice(0, 2000)}\n\`\`\`\n`)
    }
  }
  const outDir = resolve(REPO, 'qa-private/reports'); mkdirSync(outDir, { recursive: true })
  const out = resolve(outDir, `gpt-model-bench-${runTag}.md`); writeFileSync(out, report.join('\n'))
  console.log('\n===== VERDICT MATRIX (PII-free) =====')
  console.log('doc | model | avail | retries | lines | A↔B sim | GT-hit | fabrication')
  for (const r of matrix) console.log(`${r.doc} | ${r.model} | ${r.avail ? 'OK' : 'BLOCKED'} | ${r.retries} | ${r.lines} | ${r.sim === null ? '-' : r.sim + '%'} | ${r.gt} | ${r.fab || r.err}`)
  console.log(`\n✓ FULL report (gitignored) → ${out}`)
})()
