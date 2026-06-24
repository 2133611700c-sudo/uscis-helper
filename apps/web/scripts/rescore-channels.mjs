#!/usr/bin/env node
/* rescore-channels.mjs — the FIRST trustworthy scorer. Re-scores EVERY already-saved model response
 * (qa-private/reports/ablation-*.md + evidence-*.md) WITHOUT new API calls, per the independent-auditor
 * brief: each field is scored on SEPARATE channels so a correct read in the "wrong" representation is
 * never counted as a vision miss, and transport/timeout/refusal are NEVER scored as OCR=0.
 *
 *   CHANNELS per name field: RAW_CYRILLIC_exact · OFFICIAL_LATIN_exact · TRANSLIT_VARIANT (passport-Latin
 *     vs KMU-55/BGN, fuzzy) · PERSON (any channel ⇒ the right human was read).  + DOB.
 *   TAXONOMY: SUCCESS / PROVIDER_TIMEOUT / MODEL_REFUSAL / TRANSPORT_OR_ERR / EMPTY — N/A never = 0%.
 *
 * PII: reads gitignored qa-private; prints ONLY counts/percent (no values). Run from apps/web:
 *   npx tsx --tsconfig tsconfig.json scripts/rescore-channels.mjs
 */
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const { transliterateKMU55, transliterateRussian } = await import(path.join(ROOT, 'packages/knowledge/src/transliterate.ts'))

const RPT = path.join(ROOT, 'qa-private/reports')
const GT = path.join(ROOT, 'qa-private/ground-truth')
const GTFILE = { passport: 'internal_passport_01.json', military: 'military_id_p1.json', birth: 'birth_cert_handwritten_01.json' }
// some reports used military_id_p1_01 — fall back
const gtFor = async (key) => {
  for (const f of [GTFILE[key], GTFILE[key]?.replace('.json', '_01.json'), `${key === 'military' ? 'military_id_p1_01' : ''}.json`]) {
    try { return JSON.parse(await readFile(path.join(GT, f), 'utf8')) } catch {}
  }
  // explicit
  const map = { passport: 'internal_passport_01.json', military: 'military_id_p1_01.json', birth: 'birth_cert_handwritten_01.json' }
  return JSON.parse(await readFile(path.join(GT, map[key]), 'utf8'))
}

const fold = (s) => (s || '').toLocaleLowerCase('uk').replace(/['’ʼ`\s.\-]/g, '')
// latin fold that absorbs UA/RU romanization variants so SERGII == Serhii == Serhij (same person)
const latFold = (s) => (s || '').toLowerCase().replace(/[^a-z]/g, '')
  .replace(/kh/g, 'h').replace(/zh/g, 'j').replace(/shch/g, 'sc').replace(/sh/g, 's').replace(/ch/g, 'c')
  .replace(/ ya|ia/g, 'a').replace(/yu|iu/g, 'u').replace(/ye|ie/g, 'e')
  .replace(/g/g, 'h').replace(/y/g, 'i').replace(/[aeiou]/g, '') // drop vowels + g/h,y/i collapse → consonant skeleton
const editLeq = (a, b, n) => { // tiny edit-distance ≤ n
  if (Math.abs(a.length - b.length) > n) return false
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 0; j <= b.length; j++) dp[0][j] = j
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  return dp[a.length][b.length] <= n
}

function channels(g) {
  const out = []
  for (const b of ['family_name', 'given_name', 'patronymic', 'child_family_name', 'child_given_name', 'child_patronymic']) {
    const c = g[b + '_cyrillic'], l = g[b + '_latin']
    if ((typeof c === 'string' && c.trim().length > 1) || (typeof l === 'string' && l.trim().length > 1))
      out.push({ base: b, cyr: (c || '').trim(), lat: (l || '').trim() })
  }
  const dob = typeof g.date_of_birth === 'string' ? g.date_of_birth.replace(/\D/g, '') : ''
  return { fields: out, dob }
}
// score one field across channels
function scoreField(text, f) {
  const t = fold(text)
  const cyrExact = f.cyr && t.includes(fold(f.cyr))
  const latExact = f.lat && t.includes(fold(f.lat))
  // translit of the GT cyrillic (UA + RU) appearing in output
  let translit = false
  if (f.cyr) {
    for (const fn of [transliterateKMU55, transliterateRussian]) { try { if (t.includes(fold(fn(f.cyr)))) translit = true } catch {} }
  }
  // fuzzy latin-variant: output contains a latin token within edit-distance 1 of GT-latin skeleton
  let variant = false
  if (f.lat) {
    const target = latFold(f.lat)
    for (const tok of (text.match(/[A-Za-z]{3,}/g) || [])) if (editLeq(latFold(tok), target, 1)) { variant = true; break }
  }
  return { cyrExact: !!cyrExact, latExact: !!latExact, translit, variant, person: !!(cyrExact || latExact || translit || variant) }
}

// extract sections: "## <header>\n...\n```\n<text>\n```" — returns [{header, status, text}]
function sections(md) {
  const out = []
  const re = /^##\s+(.+)$/gm
  let m, idxs = []
  while ((m = re.exec(md))) idxs.push({ header: m[1].trim(), at: m.index })
  for (let i = 0; i < idxs.length; i++) {
    const seg = md.slice(idxs[i].at, i + 1 < idxs.length ? idxs[i + 1].at : md.length)
    const code = seg.match(/```\n([\s\S]*?)\n```/)
    const status = (seg.match(/^-\s+(?:taxonomy:\s*)?(.+)$/m) || [])[1] || ''
    out.push({ header: idxs[i].header, status, text: code ? code[1] : '' })
  }
  return out
}
const docKey = (h) => /passport/.test(h) ? 'passport' : /military/.test(h) ? 'military' : /birth/.test(h) ? 'birth' : null
function taxonomy(status, text) {
  if (/timeout/i.test(status) || /timeout/i.test(text)) return 'PROVIDER_TIMEOUT'
  if (/refus|can'?t assist|i'?m sorry/i.test(status + text)) return 'MODEL_REFUSAL'
  if (/\bERR\b|fetch failed|exhausted|HTTP 5|HTTP 4/i.test(status)) return 'TRANSPORT_OR_ERR'
  if (!text.trim()) return 'EMPTY'
  return 'SUCCESS'
}

const files = (await readdir(RPT)).filter((f) => /^(ablation|evidence|gpt-pipeline-bench|gpt-model-bench)-.*\.md$/.test(f))
console.log('CHANNEL-AWARE RE-SCORE of saved responses (no new API calls) — PII-free\n')
console.log('report | model·doc·cell | taxonomy | PERSON | CYR_exact | LAT_exact | TRANSLIT_var | DOB')
const rows = []
for (const file of files) {
  const md = await readFile(path.join(RPT, file), 'utf8')
  for (const s of sections(md)) {
    const key = docKey(s.header); if (!key) continue
    const tax = taxonomy(s.status, s.text)
    let line
    if (tax !== 'SUCCESS') { line = { person: 'N/A', cyr: 'N/A', lat: 'N/A', var: 'N/A', dob: 'N/A' } }
    else {
      const g = await gtFor(key); const ch = channels(g)
      const present = ch.fields.filter((f) => f.cyr || f.lat)
      const sc = present.map((f) => scoreField(s.text, f))
      const n = present.length
      const cnt = (k) => sc.filter((x) => x[k]).length
      const dob = ch.dob ? (s.text.includes(ch.dob.slice(0, 4)) && (s.text.includes(ch.dob.slice(-2)) || s.text.includes(ch.dob.slice(-4, -2))) ? 'Y' : 'N') : '-'
      line = { person: `${cnt('person')}/${n}`, cyr: `${cnt('cyrExact')}/${n}`, lat: `${cnt('latExact')}/${n}`, var: `${cnt('variant')}/${n}`, dob }
    }
    const tag = `${s.header}`.replace(/gemini-2\.5-pro/, 'gem25').replace(/gpt-/, 'gpt').replace(/ · /g, '·')
    console.log(`${file.replace(/\.md$/, '').replace(/^(ablation|evidence|gpt-pipeline-bench|gpt-model-bench)-/, '$1:')} | ${tag} | ${tax} | ${line.person} | ${line.cyr} | ${line.lat} | ${line.var} | ${line.dob}`)
    rows.push({ file, header: s.header, tax, ...line })
  }
}
// headline: of SUCCESS reads, how often was the right PERSON read (any channel) on PRINTED vs handwriting
const succ = rows.filter((r) => r.tax === 'SUCCESS' && r.person !== 'N/A')
const printed = succ.filter((r) => !/birth/.test(r.header)), hw = succ.filter((r) => /birth/.test(r.header))
const pct = (arr) => { let h = 0, n = 0; for (const r of arr) { const [a, b] = r.person.split('/').map(Number); h += a; n += b } return n ? `${h}/${n} = ${Math.round(100 * h / n)}%` : 'n/a' }
console.log(`\n=== HEADLINE (PERSON read correctly, any channel, SUCCESS reads only) ===`)
console.log(`PRINTED docs:     ${pct(printed)}`)
console.log(`HANDWRITTEN docs: ${pct(hw)}`)
console.log(`(transport/timeout/refusal excluded — never scored as OCR=0)`)
