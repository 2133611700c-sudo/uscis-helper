/**
 * Phase 0 GOLDEN BASELINE — ua_birth_certificate (mirror/translation pipeline).
 *
 * Captures the CURRENT deterministic output of the birth-cert pipeline BEFORE any
 * unified-contract rewiring (Phase 3 will make KEY_ALIASES / buildMirrorValues
 * derive from birthCertSovietV1Contract). These goldens are the byte-identity
 * oracle: after Phase 3 they MUST stay identical, or the change altered output.
 *
 * Four surfaces are pinned, all from a SINGLE stable, FICTIONAL fixture (no PII):
 *   1. extracted fields        — the fixed input (recorded for traceability)
 *   2. mirror/canonical values — buildMirrorValues(schema, fixture)
 *   3. review payload          — collectMirrorExtras + per-field review flags + unresolved[]
 *   4. PDF semantic content/order — group→field→label→value→state plan + PDF length/sha256
 *
 * The golden is an EXPLICIT committed JSON (not vitest toMatchSnapshot), compared
 * with toEqual. It is regenerated ONLY when WRITE_GOLDEN=1 is set — NEVER on a
 * failing run. A normal failure means real drift and must be investigated.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { getOfficialSchema } from '../../forms/ukraine/schemas/registry'
import { buildMirrorValues, collectMirrorExtras, type ExtractedFieldLite } from '../buildMirrorValues'
import { renderMirrorTranslationPDF } from '../renderMirrorTranslationPDF'

const DOC_TYPE = 'ua_birth_certificate'
const GOLDEN_PATH = join(__dirname, '__goldens__', 'birthCertMirror.phase0.golden.json')

// Stable FICTIONAL birth-cert extraction (privacy rule: synthetic only — Ivanenko,
// fictional series II-BK 530174). Exercises the live alias mappings:
//   child_family_name→child_surname, dob→date_of_birth,
//   place_of_birth_city→place_of_birth, issuing_authority→place_of_registration,
//   certificate_series_number→series_number. Covers clean / review-flagged / missing.
const FIXTURE: ExtractedFieldLite[] = [
  { field: 'child_family_name', value: 'Ivanenko', review_required: false },
  { field: 'child_given_name', value: 'Olha', review_required: false },
  { field: 'child_patronymic', value: 'Petrivna', review_required: true }, // review-flagged
  { field: 'dob', value: '1990-05-14', review_required: false },
  { field: 'place_of_birth_city', value: 'Vinnytsia', review_required: false },
  { field: 'father_full_name', value: 'Petro Ivanenko', review_required: false },
  // mother_full_name deliberately omitted → blank line
  { field: 'act_record_number', value: '84', review_required: false },
  { field: 'act_record_date', value: '1990-05-22', review_required: false },
  { field: 'issuing_authority', value: 'Trostianets District Civil Registry Office', review_required: false },
  { field: 'certificate_series_number', value: 'II-BK 530174', review_required: false },
  { field: 'date_of_issue', value: '1990-05-22', review_required: false },
]

// Pinned render opts so the PDF is byte-deterministic (proven by renderOfficialTranslationDeterminism).
const OPTS = {
  signerName: 'Ivan Ivanenko',
  signerAddress: '1213 Gordon St, Los Angeles, CA 90038',
  signedAt: '2026-05-30T00:00:00Z',
}

type ValueState = 'clean' | 'confirm' | 'blank'
interface PlanLine { group: string; key: string; label: string; value: string; state: ValueState }

function valueState(v: { value: string; review: boolean; canRead: boolean } | undefined): ValueState {
  if (v && v.canRead && v.value && !v.review) return 'clean'
  if (v && v.canRead && v.value) return 'confirm'
  return 'blank'
}

async function computeArtifacts() {
  const schema = getOfficialSchema(DOC_TYPE)
  if (!schema) throw new Error(`no official schema for ${DOC_TYPE}`)

  const mirrorValues = buildMirrorValues(schema, FIXTURE)
  const extras = collectMirrorExtras(schema, FIXTURE)

  // Render plan in the EXACT order renderOfficialTranslation iterates: unique
  // fieldGroup order, then fields within each group, then extras.
  const groups = [...new Set(schema.fields.map((f) => f.fieldGroup))]
  const renderPlan: PlanLine[] = []
  for (const g of groups) {
    for (const f of schema.fields.filter((x) => x.fieldGroup === g)) {
      const v = mirrorValues[f.key]
      const state = valueState(v)
      renderPlan.push({ group: g, key: f.key, label: f.sourceLabelEn, value: state === 'blank' ? '' : v.value, state })
    }
  }

  // Render twice → prove byte-determinism, and capture length + sha256.
  const r1 = await renderMirrorTranslationPDF(DOC_TYPE, FIXTURE, OPTS)
  const r2 = await renderMirrorTranslationPDF(DOC_TYPE, FIXTURE, OPTS)
  if (!r1 || !r2) throw new Error('mirror render returned null')
  const sha1 = createHash('sha256').update(r1.pdf).digest('hex')
  const sha2 = createHash('sha256').update(r2.pdf).digest('hex')

  return {
    docType: DOC_TYPE,
    extractedFields: FIXTURE,
    schemaFieldOrder: schema.fields.map((f) => f.key),
    mirrorValues,
    reviewPayload: {
      extras,
      unresolved: r1.unresolved,
      reviewFlaggedFields: Object.entries(mirrorValues).filter(([, v]) => v.review).map(([k]) => k),
    },
    pdf: { length: r1.pdf.length, sha256: sha1 },
    renderPlan,
    _determinism: { sha1, sha2 },
  }
}

describe('Phase 0 golden baseline — ua_birth_certificate mirror pipeline', () => {
  it('matches the committed golden (regenerate only with WRITE_GOLDEN=1)', async () => {
    const actual = await computeArtifacts()

    // Byte-determinism guard — must hold regardless of golden.
    expect(actual._determinism.sha1, 'PDF must render byte-identically twice').toBe(actual._determinism.sha2)

    const persist = { ...actual } as Record<string, unknown>
    delete persist._determinism

    if (process.env.WRITE_GOLDEN === '1') {
      writeFileSync(GOLDEN_PATH, JSON.stringify(persist, null, 2) + '\n', 'utf8')
      // eslint-disable-next-line no-console
      console.log(`[phase0] golden written → ${GOLDEN_PATH}`)
      return
    }

    expect(existsSync(GOLDEN_PATH), `golden missing — generate once with WRITE_GOLDEN=1`).toBe(true)
    const golden = JSON.parse(readFileSync(GOLDEN_PATH, 'utf8'))

    // Env-independent semantic surfaces (the Phase-3 oracle):
    expect(persist.extractedFields).toEqual(golden.extractedFields)
    expect(persist.schemaFieldOrder).toEqual(golden.schemaFieldOrder)
    expect(persist.mirrorValues).toEqual(golden.mirrorValues)
    expect(persist.reviewPayload).toEqual(golden.reviewPayload)
    expect(persist.renderPlan).toEqual(golden.renderPlan)
    // PDF bytes pinned for this lockfile/env:
    expect(persist.pdf).toEqual(golden.pdf)
  })

  it('the render plan order equals the real renderer unresolved set (plan is faithful)', async () => {
    const a = await computeArtifacts()
    const predictedUnresolved = a.renderPlan.filter((p) => p.state !== 'clean').map((p) => p.key)
    const schemaUnresolved = a.reviewPayload.unresolved.filter((k) => a.schemaFieldOrder.includes(k))
    expect(schemaUnresolved).toEqual(predictedUnresolved)
  })
})
