#!/usr/bin/env node
/**
 * gt-pipeline-bench.mjs — REAL per-field accuracy harness (R0 baseline tool).
 *
 * Measures the production pipeline's per-field reads vs OWNER-VERIFIED ground truth,
 * with a verdict taxonomy that NEVER counts an empty read as a pass.
 *
 *   LIVE mode  (default): POSTs each real image to the PROD endpoint
 *     /api/translation/vision-extract, which runs the exact production read
 *     (gemini-3.1-pro-preview + paid prod key + KMU-55 + review gates).
 *     Requires network + prod availability (and prod-side GEMINI quota). No local
 *     key handling — the production brain measures itself.
 *
 *   --dry mode: reads FROZEN real reads from a saved JSON (default
 *     apps/web/scripts/__fixtures__/gt-pipeline-bench.dry-reads.json) instead of
 *     calling Gemini, so the scoring logic itself is testable offline with zero cost.
 *     Override the source with `--reads=<path>` (e.g. a fresh raw dump).
 *
 * VERDICT TAXONOMY (per scored field):
 *   CORRECT       — GT non-empty, read matches (after sane normalization).
 *   WRONG         — GT non-empty, read non-empty but different (a name mismatch is WRONG).
 *   MISS          — GT non-empty, read empty/absent (the model failed to read it).
 *   CORRECT_EMPTY — GT empty AND read empty (nothing to recognize). NOT in the rate.
 *   FABRICATED    — GT empty, read non-empty (the model invented a value).
 *
 *   field-recognition rate = CORRECT / (CORRECT + WRONG + MISS + FABRICATED).
 *   CORRECT_EMPTY is EXCLUDED from the denominator — an empty read can never inflate it.
 *
 * Only OWNER-VERIFIED fields are scored (gt._meta.owner_verified_fields). GT files with
 * `ground_truth_status: MISSING`/empty (e.g. booklet_page_4) are SKIPPED and listed.
 *
 * PII: images + the raw reads dump stay under gitignored qa-private/. The committable
 * markdown summary carries ONLY field names + verdicts + counts — never a personal value.
 *
 * Usage:
 *   node apps/web/scripts/gt-pipeline-bench.mjs --dry        # offline, scoring-logic proof
 *   node apps/web/scripts/gt-pipeline-bench.mjs              # LIVE prod read (needs prod quota)
 *   node apps/web/scripts/gt-pipeline-bench.mjs --reads=qa-private/reports/foo.json   # score a saved dump
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'
import { tmpdir } from 'node:os'

const __dir = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(__dir, '../../..')
const PROD = 'https://messenginfo.com/api/translation/vision-extract'
const EDGE_BODY_LIMIT = 4_000_000 // Vercel serverless request-body cap (~4.5MB); downscale above this

// ── CLI flags ────────────────────────────────────────────────────────────────
const ARGV = process.argv.slice(2)
const DRY = ARGV.includes('--dry')
const readsArg = ARGV.find((a) => a.startsWith('--reads='))?.split('=')[1]
const DEFAULT_DRY_READS = resolve(__dir, '__fixtures__/gt-pipeline-bench.dry-reads.json')
const READS_PATH = readsArg ? resolve(REPO, readsArg) : DEFAULT_DRY_READS

// Core Cyrillic set (cost control: 4 docs). Named fixtures pair 1:1 with GT.
// NOTE: these paths are the files that actually exist on disk (*_kuropiatnyk.*).
const DOCS = [
  { fixture: 'test-fixtures/real-docs/internal_passport_kuropiatnyk.jpg', gt: 'qa-private/ground-truth/internal_passport_kuropiatnyk.json', docTypeId: 'ua_internal_passport_booklet', label: 'internal_passport_booklet (handwritten)' },
  { fixture: 'test-fixtures/real-docs/birth_cert_handwritten_kuropiatnyk.jpg', gt: 'qa-private/ground-truth/birth_cert_handwritten_kuropiatnyk.json', docTypeId: 'ua_birth_certificate', label: 'birth_certificate (handwritten)' },
  { fixture: 'test-fixtures/real-docs/birth_cert_soviet_kuropiatnyk.jpg', gt: 'qa-private/ground-truth/birth_cert_soviet_kuropiatnyk.json', docTypeId: 'ua_birth_certificate', label: 'birth_certificate (Soviet bilingual)' },
  { fixture: 'test-fixtures/real-docs/military_id_p1_kuropiatnyk.jpg', gt: 'qa-private/ground-truth/military_id_p1_kuropiatnyk.json', docTypeId: 'ua_military_id', label: 'military_id_p1 (printed+hw)' },
]

// Per-doc-class map: route field name → { latin: GT key, cyr?: GT key }.
// Birth cert uses child_* field names in the registry — a generic map mis-scores it.
const PERSON = (prefix = '') => ({
  [`${prefix}family_name`]: { latin: 'family_name_latin', cyr: 'family_name_cyrillic' },
  [`${prefix}given_name`]:  { latin: 'given_name_latin',  cyr: 'given_name_cyrillic' },
  [`${prefix}patronymic`]:  { latin: 'patronymic_latin',  cyr: 'patronymic_cyrillic' },
})
const FIELD_MAP_BY_DOC = {
  ua_internal_passport_booklet: { ...PERSON(), dob: { latin: 'date_of_birth' }, sex: { latin: 'sex' } },
  ua_military_id:               { ...PERSON(), dob: { latin: 'date_of_birth' }, sex: { latin: 'sex' } },
  ua_birth_certificate:         { ...PERSON('child_'), dob: { latin: 'date_of_birth' }, sex: { latin: 'sex' } },
}

// ── normalization (conservative) ─────────────────────────────────────────────
// trim + collapse whitespace + unify apostrophes. Case-fold only for the LATIN
// channel (Latin names compare case-insensitively); Cyrillic keeps case so we never
// accidentally mask a real letter swap. We do NOT fold ё/е or и/і — a name letter
// mismatch must surface as WRONG (HARD RULE: a name mismatch is WRONG).
const apos = (s) => s.replace(/['’ʼ`]/g, "'")
const collapse = (s) => apos((s ?? '').toString().trim().replace(/\s+/g, ' '))
const normLatin = (s) => collapse(s).toLowerCase()
const normCyr = (s) => collapse(s)
const isEmpty = (s) => collapse(s) === ''

/**
 * Classify one field: compare an expected GT value against the read value.
 * Returns one of CORRECT | WRONG | MISS | CORRECT_EMPTY | FABRICATED.
 */
function classify(expected, got, kind /* 'latin' | 'cyrillic' */) {
  const gtEmpty = isEmpty(expected)
  const readEmpty = isEmpty(got)
  if (gtEmpty && readEmpty) return 'CORRECT_EMPTY'
  if (gtEmpty && !readEmpty) return 'FABRICATED'
  if (!gtEmpty && readEmpty) return 'MISS'
  const norm = kind === 'latin' ? normLatin : normCyr
  return norm(expected) === norm(got) ? 'CORRECT' : 'WRONG'
}

// Verdicts that count toward the recognition-rate denominator (CORRECT_EMPTY excluded).
const SCORED = new Set(['CORRECT', 'WRONG', 'MISS', 'FABRICATED'])

// ── obtain reads (live or dry) ───────────────────────────────────────────────
function bodyBuffer(absPath) {
  const buf = readFileSync(absPath)
  if (buf.length <= EDGE_BODY_LIMIT) return buf
  const out = resolve(tmpdir(), 'gtbench_' + absPath.split('/').pop())
  try {
    execSync(`sips -Z 2400 -s formatOptions 75 "${absPath}" --out "${out}"`, { stdio: 'ignore' })
    return readFileSync(out)
  } catch {
    return buf // sips unavailable → send as-is (will 413 at the edge, recorded as a finding)
  }
}

async function liveRead(d) {
  const absImg = resolve(REPO, d.fixture)
  if (!existsSync(absImg)) return { error: `fixture missing: ${d.fixture}` }
  const origSize = readFileSync(absImg).length
  const buf = bodyBuffer(absImg)
  const downscaled = buf.length !== origSize
  const fd = new FormData()
  fd.append('file', new Blob([buf], { type: 'image/jpeg' }), 'doc.jpg')
  fd.append('docTypeId', d.docTypeId)
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 90000)
  try {
    const r = await fetch(PROD, { method: 'POST', body: fd, signal: ctrl.signal })
    const resp = await r.json()
    return { http: r.status, status: resp.status ?? null, model: resp.model ?? null,
      fields: resp.fields ?? [], downscaled, orig_mb: +(origSize / 1e6).toFixed(1) }
  } catch (e) {
    return { error: e.name === 'AbortError' ? 'timeout(90s)' : e.message }
  } finally { clearTimeout(t) }
}

function dryRead(d, dryDb) {
  const entry = dryDb[d.label]
  if (!entry) return { error: `no dry reads for label "${d.label}" in ${READS_PATH}` }
  return { http: entry.http ?? null, status: entry.status ?? null, model: entry.model ?? null,
    fields: entry.fields ?? [], downscaled: false, orig_mb: null }
}

// ── score one doc ────────────────────────────────────────────────────────────
function scoreDoc(d, read, gt) {
  const FIELD_MAP = FIELD_MAP_BY_DOC[d.docTypeId] ?? {}
  const got = {}
  for (const f of read.fields ?? []) got[f.field] = f
  const verified = new Set(gt._meta?.owner_verified_fields ?? [])

  const rows = []
  for (const [routeField, map] of Object.entries(FIELD_MAP)) {
    // score ONLY fields the owner actually verified (latin or cyrillic key, or dob/sex aliases)
    const isVerified = verified.has(map.latin) || (map.cyr && verified.has(map.cyr)) ||
      (routeField === 'dob' && verified.has('date_of_birth')) || (routeField === 'sex' && verified.has('sex'))
    if (!isVerified) continue

    const g = got[routeField]
    const expLatin = gt[map.latin]
    const expCyr = map.cyr ? gt[map.cyr] : null

    // Pick the channel to score: prefer LATIN when GT has a Latin value (passport/military);
    // fall back to CYRILLIC when GT-latin is empty (birth certs keep names as-written, no Latin).
    let channel, expected, gotVal
    if (!isEmpty(expLatin)) { channel = 'latin'; expected = expLatin; gotVal = g?.value }
    else if (expCyr != null && !isEmpty(expCyr)) { channel = 'cyrillic'; expected = expCyr; gotVal = g?.raw_cyrillic }
    else {
      // GT verified the field but left BOTH channels empty → nothing to score against.
      // Treat as correctly-empty if the model also returned nothing, else fabricated.
      channel = 'latin'; expected = ''; gotVal = g?.value ?? g?.raw_cyrillic
    }

    const verdict = classify(expected, gotVal, channel)
    rows.push({
      field: routeField,
      channel,
      verdict,
      present: Boolean(g),
      review_required: g?.review_required ?? null,
      // raw values only in the gitignored raw dump, never in the markdown summary
      _expected: expected, _got: gotVal ?? null,
    })
  }
  return rows
}

// ── GT status gate ───────────────────────────────────────────────────────────
function gtUsable(gt) {
  const status = (gt._meta?.ground_truth_status ?? '').toUpperCase()
  if (status === 'MISSING' || status === '' ) return { usable: false, reason: `status=${status || 'unset'}` }
  if (!(gt._meta?.owner_verified_fields ?? []).length) return { usable: false, reason: 'no owner_verified_fields' }
  return { usable: true }
}

// ── main ─────────────────────────────────────────────────────────────────────
const mode = DRY ? 'DRY (offline, frozen reads)' : 'LIVE (prod /api/translation/vision-extract)'
process.stderr.write(`gt-pipeline-bench — mode: ${mode}\n`)
let dryDb = null
if (DRY) {
  if (!existsSync(READS_PATH)) { process.stderr.write(`FATAL: dry reads file not found: ${READS_PATH}\n`); process.exit(2) }
  dryDb = JSON.parse(readFileSync(READS_PATH, 'utf8'))
}

const results = []
const skipped = []
for (const d of DOCS) {
  const absGt = resolve(REPO, d.gt)
  if (!existsSync(absGt)) { skipped.push({ label: d.label, gt: d.gt, reason: 'GT file not found' }); process.stderr.write(`⤬ SKIP ${d.label} — GT file missing\n`); continue }
  const gt = JSON.parse(readFileSync(absGt, 'utf8'))
  const usable = gtUsable(gt)
  if (!usable.usable) { skipped.push({ label: d.label, gt: d.gt, reason: usable.reason }); process.stderr.write(`⤬ SKIP ${d.label} — GT unusable (${usable.reason})\n`); continue }

  process.stderr.write(`▶ ${d.label} …\n`)
  const read = DRY ? dryRead(d, dryDb) : await liveRead(d)
  if (read.error) { results.push({ label: d.label, docTypeId: d.docTypeId, error: read.error }); continue }
  const rows = scoreDoc(d, read, gt)
  results.push({ label: d.label, docTypeId: d.docTypeId, http: read.http, status: read.status,
    model: read.model, fields_returned: (read.fields ?? []).length, downscaled: read.downscaled,
    orig_mb: read.orig_mb, rows })
}

// ── tally ────────────────────────────────────────────────────────────────────
const emptyTally = () => ({ CORRECT: 0, WRONG: 0, MISS: 0, FABRICATED: 0, CORRECT_EMPTY: 0 })
const add = (acc, v) => { acc[v]++ }
const rate = (t) => {
  const denom = t.CORRECT + t.WRONG + t.MISS + t.FABRICATED
  return denom === 0 ? null : t.CORRECT / denom
}
const pct = (r) => r === null ? 'n/a' : `${(r * 100).toFixed(1)}%`

const overall = emptyTally()
const byClass = {}
for (const r of results) {
  if (r.error) continue
  byClass[r.docTypeId] ??= emptyTally()
  for (const row of r.rows) { add(overall, row.verdict); add(byClass[r.docTypeId], row.verdict) }
}
const scoredN = overall.CORRECT + overall.WRONG + overall.MISS + overall.FABRICATED
const verdictStamp = scoredN < 30 ? 'EXPLORATORY (N<30 scored fields — NOT canary approval)' : 'TIER-1 sample'

// ── raw dump (WITH values) → gitignored qa-private ───────────────────────────
const stamp = new Date().toISOString().slice(0, 10)
const rawDir = resolve(REPO, 'qa-private/reports')
if (!existsSync(rawDir)) mkdirSync(rawDir, { recursive: true })
writeFileSync(resolve(rawDir, `gt-pipeline-bench-${stamp}${DRY ? '-dry' : ''}.json`),
  JSON.stringify({ mode, results, skipped, overall, byClass }, null, 2))

// ── sanitized summary (NO personal values) → committable ─────────────────────
const ICON = { CORRECT: '✓', WRONG: '✗ WRONG', MISS: '∅ MISS', FABRICATED: '⚠ FABRICATED', CORRECT_EMPTY: '· empty-ok' }
let md = `# GT Pipeline Bench — ${stamp} · ${mode}\n\n`
md += `Per-field accuracy of the production read vs owner-verified GT. Field names + verdicts only — NO personal values.\n`
md += `Verdict taxonomy: CORRECT / WRONG / MISS (GT non-empty, read empty) / FABRICATED (GT empty, read non-empty) / CORRECT_EMPTY (both empty).\n`
md += `**Recognition rate = CORRECT / (CORRECT+WRONG+MISS+FABRICATED)** — CORRECT_EMPTY excluded; an empty read can NEVER inflate it.\n`
md += `Verdict stamp: **${verdictStamp}** (per GT_BENCHMARK_EXIT_CRITERIA: <30 scored fields/class ⇒ direction only).\n\n`

if (skipped.length) {
  md += `## Skipped (GT MISSING / unusable — NOT scored)\n`
  for (const s of skipped) md += `- \`${s.label}\` — ${s.reason} (${s.gt})\n`
  md += `\n`
}

for (const r of results) {
  md += `## ${r.label}\n`
  if (r.error) { md += `- ERROR: ${r.error}\n\n`; continue }
  md += `- http ${r.http} · status \`${r.status}\` · model \`${r.model}\` · fields_returned ${r.fields_returned}`
  md += r.downscaled ? ` · downscaled from ${r.orig_mb}MB (>4MB edge limit)\n\n` : `\n\n`
  md += `| field | channel | verdict | present | review |\n|---|---|---|---|---|\n`
  for (const x of r.rows) {
    md += `| ${x.field} | ${x.channel} | ${ICON[x.verdict]} | ${x.present ? '✓' : '✗'} | ${x.review_required === null ? '—' : x.review_required ? 'review' : 'ok'} |\n`
  }
  const t = emptyTally(); for (const x of r.rows) add(t, x.verdict)
  md += `\n**Recognition rate: ${pct(rate(t))}** — `
  md += `CORRECT ${t.CORRECT} · WRONG ${t.WRONG} · MISS ${t.MISS} · FABRICATED ${t.FABRICATED} · empty-ok ${t.CORRECT_EMPTY}\n\n`
}

md += `## Summary\n\n`
md += `| scope | CORRECT | WRONG | MISS | FABRICATED | empty-ok | recognition rate |\n|---|---|---|---|---|---|---|\n`
for (const [cls, t] of Object.entries(byClass)) {
  md += `| ${cls} | ${t.CORRECT} | ${t.WRONG} | ${t.MISS} | ${t.FABRICATED} | ${t.CORRECT_EMPTY} | ${pct(rate(t))} |\n`
}
md += `| **OVERALL** | ${overall.CORRECT} | ${overall.WRONG} | ${overall.MISS} | ${overall.FABRICATED} | ${overall.CORRECT_EMPTY} | **${pct(rate(overall))}** |\n\n`
md += `Scored fields (denominator) = ${scoredN}. Verdict: **${verdictStamp}**.\n`

const outMd = resolve(REPO, 'docs/reports', `GT_PIPELINE_BENCH_${stamp}${DRY ? '_DRY' : ''}.md`)
writeFileSync(outMd, md)
process.stderr.write(`✓ wrote ${outMd} (sanitized) + qa-private raw dump\n`)
console.log(md)
