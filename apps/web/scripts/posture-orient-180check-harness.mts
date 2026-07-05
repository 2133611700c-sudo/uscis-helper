/**
 * POSTURE ENVELOPE — ORIENT_180_CHECK exit-criterion harness (owner patch 2026-07-05).
 *
 * Exit criterion from HANDWRITTEN_CYRILLIC_ONE_BRAIN_PLAN.md / master plan P1:
 *   wrong_rotation_auto_applied = 0 on the fixture matrix, with ORIENT_180_CHECK=1 vs OFF.
 *
 * Unlike posture-orientation-harness.mts (which calls the raw 4-cell detector
 * `detectUprightCwVoted` directly), this drives the FULL production `orientToUpright`
 * pipeline — 4-cell vote + (when enabled) the binary 180° confirm pass — so it measures
 * the actual end-to-end behavior a real document would get, both with the flag OFF
 * (baseline, must stay byte-identical to the historical 43/50 measurement) and ON
 * (the fix under test).
 *
 * Reuses the SAME 10 unique real docs + rot_0/90/180/270 variants as the existing harness
 * (dedup law: birth_cert_soviet_01 excluded as a byte-duplicate; original_with_EXIF variants
 * excluded here — this run isolates the 180°-confusion failure class specifically, which was
 * measured ONLY on the rot-matrix, never on the original_with_EXIF/manual_upright variants).
 *
 * PAIRED SAME-SESSION DESIGN (audit correction 2026-07-05): both flag=off and flag=on run
 * back-to-back per variant in THIS process, rather than comparing against the older
 * posture-orientation-harness.json. The 4-cell VLM detector is known run-to-run unstable
 * (documented elsewhere in this repo); an early attempt to diff against the historical JSON
 * showed an implausible 270 degree-offset regression on one document that vanished on rerun —
 * i.e. day-to-day model drift, not a real regression. Pairing both arms in one session isolates
 * the flag's actual effect from that drift.
 *
 * Run: pnpm exec tsx scripts/posture-orient-180check-harness.mts   (from apps/web)
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
type Cw = 0 | 90 | 180 | 270
const orientMod = await import('../src/lib/docintel/orientation/detectOrientation')
const { orientToUpright } = ((orientMod as { default?: unknown }).default ?? orientMod) as typeof import('../src/lib/docintel/orientation/detectOrientation')

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

const DOCS: Array<{ id: string; file: string; visualUprightCw: Cw }> = [
  { id: 'birth_cert_handwritten_01', file: 'birth_cert_handwritten_01.jpg', visualUprightCw: 0 },
  { id: 'military_id_p1_01', file: 'military_id_p1_01.jpg', visualUprightCw: 90 },
  { id: 'internal_passport_01', file: 'internal_passport_01.jpg', visualUprightCw: 0 },
  { id: 'military_id_p2_01', file: 'military_id_p2_01.jpg', visualUprightCw: 0 },
  { id: 'marriage_1939_kharkiv_borodavka', file: 'marriage_1939_kharkiv_borodavka.jpg', visualUprightCw: 0 },
  { id: 'marriage_apostille_vasylsiuk', file: 'marriage_apostille_vasylsiuk.jpg', visualUprightCw: 0 },
  { id: 'marriage_repeat_johnson_kvasnikova', file: 'marriage_repeat_johnson_kvasnikova.jpg', visualUprightCw: 0 },
  { id: 'marriage_zastavnyi_kovshirina', file: 'marriage_zastavnyi_kovshirina.webp', visualUprightCw: 0 },
  { id: 'divorce_redacted_pechersk', file: 'divorce_redacted_pechersk.jpg', visualUprightCw: 0 },
  { id: 'divorce_blank_template', file: 'divorce_blank_template.jpg', visualUprightCw: 0 },
]

interface Row {
  doc: string; variant: string; flag180: 'off' | 'on'
  expected_correction_cw: number; detected_cw: number | 'undecidable'
  correct: boolean; disambiguated180: boolean
}
const rows: Row[] = []

for (const d of DOCS) {
  const raw = await readFile(path.join(ROOT, 'test-fixtures/real-docs', d.file))
  const upright = d.visualUprightCw === 0
    ? await sharp(raw, { autoOrient: false } as never).jpeg({ quality: 92 }).toBuffer()
    : await sharp(raw, { autoOrient: false } as never).rotate(d.visualUprightCw).jpeg({ quality: 92 }).toBuffer()

  for (const rot of [0, 90, 180, 270] as const) {
    const buf = rot === 0 ? upright : await sharp(upright).rotate(rot).jpeg({ quality: 92 }).toBuffer()
    const expected = (360 - rot) % 360

    // Paired same-session comparison (audit correction 2026-07-05): the live 4-cell VLM
    // detector is known-unstable run-to-run (documented elsewhere in this repo). Comparing
    // against a JSON file captured hours/days earlier confounds detector drift with the
    // flag's actual effect. Both arms below run back-to-back in THIS process so any
    // difference is attributable to ORIENT_180_CHECK, not to day-to-day model variance.
    for (const flag of ['off', 'on'] as const) {
      if (flag === 'on') process.env.ORIENT_180_CHECK = '1'
      else delete process.env.ORIENT_180_CHECK
      const out = await orientToUpright(buf, KEY, MODEL)
      const row: Row = {
        doc: d.id, variant: `rot_${rot}`, flag180: flag,
        expected_correction_cw: expected,
        detected_cw: out.detected ? out.applied : 'undecidable',
        correct: out.detected && out.applied === expected,
        disambiguated180: out.disambiguated180 === true,
      }
      rows.push(row)
      console.log(JSON.stringify(row))
    }
  }
}

const outDir = path.join(ROOT, 'apps/web/.harness')
await mkdir(outDir, { recursive: true })
await writeFile(path.join(outDir, 'posture-orient-180check-harness.json'), JSON.stringify(rows, null, 2))

for (const flag of ['off', 'on'] as const) {
  const scoped = rows.filter((r) => r.flag180 === flag)
  const correct = scoped.filter((r) => r.correct).length
  const wrongAutoApplied = scoped.filter((r) => !r.correct && r.detected_cw !== 'undecidable').length
  const undecidable = scoped.filter((r) => r.detected_cw === 'undecidable').length
  const disambiguated = scoped.filter((r) => r.disambiguated180).length
  console.log(`\nSUMMARY flag180=${flag} n=${scoped.length} correct=${correct} wrong_rotation_auto_applied=${wrongAutoApplied} undecidable=${undecidable} disambiguated180_fired=${disambiguated}`)
}
