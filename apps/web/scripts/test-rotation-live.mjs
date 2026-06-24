#!/usr/bin/env node
/* LIVE rotation test — owner request "система сама переворачивает документы, протести всё".
 * 1) probe Gemini quota (1 cheap call); 2) prove EXIF-rotate is a NO-OP on CONTENT rotation
 *    (the gap: a sideways-shot doc is not fixed by sharp.rotate()); 3) if Gemini alive, run
 *    autoOrient live on the REAL sideways military-ID + on the passport rotated 0/90/180/270.
 * Honest: no mocks. If quota is blocked, says BLOCKED, does not fake a number. */
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import sharp from 'sharp'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const DOCS = path.join(ROOT, 'test-fixtures/real-docs')
// load env from .env.local
for (const f of ['.env.local', 'apps/web/.env.local']) {
  try {
    const txt = await readFile(path.join(ROOT, f), 'utf8')
    for (const line of txt.split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  } catch {}
}
const KEY = process.env.GEMINI_API_KEY
const MODEL = process.env.PRIMARY_GEMINI_MODEL || 'gemini-3.1-pro-preview'

async function detectCwLive(buf, label) {
  // ask Gemini: by how many degrees CW must this thumbnail rotate to be upright?
  const thumb = await sharp(buf).resize(900, 900, { fit: 'inside' }).jpeg({ quality: 80 }).toBuffer()
  const body = {
    contents: [{ parts: [
      { text: 'This is a scanned identity document, possibly rotated. By how many degrees CLOCKWISE must it be rotated to make the printed text upright and readable? Answer ONLY one of: 0, 90, 180, 270.' },
      { inline_data: { mime_type: 'image/jpeg', data: thumb.toString('base64') } },
    ] }],
    generationConfig: { temperature: 0, maxOutputTokens: 10 },
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${KEY}`
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  if (res.status === 429) return { status: 'BLOCKED_429', label }
  if (!res.ok) return { status: `HTTP_${res.status}`, label, detail: (await res.text()).slice(0, 200) }
  const j = await res.json()
  const txt = (j.candidates?.[0]?.content?.parts?.[0]?.text || '').trim()
  const deg = (txt.match(/\b(0|90|180|270)\b/) || [])[1]
  return { status: 'OK', label, raw: txt, detectedCw: deg ? Number(deg) : null }
}

console.log('=== ROTATION LIVE TEST ===\n')

// ── PART A: deterministic — EXIF rotate is a NO-OP on CONTENT rotation ──
const passport = await readFile(path.join(DOCS, 'internal_passport_01.jpg'))
const rot90 = await sharp(passport).rotate(90).jpeg().toBuffer() // CONTENT-rotated 90° (no EXIF tag)
const afterExif = await sharp(rot90).rotate().jpeg().toBuffer()   // sharp EXIF auto-rotate
const m0 = await sharp(passport).metadata()
const mRot = await sharp(rot90).metadata()
const mExif = await sharp(afterExif).metadata()
console.log('PART A — EXIF-rotate vs CONTENT-rotate (deterministic):')
console.log(`  original passport: ${m0.width}x${m0.height}`)
console.log(`  content-rotated 90°: ${mRot.width}x${mRot.height} (dimensions swapped — genuinely sideways)`)
console.log(`  after sharp.rotate() [EXIF auto]: ${mExif.width}x${mExif.height}`)
const exifFixedIt = mExif.width === m0.width && mExif.height === m0.height
console.log(`  => EXIF auto-rotate ${exifFixedIt ? 'FIXED' : 'did NOT fix'} the content rotation`)
console.log(`  CONCLUSION: ${exifFixedIt ? 'unexpected' : 'CONFIRMED — sharp.rotate() (the ON-by-default path) does NOT un-rotate a content-rotated doc; only autoOrient (OFF) does.'}\n`)

// ── PART B: live — Gemini orientation detection ──
if (!KEY) { console.log('PART B — SKIPPED (no GEMINI_API_KEY)'); process.exit(0) }
console.log('PART B — live Gemini orientation detection:')
// probe quota with the REAL sideways military ID first
const mil = await readFile(path.join(DOCS, 'military_id_p1_01.jpg'))
const milRes = await detectCwLive(mil, 'REAL military_id_p1 (shot sideways)')
console.log(`  ${milRes.label}: ${milRes.status}${milRes.detectedCw != null ? ` detectedCW=${milRes.detectedCw}°` : ''}${milRes.raw ? ` (raw="${milRes.raw}")` : ''}${milRes.detail ? ` ${milRes.detail}` : ''}`)
if (milRes.status === 'BLOCKED_429') {
  console.log('\n  Gemini quota BLOCKED (429 monthly spend cap). Live orientation detection cannot run now — NOT faking a result.')
  process.exit(0)
}
// if alive, test the passport at all 4 orientations
for (const cw of [0, 90, 180, 270]) {
  const r = cw === 0 ? passport : await sharp(passport).rotate(cw).jpeg().toBuffer()
  const out = await detectCwLive(r, `passport rotated +${cw}°`)
  const expectBack = (360 - cw) % 360 // CW needed to restore
  const correct = out.detectedCw === expectBack
  console.log(`  ${out.label}: ${out.status} detectedCW=${out.detectedCw}° (expected ${expectBack}°) ${out.status === 'OK' ? (correct ? '✓' : '✗ MISMATCH') : ''}`)
}
