#!/usr/bin/env node
/**
 * gemini-model-bench.mjs — HONEST, CRITICAL accuracy + availability bench of EVERY Gemini
 * vision model on the project's REAL Cyrillic documents. Re-runnable; raw output, no spin.
 *
 * For each model × doc:
 *   - run A @ temp 0   → the model's primary read
 *   - run B @ temp 1.0 → variance probe; LOW A↔B similarity on a handwritten doc = the model
 *                        is GUESSING (fabrication); HIGH = stable read.
 *   - GT CHECK (critical): is each ground-truth name token PRESENT in the read? Absent surname
 *     + a different surname present = the "different-person" bug (why 2.5-flash was disqualified).
 *   - AVAILABILITY: 503/timeout/quota recorded honestly (this is the owner's core concern with
 *     the preview primary). Bounded exponential backoff on 503 — never an infinite loop.
 *
 * PII: this prints raw reads (real names) — so the FULL report is written ONLY to gitignored
 * qa-private/reports/. The console prints a PII-FREE verdict matrix (✓/✗ + percentages).
 * Uses the PAID key (GEMINI_API_KEY_PAY) — the bare GEMINI_API_KEY is the dead free tier that
 * cannot call the 3.x previews. Never prints keys.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dir = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(__dir, '../../..')
const env = existsSync(resolve(REPO, 'apps/web/.env.local')) ? readFileSync(resolve(REPO, 'apps/web/.env.local'), 'utf8') : ''
const envGet = (k) => (env.match(new RegExp('^' + k + '=(.*)$', 'm'))?.[1] || process.env[k] || '').replace(/^["']|["']$/g, '').trim()
const KEY = envGet('GEMINI_API_KEY_PAY') || envGet('GEMINI_API_KEY')
if (!KEY) { console.error('FATAL: no GEMINI_API_KEY_PAY / GEMINI_API_KEY in apps/web/.env.local'); process.exit(2) }

// FULL matrix — the whole point is to test them ALL, honestly, side by side.
const MODELS = (process.env.BENCH_MODELS || [
  'gemini-2.5-pro',         // current primary
  'gemini-3.5-flash',       // GA flash
  'gemini-2.5-flash',       // GA flash (DISQUALIFIED for certs in prod — verify the bug here)
  'gemini-2.5-flash-lite',  // GA flash-lite
].join(',')).split(',').map((s) => s.trim()).filter(Boolean)

const FIX = resolve(REPO, 'test-fixtures/real-docs')
const GT = resolve(REPO, 'qa-private/ground-truth')
// Real docs (gitignored) + their GT (gitignored). docType drives nothing here; we transcribe full text.
const DOCS = [
  { file: 'internal_passport_01.jpg', gt: 'internal_passport_01.json', kind: 'PRINTED+hw (passport booklet)' },
  { file: 'military_id_p1_01.jpg', gt: 'military_id_p1_01.json', kind: 'PRINTED+hw (military ID)' },
  { file: 'birth_cert_handwritten_01.jpg', gt: 'birth_cert_handwritten_01.json', kind: 'HANDWRITTEN (birth cert)' },
]

const PROMPT = `You are an expert transcriber of Ukrainian/Russian official documents.
Transcribe EVERY line of text visible in this image EXACTLY as written, in the original
Cyrillic, line by line, top to bottom. Preserve names, dates, places, and numbers precisely.
If a word or character is illegible, write [?] — do NOT guess or invent anything.
Output ONLY the transcription (one document line per output line), nothing else.`

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Bounded exponential backoff on 503/UNAVAILABLE (mirrors the production fix). Honest: after
// the budget is spent, return the error — never loop forever on a degraded preview window.
async function gem(model, b64, mime, temp, maxRetry = 4) {
  for (let attempt = 0; ; attempt++) {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 90000)
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${KEY}`, {
        method: 'POST', signal: ctrl.signal, headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: PROMPT }, { inline_data: { mime_type: mime, data: b64 } }] }],
          generationConfig: { temperature: temp, maxOutputTokens: Number(process.env.BENCH_MAX_TOKENS) || 8192 },
        }),
      })
      const j = await r.json()
      const rpc = j?.error?.status || ''
      const transient = r.status === 503 || (r.status >= 500) || (r.status === 429 && !/RESOURCE_EXHAUSTED|QUOTA/.test(rpc))
      if (transient && attempt < maxRetry) {
        clearTimeout(t)
        await sleep(Math.min(700 * 2 ** attempt, 8000) + Math.floor(Math.random() * 700))
        continue
      }
      if (!r.ok) return { error: `${r.status} ${rpc}`.trim(), retries: attempt }
      const cand = j?.candidates?.[0]
      const txt = cand?.content?.parts?.map((p) => p.text).filter(Boolean).join('') ?? ''
      return { text: txt.trim(), usage: j?.usageMetadata, finish: cand?.finishReason, retries: attempt }
    } catch (e) {
      if (e.name === 'AbortError' && attempt < maxRetry) { clearTimeout(t); await sleep(1000); continue }
      return { error: e.name === 'AbortError' ? 'timeout(90s)' : e.message, retries: attempt }
    } finally { clearTimeout(t) }
  }
}

// crude char-level bigram-Dice similarity (0..1) on normalized Cyrillic
function similarity(a, b) {
  const norm = (s) => s.toLocaleLowerCase('uk').replace(/[^а-яіїєґё0-9]/gu, '')
  const x = norm(a), y = norm(b)
  if (!x && !y) return 1
  if (!x || !y) return 0
  const bg = (s) => { const m = new Map(); for (let i = 0; i < s.length - 1; i++) { const g = s.slice(i, i + 2); m.set(g, (m.get(g) || 0) + 1) } return m }
  const A = bg(x), B = bg(y)
  let inter = 0
  for (const [g, c] of A) if (B.has(g)) inter += Math.min(c, B.get(g))
  return (2 * inter) / ((x.length - 1) + (y.length - 1))
}

// Pull the GT's expected Cyrillic name tokens + dob for a presence check.
function gtExpect(gtObj) {
  const out = []
  const keys = ['family_name_cyrillic', 'given_name_cyrillic', 'patronymic_cyrillic',
    'child_family_name_cyrillic', 'child_given_name_cyrillic', 'child_patronymic_cyrillic']
  for (const k of keys) {
    const v = gtObj?.[k]
    if (typeof v === 'string' && v.trim().length > 1) out.push({ label: k.replace(/_cyrillic$/, ''), value: v.trim() })
  }
  const dob = gtObj?.date_of_birth
  if (typeof dob === 'string' && dob.trim()) out.push({ label: 'dob', value: dob.trim() })
  return out
}

// Presence: is the expected token (loosely) in the read? Cyrillic case-insensitive substring;
// dates checked by digit-run match (handles dd.mm.yyyy vs yyyy-mm-dd).
function present(read, exp) {
  if (!read) return false
  const r = read.toLocaleLowerCase('uk')
  if (exp.label === 'dob') {
    const digs = exp.value.replace(/\D/g, '')
    const day = digs.slice(-2), mon = digs.slice(-4, -2), yr = digs.slice(0, 4)
    return read.includes(yr) && (read.includes(day) || read.includes(mon))
  }
  return r.includes(exp.value.toLocaleLowerCase('uk').replace(/['’ʼ`]/g, "'")) ||
         r.replace(/['’ʼ`]/g, '').includes(exp.value.toLocaleLowerCase('uk').replace(/['’ʼ`]/g, ''))
}

;(async () => {
  const runTag = (process.env.BENCH_TAG || 'run').replace(/[^a-z0-9_-]/gi, '')
  console.log(`Gemini model bench — HONEST/CRITICAL — models: ${MODELS.join(', ')}\n`)
  const report = ['# Gemini Model Bench (real Cyrillic docs) — FULL (gitignored: contains real reads)', '',
    `Models: ${MODELS.join(', ')}`, '', 'A@temp0 / B@temp1 variance · GT-presence check · bounded 503 backoff.', '']
  const matrix = [] // PII-free rows for console

  for (const doc of DOCS) {
    const p = resolve(FIX, doc.file)
    if (!existsSync(p)) { console.log('MISSING IMAGE', doc.file); continue }
    const gtPath = resolve(GT, doc.gt)
    const gtObj = existsSync(gtPath) ? JSON.parse(readFileSync(gtPath, 'utf8')) : {}
    const expect = gtExpect(gtObj)
    const b64 = readFileSync(p).toString('base64')
    const mime = doc.file.endsWith('.webp') ? 'image/webp' : 'image/jpeg'
    console.log(`\n==== ${doc.file} [${doc.kind}] — GT tokens: ${expect.map((e) => e.label).join(',') || '(none)'} ====`)
    report.push(`\n## ${doc.file} — ${doc.kind}\n`)

    for (const model of MODELS) {
      const a = await gem(model, b64, mime, 0)
      await sleep(250)
      const b = a.error ? { error: 'skipped(A failed)' } : await gem(model, b64, mime, 1.0)
      const sim = (a.text && b.text) ? similarity(a.text, b.text) : 0
      const lines = a.text ? a.text.split('\n').filter(Boolean).length : 0
      const checks = a.text ? expect.map((e) => ({ label: e.label, ok: present(a.text, e) })) : []
      const gtHit = checks.length ? `${checks.filter((c) => c.ok).length}/${checks.length}` : 'n/a'
      const handwritten = doc.kind.startsWith('HANDWRITTEN')
      const fabFlag = !a.text ? '' : handwritten ? (sim >= 0.75 ? 'stable' : sim >= 0.5 ? 'partly-unstable' : 'UNSTABLE/guessing') : (sim >= 0.85 ? 'stable' : 'some-variance')
      const status = a.error ? `ERR ${a.error}` : `${lines}ln sim ${(sim * 100).toFixed(0)}% GT ${gtHit}${a.retries ? ` (retries ${a.retries})` : ''}`
      console.log(`  ${model.padEnd(26)} ${status}`)
      matrix.push({ doc: doc.file.replace(/_01\.\w+$/, ''), model, avail: !a.error, retries: a.retries ?? 0, lines, sim: a.text ? Math.round(sim * 100) : null, gt: gtHit, fab: fabFlag, err: a.error || '' })

      report.push(`### ${model}\n`)
      if (a.error) { report.push(`**UNAVAILABLE:** ${a.error} (after ${a.retries} retries)\n`); continue }
      report.push(`- availability: OK (${a.retries} backoff retries) · finish ${a.finish ?? '?'} · A↔B sim **${(sim * 100).toFixed(0)}%** ${fabFlag}`)
      report.push(`- GT presence: ${checks.map((c) => `${c.label}${c.ok ? '✓' : '✗'}`).join(' ') || 'n/a'}`)
      report.push(`\n**Read @temp0:**\n\n\`\`\`\n${a.text.slice(0, 2000)}\n\`\`\`\n`)
      report.push(`**Read @temp1:**\n\n\`\`\`\n${(b.text || b.error || '').slice(0, 2000)}\n\`\`\`\n`)
    }
  }

  // FULL report (real reads) → gitignored qa-private only.
  const outDir = resolve(REPO, 'qa-private/reports')
  mkdirSync(outDir, { recursive: true })
  const out = resolve(outDir, `gemini-model-bench-${runTag}.md`)
  writeFileSync(out, report.join('\n'))

  // PII-FREE verdict matrix to console (no names — only flags/percentages).
  console.log('\n===== VERDICT MATRIX (PII-free) =====')
  console.log('doc | model | avail | retries | lines | A↔B sim | GT-hit | fabrication')
  for (const r of matrix) {
    console.log(`${r.doc} | ${r.model} | ${r.avail ? 'OK' : 'BLOCKED'} | ${r.retries} | ${r.lines} | ${r.sim === null ? '-' : r.sim + '%'} | ${r.gt} | ${r.fab || r.err}`)
  }
  console.log(`\n✓ FULL report (gitignored, real reads) → ${out}`)
})()
