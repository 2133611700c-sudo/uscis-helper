/**
 * recognizeDocumentEvidenceProvider.test.ts — PROVE the injected EvidenceProvider seam
 * of recognizeDocument (One-Brain §7, STEP D evidence producer).
 *
 * The sibling oneBrainFlagMatrix.test.ts already pins the flag matrix for the *template*
 * evidence attach (the deterministic FIELD_BOX_TEMPLATES fallback). This file exercises
 * the ORTHOGONAL, higher-priority channel: the injectable `evidenceProvider` that LOCATES
 * already-read field values on the page BEFORE candidate conversion and populates
 * ExtractedDocField.evidenceRegions, which then rides
 *   ExtractedDocField.evidenceRegions → FieldCandidate.visualEvidence
 *   → (arbitration copies winner's regions) → CanonicalField.visualEvidence.
 *
 * Provider precedence (§12): provider geometry BEATS template — recognizeDocument's
 * template attach only fills candidates that arrived WITHOUT visualEvidence, so a field
 * the provider located keeps its 'ocr_token' region and never gets the 'field_template'
 * one. Provider disabled / unavailable / throwing → fields UNCHANGED → template fallback
 * (for a doc type that has one) still applies. Provider is EVIDENCE-ONLY: it never
 * touches the extracted VALUE, confidence, or reviewRequired (geometry never flips review).
 *
 * The provider under test is the REAL `ocrResultEvidenceProvider(fixtureOcr)` running the
 * REAL offline value→token localizer over a prerecorded OcrResult whose words match the
 * stub reader's field VALUES — the exact offline shape a live Google-Vision provider drops
 * into. ONE_BRAIN_EVIDENCE_ENABLED is the only flag that gates the provider call; it is
 * set/restored per test.
 *
 * All data is FICTIONAL (no real PII). process.env is restored in afterEach.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { recognizeDocument, type RecognizeInput } from '../recognizeDocument'
import type { ExtractedDocField, DocumentReadResult } from '../types'
import type { OcrResult, OcrWord } from '@/lib/ocr/types'
import {
  ocrResultEvidenceProvider,
  disabledEvidenceProvider,
  type EvidenceProvider,
} from '../evidence/evidenceProvider'
import type { CanonicalField } from '@/lib/canonical/types'
import type { EvidenceRegion } from '../evidence/EvidenceRegion'

const ORIGINAL_ENV = { ...process.env }

afterEach(() => {
  for (const k of Object.keys(process.env)) {
    if (!(k in ORIGINAL_ENV)) delete process.env[k]
  }
  Object.assign(process.env, ORIGINAL_ENV)
})

// ── Fixtures (FICTIONAL) ─────────────────────────────────────────────────────

const FAMILY = 'Testenko'
const GIVEN = 'Oleh'
const CONF = 0.87 // a distinctive, non-round confidence so we can assert it survives verbatim

/** LLM-style field: a value, NO geometry (evidenceRegions absent). */
function fieldNoEvidence(
  field: string,
  value: string,
  overrides: Partial<ExtractedDocField> = {},
): ExtractedDocField {
  return {
    field,
    kind: 'name',
    raw_cyrillic: null,
    value,
    confidence: CONF,
    review_required: false,
    source: 'vision',
    provider: 'test-stub',
    ...overrides,
    // evidenceRegions intentionally ABSENT — the provider (or template) is the only
    // possible source of geometry on the output.
  }
}

/** A single OCR word with a normalized bbox. */
function word(id: string, text: string, x: number, y: number): OcrWord {
  return {
    id,
    text,
    page: 1,
    bbox: { x, y, width: 0.1, height: 0.03 },
    confidence: 0.99,
    source: 'fixture_ocr',
  }
}

/**
 * A prerecorded OcrResult whose words include the given field VALUES as single tokens
 * at distinct positions. The offline localizer matches value→token case/space-insensitively,
 * so each value maps to exactly one word → an 'exact' / 'ocr_token' region at that word's bbox.
 * Extra decoy words make sure the localizer isn't just returning "the first box".
 */
function ocrFixture(words: OcrWord[]): OcrResult {
  const page = {
    page: 1,
    width: 1000,
    height: 1400,
    lines: [],
    words,
  }
  return {
    provider: 'fixture_ocr',
    raw_text: words.map((w) => w.text).join(' '),
    pages: [page],
    lines: [],
    words,
    processing_ms: 1,
    warnings: [],
    created_at: '2026-06-30T00:00:00.000Z',
  }
}

/** Stub reader (readDocument signature) → ok read with the given fields, NEVER any geometry. */
function stubReader(fields: ExtractedDocField[]): RecognizeInput['reader'] {
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
  evidenceProvider?: EvidenceProvider,
): RecognizeInput {
  return {
    pages: [{ buffer: Buffer.from('fake-image-bytes'), mime: 'image/png' }],
    docTypeId,
    product: 'translation',
    reader: stubReader(fields),
    ...(evidenceProvider ? { evidenceProvider } : {}),
    createdAt: '2026-06-30T00:00:00.000Z',
  }
}

/** Pull the canonical field by key. */
function fieldByKey(
  result: Awaited<ReturnType<typeof recognizeDocument>>,
  key: string,
): CanonicalField | undefined {
  return result.canonicalResult?.fields.find((f) => f.key === key)
}

/** All visualEvidence regions on a canonical field (flattened). */
function regionsOf(f: CanonicalField | undefined): EvidenceRegion[] {
  return f?.visualEvidence ?? []
}

// A doc type WITHOUT a FIELD_BOX_TEMPLATES entry (isolates the provider channel from the
// template fallback) and one WITH a template (ua_birth_certificate) for the precedence tests.
// AUDIT FIX (2026-07-06): this used to be 'ua_internal_passport_booklet', but a real
// FIELD_BOX_TEMPLATES entry was added for that doc type (crop-route root-cause fix), so it
// stopped being template-less and this file's isolation assumption silently broke — the
// tests here failed BEFORE this session's edits too (verified against HEAD 271325f). Picked
// 'ua_id_card' instead: it has a `family_name` field like the two doc types above, and has
// no FIELD_BOX_TEMPLATES entry (only ua_birth_certificate / ua_internal_passport_booklet do).
const NO_TEMPLATE_DOC = 'ua_id_card'
const BIRTH = 'ua_birth_certificate'

describe('recognizeDocument — injected EvidenceProvider (provider geometry channel)', () => {
  it('1. provider "available" → the field regions ride to canonicalResult.fields[].visualEvidence', async () => {
    process.env.ONE_BRAIN_EVIDENCE_ENABLED = '1'
    const provider = ocrResultEvidenceProvider(
      ocrFixture([word('w1', FAMILY, 0.23, 0.22)]),
    )
    const result = await recognizeDocument(
      inputFor(NO_TEMPLATE_DOC, [fieldNoEvidence('family_name', FAMILY)], provider),
    )
    expect(result.status).toBe('ok')
    const regions = regionsOf(fieldByKey(result, 'family_name'))
    expect(regions.length).toBeGreaterThan(0)
    // It is the provider's OCR-token geometry (not template / full_image).
    expect(regions[0].source).toBe('ocr_token')
    expect(regions[0].status).toBe('exact')
    expect(regions[0].bbox).not.toBeNull()
  })

  it('2. extracted VALUE is unchanged vs a run with the disabled provider', async () => {
    process.env.ONE_BRAIN_EVIDENCE_ENABLED = '1'
    const fields = () => [fieldNoEvidence('family_name', FAMILY)]
    const withProvider = await recognizeDocument(
      inputFor(NO_TEMPLATE_DOC, fields(), ocrResultEvidenceProvider(ocrFixture([word('w1', FAMILY, 0.23, 0.22)]))),
    )
    const withDisabled = await recognizeDocument(
      inputFor(NO_TEMPLATE_DOC, fields(), disabledEvidenceProvider),
    )
    const vWith = fieldByKey(withProvider, 'family_name')
    const vDisabled = fieldByKey(withDisabled, 'family_name')
    // Value identical; only presence of geometry differs.
    expect(vWith?.rawValue).toBe(vDisabled?.rawValue)
    expect(vWith?.normalizedValue).toBe(vDisabled?.normalizedValue)
    expect(vWith?.normalizedValue).toBe(FAMILY)
    // Sanity: the provider run DID add geometry, the disabled run did not.
    expect(regionsOf(vWith).length).toBeGreaterThan(0)
    expect(regionsOf(vDisabled)).toHaveLength(0)
  })

  it('3. confidence is unchanged by the provider', async () => {
    process.env.ONE_BRAIN_EVIDENCE_ENABLED = '1'
    const withProvider = await recognizeDocument(
      inputFor(NO_TEMPLATE_DOC, [fieldNoEvidence('family_name', FAMILY)],
        ocrResultEvidenceProvider(ocrFixture([word('w1', FAMILY, 0.23, 0.22)]))),
    )
    const withDisabled = await recognizeDocument(
      inputFor(NO_TEMPLATE_DOC, [fieldNoEvidence('family_name', FAMILY)], disabledEvidenceProvider),
    )
    const cWith = fieldByKey(withProvider, 'family_name')?.confidence.final
    const cDisabled = fieldByKey(withDisabled, 'family_name')?.confidence.final
    expect(cWith).toBe(cDisabled)
    // And it reflects the reader's own confidence (never a geometry-derived number).
    expect(cWith).toBe(CONF)
  })

  it('4. reviewRequired is unchanged (geometry never flips review) — parity provider vs disabled', async () => {
    process.env.ONE_BRAIN_EVIDENCE_ENABLED = '1'
    const fields = [
      // family_name is a CRITICAL field → arbitration forces review for a non-MRZ read
      // ('critical_no_mrz_anchor'), regardless of geometry — a good control.
      fieldNoEvidence('family_name', FAMILY),
      // given_name explicitly flagged by the reader.
      fieldNoEvidence('given_name', GIVEN, {
        review_required: true,
        review_reasons: ['source_script_ambiguous'],
      }),
    ]
    const ocr = ocrFixture([word('w1', FAMILY, 0.23, 0.22), word('w2', GIVEN, 0.13, 0.29)])
    const withProvider = await recognizeDocument(
      inputFor(NO_TEMPLATE_DOC, fields.map((f) => ({ ...f })), ocrResultEvidenceProvider(ocr)),
    )
    const withDisabled = await recognizeDocument(
      inputFor(NO_TEMPLATE_DOC, fields.map((f) => ({ ...f })), disabledEvidenceProvider),
    )
    // THE INVARIANT: whatever review state arbitration assigns, adding provider geometry
    // does NOT change it for ANY field (§10 honesty — a box is never a quality signal).
    for (const key of ['family_name', 'given_name']) {
      expect(fieldByKey(withProvider, key)?.reviewRequired).toBe(
        fieldByKey(withDisabled, key)?.reviewRequired,
      )
      // The review REASONS are identical too — geometry adds no reason and drops none.
      expect(fieldByKey(withProvider, key)?.reviewReasons).toEqual(
        fieldByKey(withDisabled, key)?.reviewReasons,
      )
    }
    // Sanity: the reader-flagged field is indeed still flagged under the provider run,
    // and the provider genuinely attached geometry to it (so we know review survived
    // DESPITE geometry, not because geometry was absent).
    expect(fieldByKey(withProvider, 'given_name')?.reviewRequired).toBe(true)
    expect(regionsOf(fieldByKey(withProvider, 'given_name')).length).toBeGreaterThan(0)
    // Document-level requiresReview also matches.
    expect(withProvider.canonicalResult?.requiresReview).toBe(
      withDisabled.canonicalResult?.requiresReview,
    )
  })

  it('5. provider evidence BEATS template — birth cert family_name gets ocr_token, not field_template', async () => {
    process.env.ONE_BRAIN_EVIDENCE_ENABLED = '1'
    // ua_birth_certificate HAS a template for family_name/given_name/patronymic.
    // The provider locates ONLY family_name → that field must keep the provider region.
    const provider = ocrResultEvidenceProvider(ocrFixture([word('w1', FAMILY, 0.30, 0.24)]))
    const result = await recognizeDocument(
      inputFor(
        BIRTH,
        [
          fieldNoEvidence('family_name', FAMILY),
          fieldNoEvidence('given_name', GIVEN), // provider does NOT locate this one
        ],
        provider,
      ),
    )
    const famRegions = regionsOf(fieldByKey(result, 'family_name'))
    expect(famRegions.length).toBeGreaterThan(0)
    // Precedence: provider geometry, NOT the template that also exists for this key.
    expect(famRegions.every((r) => r.source === 'ocr_token')).toBe(true)
    expect(famRegions.some((r) => r.source === 'field_template')).toBe(false)
    // given_name, not located by the provider, falls back to the template for this doc type.
    const givenRegions = regionsOf(fieldByKey(result, 'given_name'))
    expect(givenRegions.length).toBeGreaterThan(0)
    expect(givenRegions.every((r) => r.source === 'field_template')).toBe(true)
  })

  it('6. provider absent (disabled) + birth cert → TEMPLATE evidence still applied (fallback)', async () => {
    process.env.ONE_BRAIN_EVIDENCE_ENABLED = '1'
    const result = await recognizeDocument(
      inputFor(
        BIRTH,
        [fieldNoEvidence('family_name', FAMILY), fieldNoEvidence('given_name', GIVEN)],
        disabledEvidenceProvider,
      ),
    )
    const famRegions = regionsOf(fieldByKey(result, 'family_name'))
    expect(famRegions.length).toBeGreaterThan(0)
    // No provider → deterministic template geometry fills in.
    expect(famRegions.every((r) => r.source === 'field_template')).toBe(true)
    expect(famRegions[0].status).toBe('approximate')
  })

  it('7. provider "unavailable" (reason: provider_error) → fields kept, template fallback applies', async () => {
    process.env.ONE_BRAIN_EVIDENCE_ENABLED = '1'
    const erroringProvider: EvidenceProvider = {
      async locateEvidence() {
        return { status: 'unavailable', reason: 'provider_error' }
      },
    }
    const result = await recognizeDocument(
      inputFor(BIRTH, [fieldNoEvidence('family_name', FAMILY)], erroringProvider),
    )
    const fam = fieldByKey(result, 'family_name')
    // Value preserved (unavailable never harms extraction).
    expect(fam?.normalizedValue).toBe(FAMILY)
    // Geometry falls back to the template (no provider region present).
    const regions = regionsOf(fam)
    expect(regions.length).toBeGreaterThan(0)
    expect(regions.every((r) => r.source === 'field_template')).toBe(true)
  })

  it('8. provider that THROWS → recognizeDocument does not throw; fields preserved', async () => {
    process.env.ONE_BRAIN_EVIDENCE_ENABLED = '1'
    const throwingProvider: EvidenceProvider = {
      async locateEvidence() {
        throw new Error('simulated provider crash (network/credentials)')
      },
    }
    // NO_TEMPLATE_DOC isolates: no template to mask a leak; the field must simply survive.
    const result = await recognizeDocument(
      inputFor(NO_TEMPLATE_DOC, [fieldNoEvidence('family_name', FAMILY)], throwingProvider),
    )
    expect(result.status).toBe('ok')
    const fam = fieldByKey(result, 'family_name')
    expect(fam?.normalizedValue).toBe(FAMILY)
    expect(fam?.confidence.final).toBe(CONF)
    // Provider threw → fields returned unchanged → no geometry (and no template for this doc).
    expect(regionsOf(fam)).toHaveLength(0)
  })

  it('9. multiple fields map independently (family_name region ≠ given_name region)', async () => {
    process.env.ONE_BRAIN_EVIDENCE_ENABLED = '1'
    // Distinct positions so the two regions must differ.
    const provider = ocrResultEvidenceProvider(
      ocrFixture([
        word('w1', FAMILY, 0.23, 0.22),
        word('w-decoy', 'Irrelevant', 0.80, 0.80),
        word('w2', GIVEN, 0.13, 0.55),
      ]),
    )
    const result = await recognizeDocument(
      inputFor(
        NO_TEMPLATE_DOC,
        [fieldNoEvidence('family_name', FAMILY), fieldNoEvidence('given_name', GIVEN)],
        provider,
      ),
    )
    const famRegions = regionsOf(fieldByKey(result, 'family_name'))
    const givenRegions = regionsOf(fieldByKey(result, 'given_name'))
    expect(famRegions.length).toBe(1)
    expect(givenRegions.length).toBe(1)
    // Each region carries its own fieldKey and its OWN distinct bbox.
    expect(famRegions[0].fieldKey).toBe('family_name')
    expect(givenRegions[0].fieldKey).toBe('given_name')
    expect(famRegions[0].bbox).not.toBeNull()
    expect(givenRegions[0].bbox).not.toBeNull()
    expect(famRegions[0].bbox).not.toEqual(givenRegions[0].bbox)
    // The family region sits at the family word's y (0.22), the given region at 0.55 — proof
    // the localizer matched by VALUE, not position.
    expect(famRegions[0].bbox![1]).toBeCloseTo(0.22, 5)
    expect(givenRegions[0].bbox![1]).toBeCloseTo(0.55, 5)
  })

  it('10. a region for one field does NOT leak into another field', async () => {
    process.env.ONE_BRAIN_EVIDENCE_ENABLED = '1'
    // Provider fixture only contains family_name's value. given_name is present as an
    // extracted field but has NO matching OCR token → it must receive NO provider region.
    const provider = ocrResultEvidenceProvider(ocrFixture([word('w1', FAMILY, 0.23, 0.22)]))
    const result = await recognizeDocument(
      inputFor(
        NO_TEMPLATE_DOC, // no template, so given_name can't be filled by fallback either
        [fieldNoEvidence('family_name', FAMILY), fieldNoEvidence('given_name', GIVEN)],
        provider,
      ),
    )
    const famRegions = regionsOf(fieldByKey(result, 'family_name'))
    const givenRegions = regionsOf(fieldByKey(result, 'given_name'))
    // family_name located; given_name NOT located and has no template → empty.
    expect(famRegions.length).toBe(1)
    expect(famRegions[0].fieldKey).toBe('family_name')
    expect(givenRegions).toHaveLength(0)
    // Belt-and-braces: no region anywhere in the result claims to locate given_name.
    const allRegions = (result.canonicalResult?.fields ?? []).flatMap((f) => f.visualEvidence ?? [])
    expect(allRegions.some((r) => r.fieldKey === 'given_name')).toBe(false)
  })
})
