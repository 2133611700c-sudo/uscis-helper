#!/usr/bin/env node
/* LIVE DeepSeek teaching proof — "обучи дипсик". Feeds the RUSSIAN birth-cert OCR text to
 * DeepSeek WITHOUT shared rules vs WITH textRulesForDeepSeek(ua_birth_certificate), and shows
 * the difference: with rules it (a) keeps Russian forms (Сергей/Сергеевич, NOT Ukrainianized),
 * (b) parses the spelled-out cursive date "двадцать пятого июня ... восемьдесят шестого" →
 * 1986-06-25 with month=June (not July). No mocks; honest. */
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
for (const f of ['.env.local', 'apps/web/.env.local']) {
  try {
    const txt = await readFile(path.join(ROOT, f), 'utf8')
    for (const line of txt.split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  } catch {}
}
const KEY = process.env.DEEPSEEK_API_KEY
const MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat'
if (!KEY) { console.log('SKIPPED — no DEEPSEEK_API_KEY'); process.exit(0) }

// the shared rules block, mirrored from textRulesForDeepSeek(ua_birth_certificate)
const { textRulesForDeepSeek } = await import(path.join(ROOT, 'apps/web/src/lib/docintel/docReadingRules.ts'))
const sharedRules = textRulesForDeepSeek('ua_birth_certificate')

// OCR text as the cursive Russian Soviet birth cert reads (what a vision pass hands DeepSeek)
const ocrText = `СВИДЕТЕЛЬСТВО О РОЖДЕНИИ / СВІДОЦТВО ПРО НАРОДЖЕННЯ
Фамилия: Куропятник   Имя, отчество: Сергей Сергеевич
родился(лась): двадцать пятого июня тысяча девятьсот восемьдесят шестого года
Место рождения: пгт Тростянец, Тростянецкого района, Винницкой области, УССР
Отец: Куропятник Сергей Леонидович, национальность украинец
Мать: Куропятник Наталья Степановна, национальность украинка
III-АМ № 428069`

const TASK = `Extract identity fields as JSON: {family_name, given_name, patronymic, date_of_birth (YYYY-MM-DD), place_of_birth, father, mother, cert_number}. Return ONLY JSON.`

async function ask(withRules) {
  const sys = withRules
    ? `You structure OCR text from identity documents.${sharedRules}`
    : `You structure OCR text from identity documents.`
  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${KEY}` },
    body: JSON.stringify({
      model: MODEL, temperature: 0,
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: `${TASK}\n\nOCR TEXT:\n${ocrText}` },
      ],
    }),
  })
  if (res.status === 429) return { status: 'BLOCKED_429' }
  if (!res.ok) return { status: `HTTP_${res.status}`, detail: (await res.text()).slice(0, 200) }
  const j = await res.json()
  let txt = (j.choices?.[0]?.message?.content || '').trim().replace(/^```json?|```$/g, '').trim()
  let parsed = null
  try { parsed = JSON.parse(txt) } catch {}
  return { status: 'OK', parsed, raw: txt }
}

console.log('=== DEEPSEEK TEACHING LIVE PROOF ===')
console.log(`model=${MODEL}  shared-rules block length=${sharedRules.length} chars\n`)

const off = await ask(false)
const on = await ask(true)
const truth = { given_name: 'Сергей', patronymic: 'Сергеевич', date_of_birth: '1986-06-25' }
function score(r, label) {
  console.log(`--- ${label} ---`)
  if (r.status !== 'OK') { console.log(`  ${r.status} ${r.detail || ''}`); return }
  const p = r.parsed || {}
  const gn = p.given_name || '', pat = p.patronymic || '', dob = p.date_of_birth || ''
  const keptRu = /Сергей/.test(gn) && /Сергеевич/.test(pat)
  const dateOk = dob === truth.date_of_birth
  console.log(`  given_name="${gn}" patronymic="${pat}" dob="${dob}"`)
  console.log(`  kept Russian (Сергей/Сергеевич, not Ukrainianized): ${keptRu ? 'YES ✓' : 'NO ✗'}`)
  console.log(`  date = 1986-06-25 (June, not July): ${dateOk ? 'YES ✓' : 'NO ✗'}`)
  return { keptRu, dateOk }
}
const a = score(off, 'WITHOUT shared rules (today\'s default)')
console.log()
const b = score(on, 'WITH shared rules (DEEPSEEK_SHARED_RULES_ENABLED=1)')
