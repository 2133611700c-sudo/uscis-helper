#!/usr/bin/env node
/* ORIENTATION DETECTOR experiment — "which rotation is upright?" by DIRECT COMPARISON.
 * Builds a 2x2 grid of the SAME doc at 0/90/180/270° and asks Gemini ONCE which cell is upright.
 * This is more reliable than the current detectCw ("how many degrees CW") which false-negatived
 * the sideways military ID. 1 Gemini call per doc. Run: node apps/web/scripts/test-orient-detect.mjs */
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import sharp from 'sharp'

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
// Mirror getGeminiApiKey: the bare GEMINI_API_KEY is the dead free-tier key; the PAID key lives
// under GEMINI_API_KEY_PAY / GEMINI_API_KEY2.
function paidKey() {
  const e = process.env
  if (e.GEMINI_API_KEY_PAY || e.GEMINI_API_KEY2 || e.GEMINI_API_KEY_066) return e.GEMINI_API_KEY_PAY || e.GEMINI_API_KEY2 || e.GEMINI_API_KEY_066
  for (const [k, v] of Object.entries(e)) if (k !== 'GEMINI_API_KEY' && /^GEMINI_API_KEY[0-9A-Z_]+$/.test(k) && v) return v
  return e.GEMINI_API_KEY || ''
}
const KEY = paidKey()
const MODEL = process.env.PRIMARY_GEMINI_MODEL || 'gemini-3.1-pro-preview'

const DOCS = [
  { name: 'passport (upright)', img: 'internal_passport_kuropiatnyk.jpg' },
  { name: 'military (sideways)', img: 'military_id_p1_kuropiatnyk.jpg' },
  { name: 'birth (sideways)', img: 'birth_cert_handwritten_kuropiatnyk.jpg' },
]
// position → clockwise rotation applied to that cell. The cell that looks upright tells us the
// correction to apply to the ORIGINAL to make it upright.
const CELLS = [
  { pos: 'top-left', cw: 0 },
  { pos: 'top-right', cw: 90 },
  { pos: 'bottom-left', cw: 180 },
  { pos: 'bottom-right', cw: 270 },
]

async function buildGrid(buf) {
  const cell = 480, pad = 10, side = cell * 2 + pad * 3
  const tiles = await Promise.all(CELLS.map(async (c) => ({
    input: await sharp(buf).rotate(c.cw).resize(cell, cell, { fit: 'inside', background: '#ffffff' })
      .extend({ top: 0, bottom: 0, left: 0, right: 0, background: '#ffffff' }).jpeg().toBuffer(),
    top: c.pos.startsWith('top') ? pad : pad * 2 + cell,
    left: c.pos.endsWith('left') ? pad : pad * 2 + cell,
  })))
  return sharp({ create: { width: side, height: side, channels: 3, background: '#dddddd' } })
    .composite(tiles).jpeg({ quality: 85 }).toBuffer()
}

async function detect(buf) {
  const grid = await buildGrid(buf)
  const prompt = 'This image is a 2x2 grid showing the SAME identity document at four rotations: ' +
    'TOP-LEFT = original, TOP-RIGHT = rotated 90° clockwise, BOTTOM-LEFT = 180°, BOTTOM-RIGHT = 270° clockwise. ' +
    'Exactly ONE shows the document UPRIGHT: header/printed text horizontal and left-to-right, any face photo upright. ' +
    'Which one? Answer ONLY JSON {"pos":"top-left"|"top-right"|"bottom-left"|"bottom-right"}.'
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${KEY}`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: 'image/jpeg', data: grid.toString('base64') } }] }],
      generationConfig: { temperature: 0, response_mime_type: 'application/json' },
    }),
  })
  if (res.status === 429) return { status: 'BLOCKED_429' }
  if (!res.ok) return { status: `HTTP_${res.status}` }
  const j = await res.json()
  let pos = null
  try { pos = JSON.parse(j?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}')?.pos } catch {}
  const cell = CELLS.find((c) => c.pos === pos)
  return { status: 'OK', pos, correctionCw: cell ? cell.cw : null }
}

const PIPELINE = process.env.PIPELINE === '1' // mirror prod: apply EXIF (sharp.rotate()) + downscale
console.log(`=== ORIENTATION DETECTOR (grid compare) — model=${MODEL} pipeline=${PIPELINE} ===\n`)
for (const d of DOCS) {
  let buf = await readFile(path.join(ROOT, 'test-fixtures/real-docs', d.img))
  if (PIPELINE) {
    // exactly what preprocessImage does to orientation: EXIF auto-rotate, then downscale.
    buf = await sharp(buf).rotate().resize(2048, 2048, { fit: 'inside' }).toBuffer()
  } else {
    const meta = await sharp(buf).metadata()
    if (Math.max(meta.width, meta.height) > 2048) buf = await sharp(buf).resize(2048, 2048, { fit: 'inside' }).toBuffer()
  }
  // run twice to check determinism
  const r1 = await detect(buf)
  const r2 = await detect(buf)
  console.log(`${d.name}: run1 pos=${r1.pos} cw=${r1.correctionCw}° | run2 pos=${r2.pos} cw=${r2.correctionCw}° | ${r1.correctionCw === r2.correctionCw ? 'STABLE' : 'UNSTABLE'}`)
}
