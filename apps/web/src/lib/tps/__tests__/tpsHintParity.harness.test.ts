/**
 * tpsHintParity.harness.test.ts — One-Brain v2 Phase 2 flip-gate evidence.
 *
 * PER-HINT PARITY HARNESS for the TPS_CORE_HINTS allowlist (tpsAdapter.ts):
 * before a hint ('i94', 'ead') may be flipped from the legacy OCR module to the
 * Core path, this harness proves (or documents the exact gaps in) contract
 * compatibility between:
 *
 *   LEGACY:  runI94Module / runEadModule (OcrResult fixture → TpsModuleResult)
 *   CORE:    docintel reader fields (per us_i94 / us_ead registry spec)
 *            → docintelToCandidate → applyKnowledgeBrainIfEnabled(arbitrateDocument)
 *            → canonicalToTpsModuleResult (TpsModuleResult)
 *
 * This is exactly the Core chain the route runs at flag-OFF recognition
 * (apps/web/src/app/api/tps/ocr/extract/route.ts lines ~339-358), minus the
 * paid readDocument() call — reader fields are constructed from the registry
 * spec, so NO network / NO provider key is needed (mock at the reader boundary,
 * same as the legacy modules' own tests mock at the OcrResult boundary).
 *
 * HONESTY NOTE (contract parity, not pixel parity): the legacy modules take an
 * OcrResult (text lines); the Core reader takes an image. The two cannot be fed
 * the literal same input, so this harness drives each side with its OWN
 * fixture describing the SAME fictional document, and asserts CONTRACT parity:
 * field-name coverage (A), value equality after trivial normalization (B), and
 * review semantics (C). All data is FICTIONAL (no real PII).
 *
 * ── EXPLICIT KEY-MAPPING TABLE (the contract this harness establishes) ──────
 * Core (docintel registry key)  →  Legacy/TPS-consumed key    | authority
 *   i94_admission_number        →  i94_admission_number       | identical
 *   i94_class_of_admission      →  i94_class_of_admission     | identical
 *   i94_date_of_entry           →  last_entry_date            | KEY_ALIASES (canonical/core/keyAliases.ts)
 *   i94_place_of_entry          →  place_of_last_entry        | established HERE (mechanical: same fact, "Port of Entry")
 *   date_of_birth               →  dob                        | KEY_ALIASES
 *   family_name                 →  family_name                | identical
 *   given_name                  →  given_name                 | identical
 *   a_number                    →  a_number                   | identical
 *   ead_category                →  ead_category_on_card       | established HERE (mechanical: card "Category" line)
 *   ead_validity_to             →  ead_expiration_date        | established HERE (mechanical: card "Card Expires" line)
 *   (no core key)               →  i94_admit_until            | ❌ GAP — us_i94 spec has NO admit-until field
 *   (no core key)               →  country_of_citizenship     | ❌ GAP — us_i94 spec has country_of_birth, which is a
 *                                                             |   DIFFERENT fact (KEY_ALIASES maps it to place_of_birth,
 *                                                             |   NOT citizenship) — must not be conflated
 *
 * KNOWN REAL GAPS kept visible via it.fails() (the point of this harness):
 *   G1 (i94): Core cannot produce i94_admit_until — documentContracts.ts calls it
 *       "critical for TPS" (status-window decision). Registry spec must add it before flip.
 *   G2 (i94): Core cannot produce country_of_citizenship (allowed + consumed on the i94 slot).
 *   G3 (both): NOTHING translates Core registry keys → legacy keys between
 *       canonicalToTpsModuleResult (passes f.key through verbatim) and the
 *       applyContract firewall (exact-key match, no aliasing) or
 *       postExtractNormalize (keys on 'dob'/'last_entry_date'/'ead_expiration_date').
 *       The passport flip worked ONLY because the ua_international_passport spec
 *       already uses the legacy keys. us_i94/us_ead specs do NOT.
 *   G4 (i94): i94_admission_number has criticality 'low' in canonical/policy.ts,
 *       so a LOW-CONFIDENCE Core read of it sails through unreviewed, while the
 *       legacy module's uncertain path (unlabelled fallback) forces review.
 *   G5 (i94, surface form only): the Core D2 knowledge layer rewrites values of keys
 *       containing 'date'/'dob' from ISO → USCIS MM/DD/YYYY (knowledgeNormalize.ts
 *       'date.iso_to_uscis'), while legacy modules emit ISO. Affects i94_date_of_entry
 *       and date_of_birth; ead_validity_to/_from escape (no 'date' in the key) and stay
 *       ISO. Downstream postExtractNormalize.ts (lines ~199-208) repairs US→ISO as
 *       PRODUCT_FORMATTING_ONLY — but it keys on the LEGACY names
 *       ('dob'/'last_entry_date'/'ead_expiration_date'), so the repair only reaches
 *       Core fields AFTER the G3 key translation is fixed. Same instant, different
 *       surface — the value-parity comparator below applies exactly that downstream
 *       US→ISO transform, and the B2 tests pin the raw surface behavior per hint.
 *
 * VERDICTS (as of this harness): i94 = GAPS (G1, G2, G3, G4, G5); ead = GAPS (G3 only —
 * field coverage + semantic values + date surface are at parity under the mapping table).
 */
import { describe, expect, it } from 'vitest'
import type { OcrResult } from '@/lib/ocr/types'
import type { ExtractedDocField } from '@/lib/docintel/types'
import type { TpsModuleResult } from '@/lib/tps/types'
import { runI94Module } from '@/lib/tps/modules/i94'
import { runEadModule } from '@/lib/tps/modules/ead'
import { getDocTypeSpec } from '@/lib/docintel/documentRegistry'
import { docintelToCandidate } from '@/lib/canonical/core/translationAdapter'
import { applyKnowledgeBrainIfEnabled, buildKnowledgeContext } from '@/lib/canonical/core/knowledgeBrain'
import { canonicalToTpsModuleResult, mapTpsHintToDocintelId } from '@/lib/canonical/core/tpsAdapter'
import { applyContract } from '@/lib/tps/ocr/documentContracts'

// ─────────────────────────────────────────────────────────────────────────────
// Explicit key mapping: Core (docintel registry) key → legacy/TPS-consumed key.
// THIS IS THE CONTRACT. Identical keys are listed too so the table is complete
// and a registry rename breaks the test loudly.
// ─────────────────────────────────────────────────────────────────────────────
const CORE_TO_LEGACY_I94: Record<string, string> = {
  i94_admission_number: 'i94_admission_number',
  i94_class_of_admission: 'i94_class_of_admission',
  i94_date_of_entry: 'last_entry_date', // KEY_ALIASES
  i94_place_of_entry: 'place_of_last_entry', // established here (same fact: Port of Entry)
  date_of_birth: 'dob', // KEY_ALIASES
  family_name: 'family_name',
  given_name: 'given_name',
  // country_of_birth deliberately NOT mapped to country_of_citizenship:
  // birth country ≠ citizenship country (KEY_ALIASES: country_of_birth → place_of_birth).
}

const CORE_TO_LEGACY_EAD: Record<string, string> = {
  a_number: 'a_number',
  ead_category: 'ead_category_on_card', // established here (card "Category")
  ead_validity_to: 'ead_expiration_date', // established here (card "Card Expires")
  family_name: 'family_name',
  given_name: 'given_name',
  // card_number / ead_validity_from / country_of_birth: Core surplus — the legacy
  // module never emits them; harmless extra facts, not a parity concern.
}

// ── FICTIONAL person/doc data (NO real PII — memory rule) ───────────────────
const FICTIONAL = {
  family: 'TESTENKO',
  given: 'FICTIONA',
  dobIso: '1990-01-01',
  dobUs: '01/01/1990',
  i94Number: '12345678901', // legacy 11-digit CBP format, fictional
  classOfAdmission: 'UH',
  entryIso: '2024-03-15',
  entryUs: '03/15/2024',
  admitUntilIso: '2026-04-11',
  admitUntilUs: '04/11/2026',
  port: 'LOS ANGELES, CA',
  aNumber: '123456789',
  eadCategory: 'C11',
  cardNumber: 'MSC1234567890',
  eadValidFromIso: '2026-01-15',
  eadExpiresIso: '2028-01-15', // FUTURE date — avoids the legacy ead_expired review path
  eadExpiresUs: '01/15/2028',
}

// ── Legacy driver: OcrResult fixture builder (copied from modules/__tests__/i94.test.ts) ──
function mkOcr(lines: string[]): OcrResult {
  return {
    created_at: new Date().toISOString(),
    provider: 'google_vision',
    raw_text: lines.join('\n'),
    pages: [{ page: 1, width: 1000, height: 1000, lines: [], words: [] }],
    words: [],
    lines: lines.map((text, i) => ({
      id: `l_${i}`,
      text,
      page: 1,
      bbox: { x: 0.1, y: 0.1 + i * 0.05, width: 0.6, height: 0.03 },
      words: [],
      confidence: 0.95,
      source: 'google_vision',
    })),
    processing_ms: 10,
    warnings: [],
  }
}

/** Fictional CBP I-94 printout — labels straight from the legacy module's anchors. */
function legacyI94Result(): TpsModuleResult {
  const ocr = mkOcr([
    'Admission (I-94) Number',
    FICTIONAL.i94Number,
    'Last/Surname',
    FICTIONAL.family,
    'First (Given) Name',
    FICTIONAL.given,
    'Date of Birth',
    FICTIONAL.dobUs,
    'Country of Citizenship',
    'UKRAINE',
    'Class of Admission',
    FICTIONAL.classOfAdmission,
    'Most Recent Date of Entry',
    FICTIONAL.entryUs,
    'Admit Until Date',
    FICTIONAL.admitUntilUs,
    'Port of Entry',
    FICTIONAL.port,
  ])
  return runI94Module(ocr, { document_id: 'doc_parity_i94_legacy' })
}

/** Fictional EAD card front — labels straight from the legacy module's anchors. */
function legacyEadResult(): TpsModuleResult {
  const ocr = mkOcr([
    'USCIS# ' + FICTIONAL.aNumber,
    'Category',
    FICTIONAL.eadCategory,
    'Card Expires',
    FICTIONAL.eadExpiresUs,
    'Surname/Last Name',
    FICTIONAL.family,
    'Given Name',
    FICTIONAL.given,
  ])
  return runEadModule(ocr, { document_id: 'doc_parity_ead_legacy' })
}

// ── Core driver: registry-spec reader fields → the route's exact Core chain ──
interface CoreOverride {
  confidence?: number
  review_required?: boolean
  review_reasons?: string[]
}

/**
 * Build docintel reader fields FROM the registry spec (so a spec change breaks
 * this test loudly), then run the exact flag-OFF Core chain from the route:
 * docintelToCandidate → applyKnowledgeBrainIfEnabled → canonicalToTpsModuleResult.
 */
function runCoreChain(
  docintelId: 'us_i94' | 'us_ead',
  hint: string,
  values: Record<string, string>,
  perFieldOverride: Record<string, CoreOverride> = {},
): TpsModuleResult {
  const spec = getDocTypeSpec(docintelId)
  if (!spec) throw new Error(`registry spec missing for ${docintelId}`)
  // Guard: every fixture value must be a key the registry spec declares —
  // otherwise the harness would be "proving" coverage the reader can't deliver.
  const specKeys = new Set(spec.fields.map((f) => f.field))
  for (const k of Object.keys(values)) {
    if (!specKeys.has(k)) throw new Error(`fixture key '${k}' not in ${docintelId} registry spec`)
  }
  const readerFields: ExtractedDocField[] = spec.fields
    .filter((f) => values[f.field] !== undefined)
    .map((f) => {
      const o = perFieldOverride[f.field] ?? {}
      return {
        field: f.field,
        kind: f.kind,
        raw_cyrillic: null, // US docs are Latin-only
        value: values[f.field],
        confidence: o.confidence ?? 0.95,
        review_required: o.review_required ?? false,
        source: 'vision' as const,
        provider: 'gemini-parity-fixture',
        ...(o.review_reasons ? { review_reasons: o.review_reasons } : {}),
      }
    })
  const candidates = readerFields.map((f) => docintelToCandidate(f, 1))
  const canonical = applyKnowledgeBrainIfEnabled(
    candidates,
    buildKnowledgeContext({ docTypeId: docintelId, product: 'tps' }),
  )
  return canonicalToTpsModuleResult(canonical, hint, 'doc_parity_core')
}

/** Core us_i94 reader fixture — same fictional document, registry keys, canonical value shapes (ISO dates). */
function coreI94Result(overrides: Record<string, CoreOverride> = {}): TpsModuleResult {
  return runCoreChain('us_i94', 'i94', {
    family_name: FICTIONAL.family,
    given_name: FICTIONAL.given,
    date_of_birth: FICTIONAL.dobIso,
    i94_admission_number: FICTIONAL.i94Number,
    i94_class_of_admission: FICTIONAL.classOfAdmission,
    i94_date_of_entry: FICTIONAL.entryIso,
    i94_place_of_entry: FICTIONAL.port,
    country_of_birth: 'UKRAINE',
  }, overrides)
}

/** Core us_ead reader fixture — same fictional card, registry keys. */
function coreEadResult(overrides: Record<string, CoreOverride> = {}): TpsModuleResult {
  return runCoreChain('us_ead', 'ead', {
    family_name: FICTIONAL.family,
    given_name: FICTIONAL.given,
    card_number: FICTIONAL.cardNumber,
    a_number: FICTIONAL.aNumber,
    ead_category: FICTIONAL.eadCategory,
    ead_validity_from: FICTIONAL.eadValidFromIso,
    ead_validity_to: FICTIONAL.eadExpiresIso,
    country_of_birth: 'UKRAINE',
  }, overrides)
}

// ── comparison helpers ───────────────────────────────────────────────────────
/**
 * Trivial normalization for value parity: trim + uppercase (classes/names), and
 * US MM/DD/YYYY → ISO YYYY-MM-DD. The date fold is EXACTLY the transform the
 * downstream pipeline applies to date fields as PRODUCT_FORMATTING_ONLY
 * (postExtractNormalize.ts ~199-208): the Core D2 layer emits USCIS MM/DD/YYYY
 * ('date.iso_to_uscis'), legacy emits ISO — same instant (see G5 in the header).
 */
function norm(v: string | null | undefined): string {
  const s = (v ?? '').trim().toUpperCase()
  const us = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (us) return `${us[3]}-${us[1].padStart(2, '0')}-${us[2].padStart(2, '0')}`
  return s
}

function fieldMap(r: TpsModuleResult): Map<string, { normalized: string | null; review: boolean }> {
  const m = new Map<string, { normalized: string | null; review: boolean }>()
  for (const f of r.fields) m.set(f.field, { normalized: f.normalized_value, review: f.review_required })
  return m
}

/** Core result re-keyed to legacy names via the explicit mapping table. */
function coreAsLegacyKeys(
  r: TpsModuleResult,
  mapping: Record<string, string>,
): Map<string, { normalized: string | null; review: boolean }> {
  const m = new Map<string, { normalized: string | null; review: boolean }>()
  for (const f of r.fields) {
    const legacyKey = mapping[f.field]
    if (legacyKey) m.set(legacyKey, { normalized: f.normalized_value, review: f.review_required })
  }
  return m
}

// ═════════════════════════════════════════════════════════════════════════════
// Flip mechanism sanity: the allowlist gate this evidence feeds.
// ═════════════════════════════════════════════════════════════════════════════
describe('tpsHintParity harness — flip gate wiring', () => {
  it('i94/ead map to docintel ids ONLY when allowlisted in TPS_CORE_HINTS', () => {
    expect(mapTpsHintToDocintelId('i94', {})).toBeNull()
    expect(mapTpsHintToDocintelId('ead', {})).toBeNull()
    expect(mapTpsHintToDocintelId('i94', { TPS_CORE_HINTS: 'i94,ead' })).toBe('us_i94')
    expect(mapTpsHintToDocintelId('ead', { TPS_CORE_HINTS: 'i94,ead' })).toBe('us_ead')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// HINT: i94
// ═════════════════════════════════════════════════════════════════════════════
describe('tpsHintParity harness — hint "i94"', () => {
  const legacy = legacyI94Result()
  const core = coreI94Result()

  it('fixture sanity: legacy module matched and emitted its full field set', () => {
    expect(legacy.matched).toBe(true)
    const keys = legacy.fields.map((f) => f.field).sort()
    expect(keys).toEqual([
      'country_of_citizenship',
      'dob',
      'family_name',
      'given_name',
      'i94_admission_number',
      'i94_admit_until',
      'i94_class_of_admission',
      'last_entry_date',
      'place_of_last_entry',
    ])
  })

  it('fixture sanity: Core chain matched and emitted registry-spec keys', () => {
    expect(core.matched).toBe(true)
    const keys = core.fields.map((f) => f.field).sort()
    expect(keys).toEqual([
      'country_of_birth',
      'date_of_birth',
      'family_name',
      'given_name',
      'i94_admission_number',
      'i94_class_of_admission',
      'i94_date_of_entry',
      'i94_place_of_entry',
    ])
  })

  it('A. field-coverage parity for the fields Core CAN cover (mapping table applied)', () => {
    const coreLegacyKeys = coreAsLegacyKeys(core, CORE_TO_LEGACY_I94)
    const coverable = [
      'i94_admission_number',
      'i94_class_of_admission',
      'last_entry_date',
      'place_of_last_entry',
      'dob',
      'family_name',
      'given_name',
    ]
    for (const key of coverable) {
      expect(coreLegacyKeys.has(key), `Core (via mapping) must cover legacy field '${key}'`).toBe(true)
    }
  })

  // G1 + G2 — REAL coverage gaps, kept visible on purpose (this is the flip evidence):
  //   * i94_admit_until: the us_i94 registry spec has NO admit-until field, but the
  //     legacy module emits it and documentContracts.ts marks it "critical for TPS"
  //     (valid-status-window decision). The spec must gain an admit-until field
  //     (aliasable to i94_admit_until) before 'i94' may enter TPS_CORE_HINTS.
  //   * country_of_citizenship: legacy emits it (CBP prints it; the i94 slot contract
  //     allows + consumes it). The us_i94 spec only has country_of_birth, which is a
  //     DIFFERENT fact and must not be conflated.
  it.fails('A-FULL. every legacy-emitted field is covered by Core — FAILS: i94_admit_until + country_of_citizenship missing (G1, G2)', () => {
    const coreLegacyKeys = coreAsLegacyKeys(core, CORE_TO_LEGACY_I94)
    const missing = legacy.fields
      .map((f) => f.field)
      .filter((k) => !coreLegacyKeys.has(k))
    expect(missing, `Core path is missing legacy i94 fields: [${missing.join(', ')}] — registry spec us_i94 must cover them before flip`).toEqual([])
  })

  it('B. value parity on overlapping fields (trim/case normalization; ISO dates)', () => {
    const legacyMap = fieldMap(legacy)
    const coreLegacyKeys = coreAsLegacyKeys(core, CORE_TO_LEGACY_I94)
    const overlapping = [
      'i94_admission_number',
      'i94_class_of_admission',
      'last_entry_date',   // legacy normalizes 03/15/2024 → 2024-03-15; core reader emits ISO
      'place_of_last_entry',
      'dob',
      'family_name',
      'given_name',
    ]
    for (const key of overlapping) {
      const l = legacyMap.get(key)
      const c = coreLegacyKeys.get(key)
      expect(l, `legacy missing '${key}' (fixture broke)`).toBeDefined()
      expect(c, `core missing '${key}' (mapping broke)`).toBeDefined()
      expect(norm(c!.normalized), `value parity on '${key}'`).toBe(norm(l!.normalized))
    }
  })

  it('B2. date surface-format delta is pinned (G5): Core emits USCIS MM/DD/YYYY, legacy emits ISO', () => {
    // Semantic parity is proven in B; this pins the SURFACE difference so a change
    // in either side is caught. The downstream US→ISO repair (postExtractNormalize)
    // keys on 'last_entry_date'/'dob' — i.e. it heals this only after G3 is fixed.
    const legacyMap = fieldMap(legacy)
    const coreMap = fieldMap(core)
    expect(legacyMap.get('last_entry_date')!.normalized).toBe(FICTIONAL.entryIso)
    expect(coreMap.get('i94_date_of_entry')!.normalized).toBe(FICTIONAL.entryUs)
    expect(legacyMap.get('dob')!.normalized).toBe(FICTIONAL.dobIso)
    expect(coreMap.get('date_of_birth')!.normalized).toBe(FICTIONAL.dobUs)
  })

  it('C. review semantics: Core is never LESS reviewed than legacy on the clean fixture', () => {
    const legacyMap = fieldMap(legacy)
    const coreLegacyKeys = coreAsLegacyKeys(core, CORE_TO_LEGACY_I94)
    for (const [key, l] of legacyMap) {
      const c = coreLegacyKeys.get(key)
      if (!c) continue // coverage gaps are asserted separately above
      if (l.review) {
        expect(c.review, `legacy flags '${key}' for review — Core must too`).toBe(true)
      }
    }
    // Critical identity fields: Core forces review (critical_no_mrz_anchor) —
    // strictly MORE conservative than legacy's clean-read false. Assert it so a
    // future policy loosening is caught here.
    for (const key of ['family_name', 'given_name', 'dob']) {
      expect(coreLegacyKeys.get(key)!.review, `Core must review critical field '${key}' without an MRZ anchor`).toBe(true)
    }
  })

  it('C2. reader-flagged uncertainty on the admission number survives to the TpsModuleResult', () => {
    // Legacy's uncertain path (unlabelled fallback) sets review_required=true.
    // Core's equivalent uncertainty signal is the reader's review_required flag —
    // it must NOT be dropped by arbitration/adapter.
    const uncertain = coreI94Result({
      i94_admission_number: { review_required: true, review_reasons: ['source_script_ambiguous'] },
    })
    const adm = uncertain.fields.find((f) => f.field === 'i94_admission_number')
    expect(adm).toBeDefined()
    expect(adm!.review_required).toBe(true)
    expect(uncertain.manual_review_required).toBe(true)
  })

  // G4 — REAL review-semantics gap, kept visible on purpose:
  // i94_admission_number has criticality 'low' in canonical/policy.ts (only the six
  // legal-identity fields are critical), so the confidence<0.85 review gate does not
  // fire for it. A low-confidence Core read of the PRIMARY I-94 fact therefore passes
  // UNREVIEWED, while the legacy module's uncertain path (unlabelled fallback) forces
  // review. Before flip: either raise i94_admission_number criticality or add a
  // doc-number confidence gate.
  it.fails('C3. low-confidence Core admission number must be review-flagged — FAILS: criticality "low" skips the confidence gate (G4)', () => {
    const lowConf = coreI94Result({ i94_admission_number: { confidence: 0.4 } })
    const adm = lowConf.fields.find((f) => f.field === 'i94_admission_number')
    expect(adm).toBeDefined()
    expect(adm!.review_required, 'low-confidence i94_admission_number must not sail through unreviewed').toBe(true)
  })

  // G3 — REAL contract-firewall gap, kept visible on purpose:
  // canonicalToTpsModuleResult passes registry keys through VERBATIM and
  // applyContract matches keys EXACTLY (no aliasing), so the Core-emitted
  // i94_date_of_entry / i94_place_of_entry / date_of_birth are REJECTED by the
  // i94 slot contract even though KEY_ALIASES declares the equivalence. The
  // passport flip only worked because ua_international_passport's spec already
  // uses legacy keys. Before flip: apply primaryKeyOf()/an explicit rename in the
  // tpsAdapter (or rename the us_i94 spec keys to the legacy names).
  it.fails('D. firewall compatibility: mapped Core keys survive applyContract — FAILS: no key translation exists (G3)', () => {
    const contract = applyContract('i94', core.fields.map((f) => f.field), 'i94')
    const accepted = new Set(contract.accepted_field_keys)
    const rejectedMapped = Object.keys(CORE_TO_LEGACY_I94).filter((coreKey) => !accepted.has(coreKey))
    expect(
      rejectedMapped,
      `i94 slot firewall rejects Core keys [${rejectedMapped.join(', ')}] — KEY_ALIASES is never applied between tpsAdapter and applyContract`,
    ).toEqual([])
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// HINT: ead
// ═════════════════════════════════════════════════════════════════════════════
describe('tpsHintParity harness — hint "ead"', () => {
  const legacy = legacyEadResult()
  const core = coreEadResult()

  it('fixture sanity: legacy module matched and emitted its full field set', () => {
    expect(legacy.matched).toBe(true)
    const keys = legacy.fields.map((f) => f.field).sort()
    expect(keys).toEqual([
      'a_number',
      'ead_category_on_card',
      'ead_expiration_date',
      'family_name',
      'given_name',
    ])
    // future expiry on the fixture → the legacy ead_expired review path must be off
    expect(legacy.manual_review_required).toBe(false)
  })

  it('fixture sanity: Core chain matched and emitted registry-spec keys', () => {
    expect(core.matched).toBe(true)
    const keys = core.fields.map((f) => f.field).sort()
    expect(keys).toEqual([
      'a_number',
      'card_number',
      'country_of_birth',
      'ead_category',
      'ead_validity_from',
      'ead_validity_to',
      'family_name',
      'given_name',
    ])
  })

  it('A. field-coverage parity: EVERY legacy-emitted field is covered by Core (mapping table applied) — PARITY', () => {
    const coreLegacyKeys = coreAsLegacyKeys(core, CORE_TO_LEGACY_EAD)
    const missing = legacy.fields
      .map((f) => f.field)
      .filter((k) => !coreLegacyKeys.has(k))
    expect(missing, `Core path is missing legacy ead fields: [${missing.join(', ')}]`).toEqual([])
  })

  it('B. value parity on overlapping fields (trim/case normalization; ISO dates)', () => {
    const legacyMap = fieldMap(legacy)
    const coreLegacyKeys = coreAsLegacyKeys(core, CORE_TO_LEGACY_EAD)
    const overlapping = [
      'a_number',
      'ead_category_on_card', // legacy uppercases; core reader emits the printed code
      'ead_expiration_date',  // legacy normalizes 01/15/2028 → 2028-01-15; core reader emits ISO
      'family_name',          // legacy formatLatinName title-cases; compare case-insensitively
      'given_name',
    ]
    for (const key of overlapping) {
      const l = legacyMap.get(key)
      const c = coreLegacyKeys.get(key)
      expect(l, `legacy missing '${key}' (fixture broke)`).toBeDefined()
      expect(c, `core missing '${key}' (mapping broke)`).toBeDefined()
      expect(norm(c!.normalized), `value parity on '${key}'`).toBe(norm(l!.normalized))
    }
  })

  it('B2. date surface form pinned: ead_validity_to stays ISO on the Core path (D2 date branch does not fire)', () => {
    // Unlike i94_date_of_entry/date_of_birth (G5), the key 'ead_validity_to'
    // contains neither 'date' nor 'dob', so knowledgeNormalize's ISO→USCIS date
    // branch never fires — the reader's ISO value passes through UNCHANGED and
    // happens to match legacy's ISO surface exactly. Pinned here because a
    // registry key rename (e.g. → 'ead_expiration_date') would silently flip
    // this field into the G5 MM/DD/YYYY rewrite.
    const legacyMap = fieldMap(legacy)
    const coreMap = fieldMap(core)
    expect(legacyMap.get('ead_expiration_date')!.normalized).toBe(FICTIONAL.eadExpiresIso)
    expect(coreMap.get('ead_validity_to')!.normalized).toBe(FICTIONAL.eadExpiresIso)
  })

  it('C. review semantics: a_number (critical) from Core is never LESS reviewed than legacy', () => {
    const legacyMap = fieldMap(legacy)
    const coreLegacyKeys = coreAsLegacyKeys(core, CORE_TO_LEGACY_EAD)
    for (const [key, l] of legacyMap) {
      const c = coreLegacyKeys.get(key)
      if (!c) continue
      if (l.review) {
        expect(c.review, `legacy flags '${key}' for review — Core must too`).toBe(true)
      }
    }
    // a_number is one of the six critical fields (canonical/policy.ts) →
    // Core must force review without an MRZ anchor, even on a clean high-confidence read.
    expect(coreLegacyKeys.get('a_number')!.review, 'Core must review critical a_number without an MRZ anchor').toBe(true)

    // And on an UNCERTAIN read (low confidence), the critical gate must hold too.
    const lowConf = coreEadResult({ a_number: { confidence: 0.4 } })
    const aNum = lowConf.fields.find((f) => f.field === 'a_number')
    expect(aNum).toBeDefined()
    expect(aNum!.review_required, 'low-confidence a_number must be review-flagged by Core').toBe(true)
  })

  // G3 (same firewall gap as i94): Core emits ead_category / ead_validity_to, the
  // ead slot contract only accepts ead_category_on_card / ead_expiration_date, and
  // nothing translates between them. Field coverage + values are at parity above,
  // so for 'ead' the ONLY blocker is this key-translation layer.
  it.fails('D. firewall compatibility: mapped Core keys survive applyContract — FAILS: no key translation exists (G3)', () => {
    const contract = applyContract('ead', core.fields.map((f) => f.field), 'ead')
    const accepted = new Set(contract.accepted_field_keys)
    const rejectedMapped = Object.keys(CORE_TO_LEGACY_EAD).filter((coreKey) => !accepted.has(coreKey))
    expect(
      rejectedMapped,
      `ead slot firewall rejects Core keys [${rejectedMapped.join(', ')}] — mapping table is never applied between tpsAdapter and applyContract`,
    ).toEqual([])
  })
})
