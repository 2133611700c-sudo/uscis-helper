/**
 * POSTURE ENVELOPE — §6 narrow orientation harness (owner patch 2026-07-05).
 *
 * Drives the PRODUCTION content-orient detector (orientToUpright, K-vote as shipped) +
 * buildPostureEnvelope over controlled variants of 3 real docs, scored against the
 * EXIF oracle measured from the files themselves (birth=6, military=6, passport=1).
 *
 * Variants per doc:
 *   original_with_EXIF — raw bytes, EXIF tag intact (pixels as captured)
 *   EXIF_stripped      — same pixels, EXIF metadata removed
 *   manual_upright     — EXIF-honoring rotate → pixel-upright, no tag (ground truth pose)
 *   rot_0/90/180/270   — manual_upright rotated by N° CW, no EXIF
 *
 * Expected detector correction for rot_N = (360-N)%360; for manual_upright/rot_0 = 0.
 * For original_with_EXIF / EXIF_stripped the expectation is the EXIF-implied correction
 * (tag 6 → 90 CW; tag 1 → 0) — with the KNOWN caveat that the birth cert's tag 6 was
 * measured WRONG on the live scan (see detectOrientation.ts flag comment), so a detector
 * verdict of 0 on an EXIF-6 original is not automatically a MISS; both are recorded.
 *
 * Run: pnpm exec tsx scripts/posture-orientation-harness.mts   (from apps/web)
 * Output: JSON lines per (doc × variant) + summary table. Statuses only — never key values.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
// tsx compiles the app's TS (no "type":"module") to CJS — named ESM imports fail; unwrap default.
type Cw = 0 | 90 | 180 | 270
const orientMod = await import('../src/lib/docintel/orientation/detectOrientation')
const { detectUprightCwVoted } = ((orientMod as { default?: unknown }).default ?? orientMod) as typeof import('../src/lib/docintel/orientation/detectOrientation')
const postureMod = await import('../src/lib/docintel/posture/documentPostureEnvelope')
const { buildPostureEnvelope } = ((postureMod as { default?: unknown }).default ?? postureMod) as typeof import('../src/lib/docintel/posture/documentPostureEnvelope')

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
for (const f of ['.env.local', 'apps/web/.env.local']) {
  try {
    const txt = await readFile(path.join(ROOT, f), 'utf8')
    for (const line of txt.split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  } catch { /* env file optional */ }
}
function paidKey(): string {
  const e = process.env
  return e.GEMINI_API_KEY_PAY || e.GEMINI_API_KEY2 || e.GEMINI_API_KEY_066 || e.GEMINI_API_KEY || ''
}
const KEY = paidKey()
const MODEL = process.env.PRIMARY_GEMINI_MODEL || 'gemini-2.5-pro'
if (!KEY) { console.error('FATAL: no reader credential resolved (statuses-only policy)'); process.exit(1) }

const DOCS = [
  { id: 'birth_cert_handwritten_01', file: 'birth_cert_handwritten_01.jpg' },
  { id: 'military_id_p1_01', file: 'military_id_p1_01.jpg' },
  { id: 'internal_passport_01', file: 'internal_passport_01.jpg' },
]
const exifToCw = (tag: number | undefined): Cw => (tag === 6 ? 90 : tag === 8 ? 270 : tag === 3 ? 180 : 0)

interface Row {
  doc: string; variant: string; exif_tag_in_variant: number | 'none'
  expected_correction_cw: number | 'exif_implied_see_note'; detected_cw: number | 'undecidable'
  orientation_correct: boolean | 'see_note'; posture_gate: string; error?: string
}
const rows: Row[] = []

for (const d of DOCS) {
  const raw = await readFile(path.join(ROOT, 'test-fixtures/real-docs', d.file))
  const meta = await sharp(raw).metadata()
  const exifTag = meta.orientation
  // manual_upright: honor EXIF (sharp .rotate() with no args), strip metadata
  const upright = await sharp(raw).rotate().jpeg({ quality: 92 }).toBuffer()
  const stripped = await sharp(raw).jpeg({ quality: 92 }).toBuffer() // re-encode w/o withMetadata ⇒ EXIF dropped, pixels as stored

  const variants: Array<{ name: string; buf: Buffer; expected: number | 'exif_implied_see_note'; tag: number | 'none' }> = [
    { name: 'original_with_EXIF', buf: raw, expected: 'exif_implied_see_note', tag: exifTag ?? 'none' },
    { name: 'EXIF_stripped', buf: stripped, expected: 'exif_implied_see_note', tag: 'none' },
    { name: 'manual_upright', buf: upright, expected: 0, tag: 'none' },
  ]
  for (const rot of [0, 90, 180, 270] as const) {
    variants.push({
      name: `rot_${rot}`,
      buf: rot === 0 ? upright : await sharp(upright).rotate(rot).jpeg({ quality: 92 }).toBuffer(),
      expected: (360 - rot) % 360,
      tag: 'none',
    })
  }

  for (const v of variants) {
    let detected: Cw | null = null
    let error: string | undefined
    try {
      detected = await detectUprightCwVoted(v.buf, KEY, MODEL)
    } catch (e) {
      error = e instanceof Error ? e.message.slice(0, 120) : 'unknown'
    }
    const envelope = buildPostureEnvelope({
      exifOrientation: v.tag === 'none' ? null : v.tag,
      contentOrientRan: true,
      contentRotationCw: detected ?? 0,
      orientationUncertain: detected === null,
      inputFormat: 'full_page_image',
      cropSource: 'full_page',
    })
    const row: Row = {
      doc: d.id, variant: v.name, exif_tag_in_variant: v.tag,
      expected_correction_cw: v.expected,
      detected_cw: detected === null ? 'undecidable' : detected,
      orientation_correct: typeof v.expected === 'number'
        ? detected === v.expected
        : 'see_note',
      posture_gate: envelope.posture_gate,
      ...(error ? { error } : {}),
    }
    rows.push(row)
    console.log(JSON.stringify(row))
  }
  // note the EXIF-implied expectation for the two metadata variants, for the report
  console.log(JSON.stringify({ doc: d.id, note: 'exif_implied_correction_cw', value: exifToCw(exifTag) }))
}

const outDir = path.join(ROOT, 'apps/web/.harness')
await mkdir(outDir, { recursive: true })
await writeFile(path.join(outDir, 'posture-orientation-harness.json'), JSON.stringify(rows, null, 2))
const scored = rows.filter((r) => typeof r.expected_correction_cw === 'number')
const hits = scored.filter((r) => r.orientation_correct === true).length
console.log(`\nSUMMARY scored_variants=${scored.length} correct=${hits} (${((hits / Math.max(1, scored.length)) * 100).toFixed(0)}%) undecidable=${rows.filter((r) => r.detected_cw === 'undecidable').length} errors=${rows.filter((r) => r.error).length}`)
