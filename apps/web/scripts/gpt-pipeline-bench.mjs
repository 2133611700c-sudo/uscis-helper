#!/usr/bin/env node
/* gpt-pipeline-bench.mjs — HONEST audit of OpenAI models through the SAME pipeline as Gemini.
 * Runs readDocument() with the OpenAIVisionProvider (taught by the IDENTICAL buildPrompt: orientation
 * rule + language/script rule + per-doc DOC_READING_RULES), with the FREE deterministic post-stages ON
 * (DOC_SCRIPT_ROUTING = RU/UA language routing, SMART_NORMALIZE = patronymic/sex + codex), and scores
 * each field vs owner GT with the SAME verdict logic as gt-pipeline-bench. Reports per doc: orientation
 * handling, detected document LANGUAGE, and per-field CORRECT/WRONG/MISS + same-person.
 *
 * PII: full reads → gitignored qa-private/reports/. Console prints a PII-free matrix.
 * Run from apps/web:  BENCH_MODELS=gpt-4.1 GPT_RUNS=2 npx tsx --tsconfig tsconfig.json scripts/gpt-pipeline-bench.mjs
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
for (const f of ['.env.local', 'apps/web/.env.local']) {
  try { const t = await readFile(path.join(ROOT, f), 'utf8'); for (const l of t.split('\n')) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '') } } catch {}
}
// FREE deterministic teaching ON (language routing + codex). Orientation = GPT via the prompt rule
// (CONTENT_ORIENT uses Gemini; left OFF so this is a pure-GPT read). Paid Gemini re-read stages OFF.
process.env.DOC_SCRIPT_ROUTING_ENABLED = '1'
process.env.SMART_NORMALIZE_ENABLED = '1'
process.env.RU_TRANSLIT_ENABLED = '1'
process.env.DICTIONARY_AUTOCORRECT_ENABLED = '1'
for (const k of ['CONTENT_ORIENT_ENABLED', 'HIRES_TILE_RECOVER_ENABLED', 'ANTI_FABRICATION_GATE_ENABLED', 'SELF_CONSISTENCY_GATE_ENABLED', 'AUTO_DELIVERY_CONSENSUS_ENABLED']) delete process.env[k]

const MODELS = (process.env.BENCH_MODELS || 'gpt-4.1').split(',').map((s) => s.trim()).filter(Boolean)
const N = Math.max(1, Number(process.env.GPT_RUNS) || 2)
const TAG = (process.env.BENCH_TAG || MODELS[0] || 'run').replace(/[^a-z0-9_.-]/gi, '')

const { readDocument } = await import(path.join(ROOT, 'apps/web/src/lib/docintel/documentFieldReader.ts'))
const { preprocessImage } = await import(path.join(ROOT, 'apps/web/src/lib/ocr/image-preprocess.ts'))
const { OpenAIVisionProvider } = await import(path.join(ROOT, 'apps/web/src/lib/docintel/providers/openaiVisionProvider.ts'))
let detectDocumentScript
try { ({ detectDocumentScript } = await import(path.join(ROOT, 'packages/knowledge/src/transliterate.ts'))) } catch { detectDocumentScript = null }

// ── scoring (verbatim from gt-pipeline-bench) ─────────────────────────────────
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
  // International (biometric, MRZ) passport — NO patronymic printed. (The fixture internal_passport_01.jpg
  // is actually the INTERNATIONAL passport; GPT-4.1 correctly detected this when it was mislabeled as
  // the handwritten internal booklet — a real fixture-labeling bug also present in gt-pipeline-bench.)
  ua_international_passport: { family_name: { latin: 'family_name_latin', cyr: 'family_name_cyrillic' }, given_name: { latin: 'given_name_latin', cyr: 'given_name_cyrillic' }, dob: { latin: 'date_of_birth' }, sex: { latin: 'sex' } },
  ua_internal_passport_booklet: { ...PERSON(), dob: { latin: 'date_of_birth' }, sex: { latin: 'sex' } },
  ua_military_id: { ...PERSON(), dob: { latin: 'date_of_birth' }, sex: { latin: 'sex' } },
  ua_birth_certificate: { ...PERSON('child_'), dob: { latin: 'date_of_birth' }, sex: { latin: 'sex' } },
}
const DOCS = [
  { img: 'internal_passport_01.jpg', gt: 'internal_passport_01.json', docTypeId: 'ua_international_passport', key: 'passport' },
  { img: 'military_id_p1_01.jpg', gt: 'military_id_p1_01.json', docTypeId: 'ua_military_id', key: 'military' },
  { img: 'birth_cert_handwritten_01.jpg', gt: 'birth_cert_handwritten_01.json', docTypeId: 'ua_birth_certificate', key: 'birth' },
]

const report = ['# GPT Pipeline Bench — same pipeline as Gemini (FULL, gitignored: real reads)', '', `Models: ${MODELS.join(', ')} · runs/doc: ${N}`, '']
const matrix = []

for (const model of MODELS) {
  console.log(`\n######## MODEL ${model} ########`)
  report.push(`\n# MODEL ${model}\n`)
  for (const d of DOCS) {
    const raw = await readFile(path.join(ROOT, 'test-fixtures/real-docs', d.img))
    const gt = JSON.parse(await readFile(path.join(ROOT, 'qa-private/ground-truth', d.gt), 'utf8'))
    const verified = new Set(gt._meta?.owner_verified_fields ?? [])
    const map = FIELD_MAP_BY_DOC[d.docTypeId]
    const pre = await preprocessImage(raw, 'image/jpeg')
    const baseBuf = pre.ok ? pre.buffer : raw
    const mime = pre.ok ? pre.mimeType : 'image/jpeg'
    const provider = new OpenAIVisionProvider({ model })

    const okRuns = []
    let blocked = 0, blockReason = ''
    for (let i = 0; i < N; i++) {
      let r
      try { r = await readDocument(baseBuf, mime, d.docTypeId, { provider, attemptsPerModel: 1, timeoutMs: 110_000, originalBuffer: raw }) }
      catch (e) { blocked++; blockReason = 'threw:' + (e?.message || '').slice(0, 60); continue }
      if (!r.ok) { blocked++; blockReason = String(r.status || r.error || 'not_ok').slice(0, 60); continue }
      const fields = {}
      const rawCyr = []
      for (const f of r.fields ?? []) { fields[f.field] = { latin: f.value ?? '', cyr: f.raw_cyrillic ?? '' }; if (f.raw_cyrillic) rawCyr.push(f.raw_cyrillic) }
      okRuns.push({ fields, rawCyr })
    }

    const lang = (detectDocumentScript && okRuns[0]) ? detectDocumentScript(okRuns[0].rawCyr) : 'n/a'
    let correct = 0, scored = 0, samePersonOk = false
    const rows = []
    for (const [routeField, gtKeys] of Object.entries(map)) {
      for (const ch of ['cyr', 'latin']) {
        const gtKey = gtKeys[ch]; if (!gtKey || !verified.has(gtKey)) continue
        const expected = gt[gtKey]; if (isEmpty(expected)) continue
        const vals = okRuns.map((x) => x.fields[routeField]?.[ch] ?? '')
        const got = vals[0] ?? '' // first run (stability noted separately)
        const verdict = classify(expected, got, ch, routeField)
        if (['CORRECT', 'WRONG', 'MISS', 'FABRICATED'].includes(verdict)) { scored++; if (verdict === 'CORRECT') correct++ }
        if (/family_name/.test(routeField) && ch === 'cyr' && verdict === 'CORRECT') samePersonOk = true
        rows.push(`| ${routeField} | ${ch} | ${verdict} |`)
      }
    }
    const rate = scored ? Math.round((100 * correct) / scored) : 0
    const avail = okRuns.length > 0
    const hw = d.key === 'birth'
    console.log(`  [${d.key}] avail=${avail ? 'OK' : 'BLOCKED(' + blockReason + ')'} lang=${lang} recog=${correct}/${scored}=${rate}% samePerson=${samePersonOk ? 'YES' : 'NO'}`)
    matrix.push({ model, doc: d.key, avail, blockReason, lang, rate: avail ? rate : null, correct, scored, samePerson: avail ? samePersonOk : null, hw })
    report.push(`\n## ${model} — ${d.key} (${d.docTypeId})`)
    report.push(`- available: ${avail ? 'OK' : 'BLOCKED ' + blockReason} · detected language: ${lang} · recognition: ${correct}/${scored} = ${rate}% · same-person(surname): ${samePersonOk ? 'YES' : 'NO'}`)
    if (okRuns[0]) report.push(`- raw reads (run1): ${JSON.stringify(okRuns[0].fields)}`)
    report.push(rows.join('\n'))
  }
}

const outDir = path.join(ROOT, 'qa-private/reports'); await mkdir(outDir, { recursive: true })
await writeFile(path.join(outDir, `gpt-pipeline-bench-${TAG}.md`), report.join('\n'))

console.log('\n===== VERDICT MATRIX (PII-free) =====')
console.log('model | doc | hw? | avail | language | recognition | same-person')
for (const r of matrix) console.log(`${r.model} | ${r.doc} | ${r.hw ? 'HW' : 'print'} | ${r.avail ? 'OK' : 'BLOCKED:' + r.blockReason} | ${r.lang} | ${r.rate === null ? '-' : r.correct + '/' + r.scored + '=' + r.rate + '%'} | ${r.samePerson === null ? '-' : r.samePerson ? 'YES' : 'NO'}`)
console.log(`\n✓ FULL report (gitignored) → qa-private/reports/gpt-pipeline-bench-${TAG}.md`)
