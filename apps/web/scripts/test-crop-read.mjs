#!/usr/bin/env node
/* VERIFY the empty-field root cause: is it RESOLUTION? Crop the dense region (birth-cert parents +
 * series on the right page) at HIGH RES (upscale), and ask Gemini to read father/mother/series.
 * If it now COMMITS values it returned EMPTY at page scale → resolution confirmed → generalize the
 * date crop-read (dateRegionRead.ts) to these fields (STAGE 4). 1-2 paid Gemini calls. */
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import sharp from 'sharp'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
for (const f of ['.env.local', 'apps/web/.env.local']) {
  try {
    const txt = await readFile(path.join(ROOT, f), 'utf8')
    for (const line of txt.split('\n')) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '') }
  } catch {}
}
function paidKey() { const e = process.env; return e.GEMINI_API_KEY_PAY || e.GEMINI_API_KEY2 || e.GEMINI_API_KEY_066 || e.GEMINI_API_KEY || '' }
const KEY = paidKey(), MODEL = 'gemini-3.1-pro-preview'

async function ask(buf, prompt) {
  const body = JSON.stringify({ contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: 'image/jpeg', data: buf.toString('base64') } }] }], generationConfig: { temperature: 0 } })
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${KEY}`, {
        method: 'POST', headers: { 'content-type': 'application/json', connection: 'close' }, body,
      })
      if (!res.ok) return `HTTP_${res.status}`
      const j = await res.json()
      return (j?.candidates?.[0]?.content?.parts?.[0]?.text ?? '').trim()
    } catch (e) {
      console.log(`  (attempt ${attempt} failed: ${e?.cause?.code ?? e?.message}; retrying)`)
      await new Promise((r) => setTimeout(r, 2000))
    }
  }
  return 'FAILED_AFTER_RETRIES'
}

// Raw birth cert is landscape-upright (two-page spread; parents + series on the RIGHT page).
let buf = await readFile(path.join(ROOT, 'test-fixtures/real-docs/birth_cert_handwritten_kuropiatnyk.jpg'))
const meta = await sharp(buf).metadata()
console.log(`raw ${meta.width}x${meta.height}`)
// Crop the RIGHT ~52% (parents/registration/series) and UPSCALE to ~2200px wide + sharpen.
const cropLeft = Math.round(meta.width * 0.48)
const crop = await sharp(buf)
  .extract({ left: cropLeft, top: 0, width: meta.width - cropLeft, height: meta.height })
  .resize(1600, 1600, { fit: 'inside' }).sharpen({ sigma: 1 }).jpeg({ quality: 88 }).toBuffer()
const cm = await sharp(crop).metadata()
console.log(`crop → ${(crop.length / 1024).toFixed(0)}KB, ${cm.width}x${cm.height} (right page only ⇒ ~2x per-letter res vs full-page@2048)`)

const prompt = 'This is the RIGHT page of a Soviet/UkrSSR birth certificate (handwritten on a printed form, Russian). ' +
  'Read these fields letter by letter, best effort even if cursive — do NOT return empty for a field that is present:\n' +
  '1) ОТЕЦ / БАТЬКО (father full name, e.g. surname + given + patronymic)\n' +
  '2) МАТЬ / МАТИ (mother full name)\n' +
  '3) certificate series + number (Roman numerals + 2 Cyrillic letters + digits, e.g. "III-АМ № 428069")\n' +
  '4) place/office of registration (ЗАГС / РАЦС).\nReturn each on its own line in Cyrillic exactly as written.'
console.log('\n=== HI-RES CROP READ (parents/series region) ===')
console.log(await ask(crop, prompt))
console.log('\n=== GROUND TRUTH (from my own read) ===')
console.log('father: Куропятник Сергей Леонидович | mother: Куропятник Наталья Степановна | series: III-АМ № 428069')
