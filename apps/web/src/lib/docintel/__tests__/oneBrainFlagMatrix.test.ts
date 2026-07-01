/**
 * oneBrainFlagMatrix.test.ts — PIN the feature-flag mode MATRIX for the two
 * One-Brain recognition flags, so a hidden "new UI + old decision" combo (e.g.
 * evidence surfaced under a truthy-but-not-'1' value, or a mode nobody expected)
 * cannot appear silently.
 *
 * Two orthogonal flags govern the One-Brain recognition spine:
 *
 *   ONE_BRAIN_RECOGNIZE_ENABLED — the CUTOVER flag. When '1', a product route
 *     delegates recognition to recognizeDocument (STEP E). It is read ONLY by the
 *     helper isOneBrainRecognizeEnabled(); recognizeDocument itself NEVER reads it
 *     (the caller/route gates on it). So calling recognizeDocument with the flag
 *     absent must still run normally — the two are independent.
 *
 *   ONE_BRAIN_EVIDENCE_ENABLED — the VISUAL-EVIDENCE carriage flag. Read INSIDE
 *     recognizeDocument (recognizeDocument.ts ~line 114). When '1' AND the doc type
 *     has a FIELD_BOX_TEMPLATES entry, deterministic key-free TEMPLATE evidence is
 *     attached to candidates that arrive without provider geometry, so it rides the
 *     first-class candidate → arbitration → CanonicalField.visualEvidence → FieldOut
 *     path. OFF / non-'1' / no template → no evidence attached (byte-identical).
 *
 * BOTH flags use STRICT `=== '1'` semantics: 'true', '0', '' all read as OFF. This
 * matrix asserts that strictness at every layer we can reach at the unit level.
 *
 * All data is FICTIONAL. process.env is restored in afterEach.
 */
import { describe, it, expect, afterEach } from 'vitest'
import {
  isOneBrainRecognizeEnabled,
  recognizeDocument,
  type RecognizeInput,
} from '../recognizeDocument'
import type { ExtractedDocField, DocumentReadResult } from '../types'

const ORIGINAL_ENV = { ...process.env }

afterEach(() => {
  // Full restore: delete anything set during the test, then reapply the snapshot.
  for (const k of Object.keys(process.env)) {
    if (!(k in ORIGINAL_ENV)) delete process.env[k]
  }
  Object.assign(process.env, ORIGINAL_ENV)
})

/**
 * A FICTIONAL docintel field WITHOUT geometry (no evidenceRegions) — exactly what
 * the LLM reader produces. This is the case the ONE_BRAIN_EVIDENCE_ENABLED template
 * attach exists to fill.
 */
function fieldNoEvidence(field: string, value: string): ExtractedDocField {
  return {
    field,
    kind: 'name',
    raw_cyrillic: null,
    value,
    confidence: 0.9,
    review_required: false,
    source: 'vision',
    provider: 'test-stub',
    // evidenceRegions intentionally ABSENT (no localizing reader).
  }
}

/**
 * A stub reader matching the readDocument signature. Returns an ok read with the
 * given fields and NO provider geometry — so any visualEvidence that appears on the
 * canonical output must have come from the template attach, not the reader.
 */
function stubReader(
  fields: ExtractedDocField[],
): RecognizeInput['reader'] {
  return async (
    _buffer: Buffer,
    _mime: string,
    docTypeId: string,
  ): Promise<DocumentReadResult> => ({
    ok: true,
    doc_type_id: docTypeId,
    fields,
    anchor_read: true,
    provider: 'test-stub',
    model: 'test-stub-model',
    ms: 1,
    status: 'ok',
  })
}

function inputFor(
  docTypeId: string,
  fields: ExtractedDocField[],
): RecognizeInput {
  return {
    pages: [{ buffer: Buffer.from('fake'), mime: 'image/png' }],
    docTypeId,
    product: 'translation',
    reader: stubReader(fields),
    createdAt: '2026-06-30T00:00:00.000Z',
  }
}

/** Collect every visualEvidence array present on the canonical result's fields. */
function evidenceOnCanonical(
  result: Awaited<ReturnType<typeof recognizeDocument>>,
): unknown[] {
  const fields = result.canonicalResult?.fields ?? []
  return fields.flatMap((f) =>
    (f.visualEvidence?.length ?? 0) > 0 ? [f.visualEvidence] : [],
  )
}

describe('One-Brain flag matrix — isOneBrainRecognizeEnabled (cutover flag, strict === "1")', () => {
  it('absent env var → false', () => {
    expect(isOneBrainRecognizeEnabled({})).toBe(false)
  })

  it("'1' → true (the ONLY enabling value)", () => {
    expect(isOneBrainRecognizeEnabled({ ONE_BRAIN_RECOGNIZE_ENABLED: '1' })).toBe(true)
  })

  it("'true' → false (truthy string does NOT enable — guards the hidden-mode gap)", () => {
    expect(isOneBrainRecognizeEnabled({ ONE_BRAIN_RECOGNIZE_ENABLED: 'true' })).toBe(false)
  })

  it("'0' → false", () => {
    expect(isOneBrainRecognizeEnabled({ ONE_BRAIN_RECOGNIZE_ENABLED: '0' })).toBe(false)
  })

  it("'' (empty) → false", () => {
    expect(isOneBrainRecognizeEnabled({ ONE_BRAIN_RECOGNIZE_ENABLED: '' })).toBe(false)
  })

  it('reads process.env by default (no arg)', () => {
    delete process.env.ONE_BRAIN_RECOGNIZE_ENABLED
    expect(isOneBrainRecognizeEnabled()).toBe(false)
    process.env.ONE_BRAIN_RECOGNIZE_ENABLED = '1'
    expect(isOneBrainRecognizeEnabled()).toBe(true)
  })
})

describe('One-Brain flag matrix — ONE_BRAIN_EVIDENCE_ENABLED (template-attach, strict === "1")', () => {
  const BIRTH = 'ua_birth_certificate' // has a FIELD_BOX_TEMPLATES entry
  // family_name / given_name / patronymic are the templated keys for this doc type.
  const templatedFields = [
    fieldNoEvidence('family_name', 'Testenko'),
    fieldNoEvidence('given_name', 'Oleh'),
    fieldNoEvidence('patronymic', 'Ivanovych'),
  ]

  it('flag ABSENT → no visualEvidence attached (byte-identical path)', async () => {
    delete process.env.ONE_BRAIN_EVIDENCE_ENABLED
    const result = await recognizeDocument(inputFor(BIRTH, templatedFields))
    expect(result.status).toBe('ok')
    expect(evidenceOnCanonical(result)).toHaveLength(0)
  })

  it("flag 'true' → NOT enabled → no visualEvidence (truthy string must not silently enable)", async () => {
    process.env.ONE_BRAIN_EVIDENCE_ENABLED = 'true'
    const result = await recognizeDocument(inputFor(BIRTH, templatedFields))
    expect(result.status).toBe('ok')
    expect(evidenceOnCanonical(result)).toHaveLength(0)
  })

  it("flag '0' → NOT enabled → no visualEvidence", async () => {
    process.env.ONE_BRAIN_EVIDENCE_ENABLED = '0'
    const result = await recognizeDocument(inputFor(BIRTH, templatedFields))
    expect(evidenceOnCanonical(result)).toHaveLength(0)
  })

  it("flag '1' + doc type WITH a template → template regions ATTACHED to canonical fields", async () => {
    process.env.ONE_BRAIN_EVIDENCE_ENABLED = '1'
    const result = await recognizeDocument(inputFor(BIRTH, templatedFields))
    expect(result.status).toBe('ok')
    const evidences = evidenceOnCanonical(result)
    // At least one templated field carries attached geometry now.
    expect(evidences.length).toBeGreaterThan(0)
    // The attached regions are the deterministic 'approximate' / 'field_template' kind.
    const first = evidences[0] as Array<{ status: string; source: string }>
    expect(first[0].status).toBe('approximate')
    expect(first[0].source).toBe('field_template')
  })

  it("flag '1' + doc type WITHOUT a template → still no visualEvidence (no template to attach)", async () => {
    process.env.ONE_BRAIN_EVIDENCE_ENABLED = '1'
    // A doc type id that does NOT match any FIELD_BOX_TEMPLATES key.
    const result = await recognizeDocument(
      inputFor('ua_internal_passport_booklet', [fieldNoEvidence('family_name', 'Testenko')]),
    )
    expect(evidenceOnCanonical(result)).toHaveLength(0)
  })
})

describe('One-Brain flag matrix — ORTHOGONALITY (recognize flag ⟂ evidence flag)', () => {
  const BIRTH = 'ua_birth_certificate'
  const fields = [fieldNoEvidence('family_name', 'Testenko')]

  it('recognize flag ABSENT does not throw and returns a normal ok result (recognizeDocument never reads it)', async () => {
    delete process.env.ONE_BRAIN_RECOGNIZE_ENABLED
    delete process.env.ONE_BRAIN_EVIDENCE_ENABLED
    const result = await recognizeDocument(inputFor(BIRTH, fields))
    expect(result.status).toBe('ok')
    expect(result.canonicalResult).not.toBeNull()
    expect(result.candidateCount).toBe(1)
  })

  it('recognize flag OFF but evidence flag ON → evidence STILL attaches (flags are independent)', async () => {
    delete process.env.ONE_BRAIN_RECOGNIZE_ENABLED
    process.env.ONE_BRAIN_EVIDENCE_ENABLED = '1'
    const result = await recognizeDocument(inputFor(BIRTH, fields))
    expect(result.status).toBe('ok')
    // Evidence attach is governed ONLY by ONE_BRAIN_EVIDENCE_ENABLED, not the cutover flag.
    expect(evidenceOnCanonical(result).length).toBeGreaterThan(0)
  })

  it('recognize flag ON but evidence flag OFF → runs, NO evidence (the two never leak into each other)', async () => {
    process.env.ONE_BRAIN_RECOGNIZE_ENABLED = '1'
    delete process.env.ONE_BRAIN_EVIDENCE_ENABLED
    // isOneBrainRecognizeEnabled reports true (a route WOULD delegate)...
    expect(isOneBrainRecognizeEnabled()).toBe(true)
    // ...but recognizeDocument's own behavior is unaffected by that flag.
    const result = await recognizeDocument(inputFor(BIRTH, fields))
    expect(result.status).toBe('ok')
    expect(evidenceOnCanonical(result)).toHaveLength(0)
  })
})
