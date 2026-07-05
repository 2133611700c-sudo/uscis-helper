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

/**
 * visualUprightCw = CW correction that makes the RAW PIXELS upright, established by direct
 * VISUAL inspection (owner law: verify visually, never trust metadata). Measured 2026-07-05:
 * lying EXIF found on birth_cert_handwritten_01 (tag 6, raw upright) AND military_id_p2_01
 * (tag 3, raw upright); military_id_p1_01 tag 6 is truthful (raw needs 90 CW).
 * Run 2 (RUN_SET=extended) covers the remaining unique real docs; birth_cert_soviet_01 is a
 * byte-duplicate of birth_cert_handwritten_01 (gt._meta.duplicate_of) — dedup law: not re-run.
 */
const DOCS_CORE: Array<{ id: string; file: string; docTypeId: string; visualUprightCw: Cw }> = [
  { id: 'birth_cert_handwritten_01', file: 'birth_cert_handwritten_01.jpg', docTypeId: 'ua_birth_certificate', visualUprightCw: 0 },
  { id: 'military_id_p1_01', file: 'military_id_p1_01.jpg', docTypeId: 'ua_military_id', visualUprightCw: 90 },
  { id: 'internal_passport_01', file: 'internal_passport_01.jpg', docTypeId: 'ua_internal_passport_booklet', visualUprightCw: 0 },
]
const DOCS_EXTENDED: typeof DOCS_CORE = [
  { id: 'military_id_p2_01', file: 'military_id_p2_01.jpg', docTypeId: 'ua_military_id', visualUprightCw: 0 }, // EXIF 3 LIES
  { id: 'marriage_1939_kharkiv_borodavka', file: 'marriage_1939_kharkiv_borodavka.jpg', docTypeId: 'ua_marriage_certificate', visualUprightCw: 0 },
  { id: 'marriage_apostille_vasylsiuk', file: 'marriage_apostille_vasylsiuk.jpg', docTypeId: 'ua_marriage_certificate', visualUprightCw: 0 },
  { id: 'marriage_repeat_johnson_kvasnikova', file: 'marriage_repeat_johnson_kvasnikova.jpg', docTypeId: 'ua_marriage_certificate', visualUprightCw: 0 },
  { id: 'marriage_zastavnyi_kovshirina', file: 'marriage_zastavnyi_kovshirina.webp', docTypeId: 'ua_marriage_certificate', visualUprightCw: 0 },
  { id: 'divorce_redacted_pechersk', file: 'divorce_redacted_pechersk.jpg', docTypeId: 'ua_divorce_certificate', visualUprightCw: 0 },
  { id: 'divorce_blank_template', file: 'divorce_blank_template.jpg', docTypeId: 'ua_divorce_certificate', visualUprightCw: 0 },
]
const DOCS = process.env.RUN_SET === 'extended' ? DOCS_EXTENDED : DOCS_CORE
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
  // VISUAL-upright base (oracle-corrected raw pixels, EXIF ignored/dropped) — run 2 scores
  // against this, never against metadata. jpeg re-encode drops the EXIF tag.
  const upright = d.visualUprightCw === 0
    ? await sharp(raw, { autoOrient: false } as never).jpeg({ quality: 92 }).toBuffer()
    : await sharp(raw, { autoOrient: false } as never).rotate(d.visualUprightCw).jpeg({ quality: 92 }).toBuffer()

  const variants: Array<{ name: string; buf: Buffer; expected: number | 'exif_implied_see_note'; tag: number | 'none' }> = []
  // Metadata variants only carry information when a tag exists AND could disagree with pixels
  // (cost-efficiency: for tagless docs original === EXIF_stripped === rot_0 pixel-wise).
  if (exifTag !== undefined && exifTag !== 1) {
    variants.push({ name: 'original_with_EXIF', buf: raw, expected: d.visualUprightCw, tag: exifTag })
  }
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
      detected = await detectUprightCwVoted(v.buf, KEY, MODEL, { docTypeId: d.docTypeId })
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
await writeFile(path.join(outDir, `posture-orientation-harness${process.env.RUN_SET === 'extended' ? '-extended' : ''}.json`), JSON.stringify(rows, null, 2))
const scored = rows.filter((r) => typeof r.expected_correction_cw === 'number')
const hits = scored.filter((r) => r.orientation_correct === true).length
console.log(`\nSUMMARY scored_variants=${scored.length} correct=${hits} (${((hits / Math.max(1, scored.length)) * 100).toFixed(0)}%) undecidable=${rows.filter((r) => r.detected_cw === 'undecidable').length} errors=${rows.filter((r) => r.error).length}`)
