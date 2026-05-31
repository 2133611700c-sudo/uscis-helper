#!/usr/bin/env node
/**
 * scripts/run-live-reader-benchmark.mjs — LIVE reader benchmark (scaffold).
 *
 * Runs the real readers on a REAL document and scores them against a hand-filled
 * ground truth. The scoring logic lives in (and is unit-tested via)
 * apps/web/src/lib/canonical/core/benchmark/liveRunner.ts.
 *
 * Usage (run via tsx so @-aliases + TS resolve, from repo root):
 *   npx tsx --tsconfig apps/web/tsconfig.json \
 *     scripts/run-live-reader-benchmark.mjs \
 *     --image qa-private/real-docs/passport1.jpg \
 *     --ground-truth qa-private/ground-truth/passport1.json \
 *     --doc-type ua_international_passport
 *
 * DATA SAFETY: full reports (with field values = PII) are written ONLY to
 * qa-private/reports/ (gitignored). A PII-free summary is printed and written to
 * docs/reports/live-reader-benchmark/ (committable). Never commit qa-private/**.
 *
 * BLOCKED, not PASS: missing --image / --ground-truth / GEMINI key → exit 2.
 * Real document is NOT required for CI — the fixture test covers the logic.
 */
import fs from 'node:fs'
import path from 'node:path'

function block(reason) {
  console.error(`BLOCKED: ${reason}`)
  process.exit(2)
}

// ── args ─────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
function arg(name) {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && args[i + 1] ? args[i + 1] : null
}
const imagePath = arg('image')
const truthPath = arg('ground-truth')
const docType = arg('doc-type') || 'ua_international_passport'

// ── BLOCKED preconditions (never a false PASS) ───────────────────────────────
if (!imagePath) block('missing --image <path>')
if (!truthPath) block('missing --ground-truth <path>')
if (!fs.existsSync(imagePath)) block(`image not found: ${imagePath}`)
if (!fs.existsSync(truthPath)) block(`ground-truth not found: ${truthPath}`)
if (!(process.env.GEMINI_API_KEY_PAY || process.env.GEMINI_API_KEY)) {
  block('GEMINI_API_KEY_PAY / GEMINI_API_KEY not set (primary reader unavailable)')
}

let truth
try {
  truth = JSON.parse(fs.readFileSync(truthPath, 'utf-8'))
} catch (e) {
  block(`ground-truth is not valid JSON: ${e instanceof Error ? e.message : String(e)}`)
}

// ── wire real readers + run (needs the app/tsx context to resolve modules) ───
let result
try {
  const { runLiveBenchmark } = await import('@/lib/canonical/core/benchmark/liveRunner')
  const { readDocument } = await import('@/lib/docintel/documentFieldReader')
  const { readDocumentCore } = await import('@/lib/canonical/core/readDocumentCore')

  const buffer = fs.readFileSync(imagePath)
  const ext = path.extname(imagePath).toLowerCase()
  const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg'

  // Gemini docintel = the Translation reader (primary visual reader).
  const geminiFields = async () => {
    const r = await readDocument(buffer, mime, docType, { timeoutMs: 20_000 })
    if (!r?.ok || !Array.isArray(r.fields)) return null
    return r.fields.map((f) => ({
      field: f.field,
      raw_cyrillic: f.raw_cyrillic ?? null,
      value: f.value ?? null,
      review_required: !!f.review_required,
    }))
  }

  // Core = readDocumentCore over the same Gemini read (MRZ caller wiring is a
  // follow-up: it needs locateMrzLines exposed; until then Core runs gemini-only).
  const coreFields = async () => {
    const docintel = await geminiFields()
    if (!docintel) return null
    const visualRead = async () =>
      docintel
        .filter((f) => (f.value ?? f.raw_cyrillic ?? '').trim() !== '')
        .map((f) => ({ key: f.field, value: f.value ?? f.raw_cyrillic ?? '', source: 'ai_vision', confidence: 0.9, provider: 'gemini' }))
    const out = await readDocumentCore(
      { documentSessionId: 'bench', product: 'translation', docType, createdAt: new Date().toISOString(), file: buffer },
      { qualityGate: () => ({ ok: true }), visualRead },
    )
    return out.status === 'ok' ? out.result.fields : null
  }

  // NOTE (honest, follow-up wiring): a clean MRZ baseline needs `locateMrzLines`
  // exported from passport.ts (currently private) + Vision OCR; the old TPS reader
  // is a Next route → call via a running dev endpoint. Both are null here.
  result = await runLiveBenchmark(truth, { gemini: geminiFields, core: coreFields, mrz: undefined, tps: undefined })
} catch (e) {
  block(`reader modules require the app/tsx context — run via: npx tsx --tsconfig apps/web/tsconfig.json ... (${e instanceof Error ? e.message : String(e)})`)
}

if (result.status === 'blocked') block(result.blockedReason || 'no reader produced output')

// ── outputs: full (PII) → qa-private ; sanitized → docs/reports ──────────────
const ts = new Date().toISOString().replace(/[:.]/g, '-')
const privDir = path.resolve('qa-private/reports')
const pubDir = path.resolve('docs/reports/live-reader-benchmark')
fs.mkdirSync(privDir, { recursive: true })
fs.mkdirSync(pubDir, { recursive: true })

fs.writeFileSync(path.join(privDir, `${ts}.json`), JSON.stringify({ docType, ranReaders: result.ranReaders, report: result.report }, null, 2))

const sanitized =
  `# Live reader benchmark — ${ts}\n\n` +
  `doc_type: ${docType}\nreaders: ${result.ranReaders.join(', ')}\n\n` +
  '```\n' + result.summary + '\n```\n\n' +
  `metric: critical_wrong_count (goal: core = 0). Full per-field report (with values) is in qa-private/reports/${ts}.json (gitignored, PII).\n`
fs.writeFileSync(path.join(pubDir, `${ts}.md`), sanitized)

console.log(result.summary)
console.log(`\nfull report → qa-private/reports/${ts}.json (PII, gitignored)`)
console.log(`sanitized   → docs/reports/live-reader-benchmark/${ts}.md (committable)`)
process.exit(0)
