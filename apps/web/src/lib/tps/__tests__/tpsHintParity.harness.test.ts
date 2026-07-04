/**
 * tpsHintParity.harness.test.ts — One-Brain v2 Phase 2 flip-gate evidence.
 *
 * PER-HINT PARITY HARNESS for the TPS_CORE_HINTS allowlist (tpsAdapter.ts):
 * before a hint ('i94', 'ead') may be flipped from the legacy OCR module to the
 * Core path, this harness proves contract compatibility between:
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
 * ── EXPLICIT KEY-MAPPING TABLE (the documented contract) ────────────────────
 * Core (docintel registry key)  →  Legacy/TPS-consumed key    | authority
 *   i94_admission_number        →  i94_admission_number       | identical
 *   i94_class_of_admission      →  i94_class_of_admission     | identical
 *   i94_date_of_entry           →  last_entry_date            | CORE_TO_TPS_KEY (tpsAdapter.ts)
 *   i94_place_of_entry          →  place_of_last_entry        | CORE_TO_TPS_KEY
 *   date_of_birth               →  dob                        | CORE_TO_TPS_KEY
 *   family_name                 →  family_name                | identical
 *   given_name                  →  given_name                 | identical
 *   a_number                    →  a_number                   | identical
 *   ead_category                →  ead_category_on_card       | CORE_TO_TPS_KEY
 *   ead_validity_to             →  ead_expiration_date        | CORE_TO_TPS_KEY
 *   i94_admit_until             →  i94_admit_until            | identical (spec field added, Phase 2c)
 *   country_of_citizenship      →  country_of_citizenship     | identical (spec field added, Phase 2c)
 *
 * ── GAP STATUS: G1–G4 CLOSED by Phase 2c ───────────────────────────────────
 *   G1 CLOSED: documentRegistry.ts us_i94 spec now declares i94_admit_until
 *       (kind 'date') — the "critical for TPS" status-window fact is coverable.
 *   G2 CLOSED: us_i94 spec now declares country_of_citizenship (kind 'text'),
 *       DISTINCT from country_of_birth (birth country ≠ citizenship — the two
 *       facts stay separate keys and are never conflated).
 *   G3 CLOSED: canonicalToTpsModuleResult (canonical/core/tpsAdapter.ts) now
 *       PROJECTS Core registry keys → legacy/TPS keys itself via CORE_TO_TPS_KEY
 *       (exported helper projectCoreKeyToTps). The adapter OUTPUT carries the
 *       LEGACY names, so the applyContract firewall (exact-key match) and
 *       postExtractNormalize (keys on 'dob'/'last_entry_date'/
 *       'ead_expiration_date') both see the keys they expect. Tests below assert
 *       the adapter did the projection (legacy key present, registry key absent).
 *   G4 CLOSED: canonical/policy.ts CRITICALITY now has i94_admission_number:
 *       'high' and i94_admit_until: 'high', so a low-confidence (<0.85) Core
 *       read of the primary I-94 facts IS review-flagged (low_final_confidence),
 *       matching the legacy module's conservative uncertain path.
 *
 * REMAINING PINNED DELTA (surface form only, NOT a blocker):
 *   G5 (i94): the Core D2 knowledge layer rewrites values of keys containing
 *       'date'/'dob' from ISO → USCIS MM/DD/YYYY (knowledgeNormalize.ts
 *       'date.iso_to_uscis') BEFORE the adapter's key projection, so the
 *       adapter emits last_entry_date/dob with MM/DD/YYYY values while legacy
 *       emits ISO. Because G3 is closed the downstream US→ISO repair in
 *       postExtractNormalize.ts (~199-208, PRODUCT_FORMATTING_ONLY) now DOES
 *       reach these fields (it keys on the legacy names the adapter now emits).
 *       Same instant, different surface — pinned in B2. ead_validity_to /
 *       i94_admit_until contain neither 'date' nor 'dob' at D2 time (projection
 *       happens after D2), so they pass through as ISO.
 *
 * VERDICTS (post-Phase-2c): i94 = PARITY (G5 surface delta pinned + healed
 * downstream); ead = PARITY. This harness is now the FLIP-GATE EVIDENCE for
 * adding 'i94' and 'ead' to TPS_CORE_HINTS.
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
import { canonicalToTpsModuleResult, mapTpsHintToDocintelId, projectCoreKeyToTps } from '@/lib/canonical/core/tpsAdapter'
import { applyContract } from '@/lib/tps/ocr/documentContracts'

// ─────────────────────────────────────────────────────────────────────────────
// Explicit key mapping: Core (docintel registry) key → legacy/TPS-consumed key.
// DOCUMENTATION of the projection the ADAPTER now performs (CORE_TO_TPS_KEY in
// tpsAdapter.ts). Kept complete (identical keys listed too) so a registry
// rename breaks this test loudly. Assertions below consume the adapter's
// OUTPUT keys directly and verify the adapter applied this table itself.
// ─────────────────────────────────────────────────────────────────────────────
const CORE_TO_LEGACY_I94: Record<string, string> = {
  i94_admission_number: 'i94_admission_number',
  i94_class_of_admission: 'i94_class_of_admission',
  i94_date_of_entry: 'last_entry_date', // CORE_TO_TPS_KEY
  i94_place_of_entry: 'place_of_last_entry', // CORE_TO_TPS_KEY (same fact: Port of Entry)
  date_of_birth: 'dob', // CORE_TO_TPS_KEY
  family_name: 'family_name',
  given_name: 'given_name',
  i94_admit_until: 'i94_admit_until', // spec field added in Phase 2c (G1 closed)
  country_of_citizenship: 'country_of_citizenship', // spec field added in Phase 2c (G2 closed)
  // country_of_birth deliberately NOT mapped to country_of_citizenship:
  // birth country ≠ citizenship country — they are separate registry fields now.
}

const CORE_TO_LEGACY_EAD: Record<string, string> = {
  a_number: 'a_number',
  ead_category: 'ead_category_on_card', // CORE_TO_TPS_KEY (card "Category")
  ead_validity_to: 'ead_expiration_date', // CORE_TO_TPS_KEY (card "Card Expires")
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
  citizenship: 'UKRAINE',
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
    FICTIONAL.citizenship,
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
    i94_admit_until: FICTIONAL.admitUntilIso, // Phase 2c spec field (G1 closed)
    i94_place_of_entry: FICTIONAL.port,
    country_of_citizenship: FICTIONAL.citizenship, // Phase 2c spec field (G2 closed)
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

  it('projectCoreKeyToTps implements exactly the documented mapping table (hint-scoped)', () => {
    for (const [coreKey, legacyKey] of Object.entries(CORE_TO_LEGACY_I94)) {
      expect(projectCoreKeyToTps(coreKey, 'i94'), `i94 projection of '${coreKey}'`).toBe(legacyKey)
    }
    for (const [coreKey, legacyKey] of Object.entries(CORE_TO_LEGACY_EAD)) {
      expect(projectCoreKeyToTps(coreKey, 'ead'), `ead projection of '${coreKey}'`).toBe(legacyKey)
    }
    // SAFETY scoping (tpsAdapter PROJECTED_TPS_HINTS): the LIVE passport/booklet
    // path is NEVER projected — its MRZ candidates legitimately emit date_of_birth.
    expect(projectCoreKeyToTps('date_of_birth', 'passport')).toBe('date_of_birth')
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

  it('fixture sanity: Core chain matched and the ADAPTER emitted LEGACY keys (G3 projection applied)', () => {
    expect(core.matched).toBe(true)
    const keys = core.fields.map((f) => f.field).sort()
    expect(keys).toEqual([
      'country_of_birth', // Core surplus (distinct fact; passes through un-renamed)
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
    // The registry-spec source keys must NOT leak through the adapter:
    for (const registryKey of ['i94_date_of_entry', 'i94_place_of_entry', 'date_of_birth']) {
      expect(keys, `adapter must project '${registryKey}' away`).not.toContain(registryKey)
    }
  })

  it('A-FULL. every legacy-emitted field is covered by the Core adapter output — G1+G2+G3 CLOSED', () => {
    const coreMap = fieldMap(core)
    const missing = legacy.fields
      .map((f) => f.field)
      .filter((k) => !coreMap.has(k))
    expect(missing, `Core path is missing legacy i94 fields: [${missing.join(', ')}]`).toEqual([])
    // The two Phase-2c spec additions specifically:
    expect(coreMap.has('i94_admit_until'), 'us_i94 spec must cover i94_admit_until (G1)').toBe(true)
    expect(coreMap.has('country_of_citizenship'), 'us_i94 spec must cover country_of_citizenship (G2)').toBe(true)
  })

  it('B. value parity on ALL legacy-emitted fields (trim/case normalization; US↔ISO date fold)', () => {
    const legacyMap = fieldMap(legacy)
    const coreMap = fieldMap(core)
    const overlapping = [
      'i94_admission_number',
      'i94_class_of_admission',
      'last_entry_date',   // legacy normalizes 03/15/2024 → 2024-03-15; core D2 emits 03/15/2024 (G5)
      'i94_admit_until',
      'place_of_last_entry',
      'dob',
      'country_of_citizenship',
      'family_name',
      'given_name',
    ]
    for (const key of overlapping) {
      const l = legacyMap.get(key)
      const c = coreMap.get(key)
      expect(l, `legacy missing '${key}' (fixture broke)`).toBeDefined()
      expect(c, `core missing '${key}' (adapter projection broke)`).toBeDefined()
      expect(norm(c!.normalized), `value parity on '${key}'`).toBe(norm(l!.normalized))
    }
  })

  it('B2. date surface-format delta is pinned (G5): Core emits USCIS MM/DD/YYYY on date/dob keys, legacy emits ISO', () => {
    // Semantic parity is proven in B; this pins the SURFACE difference so a change
    // in either side is caught. Because G3 is closed, the downstream US→ISO repair
    // (postExtractNormalize keys on 'last_entry_date'/'dob') NOW reaches these
    // fields — the adapter emits exactly those names.
    const legacyMap = fieldMap(legacy)
    const coreMap = fieldMap(core)
    expect(legacyMap.get('last_entry_date')!.normalized).toBe(FICTIONAL.entryIso)
    expect(coreMap.get('last_entry_date')!.normalized).toBe(FICTIONAL.entryUs) // D2 saw 'i94_date_of_entry' (contains 'date')
    expect(legacyMap.get('dob')!.normalized).toBe(FICTIONAL.dobIso)
    expect(coreMap.get('dob')!.normalized).toBe(FICTIONAL.dobUs) // D2 saw 'date_of_birth'
    // i94_admit_until contains neither 'date' nor 'dob' at D2 time → stays ISO:
    expect(coreMap.get('i94_admit_until')!.normalized).toBe(FICTIONAL.admitUntilIso)
  })

  it('C. review semantics: Core is never LESS reviewed than legacy on the clean fixture', () => {
    const legacyMap = fieldMap(legacy)
    const coreMap = fieldMap(core)
    for (const [key, l] of legacyMap) {
      const c = coreMap.get(key)
      if (!c) continue // coverage is asserted separately above
      if (l.review) {
        expect(c.review, `legacy flags '${key}' for review — Core must too`).toBe(true)
      }
    }
    // Critical identity fields: Core forces review (critical_no_mrz_anchor) —
    // strictly MORE conservative than legacy's clean-read false. Assert it so a
    // future policy loosening is caught here.
    for (const key of ['family_name', 'given_name', 'dob']) {
      expect(coreMap.get(key)!.review, `Core must review critical field '${key}' without an MRZ anchor`).toBe(true)
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

  it('C3. low-confidence Core admission number IS review-flagged — G4 CLOSED (criticality "high" arms the confidence gate)', () => {
    // canonical/policy.ts CRITICALITY now has i94_admission_number: 'high', so a
    // confidence<0.85 read trips 'low_final_confidence' — matching the legacy
    // module's conservative uncertain path.
    const lowConf = coreI94Result({ i94_admission_number: { confidence: 0.4 } })
    const adm = lowConf.fields.find((f) => f.field === 'i94_admission_number')
    expect(adm).toBeDefined()
    expect(adm!.review_required, 'low-confidence i94_admission_number must not sail through unreviewed').toBe(true)
    expect(lowConf.manual_review_required).toBe(true)
  })

  it('C4. low-confidence Core admit-until date IS review-flagged (i94_admit_until criticality "high")', () => {
    const lowConf = coreI94Result({ i94_admit_until: { confidence: 0.4 } })
    const admitUntil = lowConf.fields.find((f) => f.field === 'i94_admit_until')
    expect(admitUntil).toBeDefined()
    expect(admitUntil!.review_required, 'low-confidence i94_admit_until must be review-flagged').toBe(true)
  })

  it('D. firewall compatibility: adapter-projected keys survive applyContract — G3 CLOSED', () => {
    const contract = applyContract('i94', core.fields.map((f) => f.field), 'i94')
    const accepted = new Set(contract.accepted_field_keys)
    // Every legacy-consumed key the adapter emits must pass the exact-key firewall:
    const legacyConsumed = legacy.fields.map((f) => f.field)
    const rejected = legacyConsumed.filter((k) => !accepted.has(k))
    expect(
      rejected,
      `i94 slot firewall rejects adapter-emitted keys [${rejected.join(', ')}]`,
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

  it('fixture sanity: Core chain matched and the ADAPTER emitted LEGACY keys (G3 projection applied)', () => {
    expect(core.matched).toBe(true)
    const keys = core.fields.map((f) => f.field).sort()
    expect(keys).toEqual([
      'a_number',
      'card_number',          // Core surplus, passes through un-renamed
      'country_of_birth',     // Core surplus
      'ead_category_on_card', // projected from ead_category
      'ead_expiration_date',  // projected from ead_validity_to
      'ead_validity_from',    // Core surplus
      'family_name',
      'given_name',
    ])
    for (const registryKey of ['ead_category', 'ead_validity_to']) {
      expect(keys, `adapter must project '${registryKey}' away`).not.toContain(registryKey)
    }
  })

  it('A. field-coverage parity: EVERY legacy-emitted field is in the Core adapter output — PARITY', () => {
    const coreMap = fieldMap(core)
    const missing = legacy.fields
      .map((f) => f.field)
      .filter((k) => !coreMap.has(k))
    expect(missing, `Core path is missing legacy ead fields: [${missing.join(', ')}]`).toEqual([])
  })

  it('B. value parity on overlapping fields (trim/case normalization; ISO dates)', () => {
    const legacyMap = fieldMap(legacy)
    const coreMap = fieldMap(core)
    const overlapping = [
      'a_number',
      'ead_category_on_card', // legacy uppercases; core reader emits the printed code
      'ead_expiration_date',  // legacy normalizes 01/15/2028 → 2028-01-15; core reader emits ISO
      'family_name',          // legacy formatLatinName title-cases; compare case-insensitively
      'given_name',
    ]
    for (const key of overlapping) {
      const l = legacyMap.get(key)
      const c = coreMap.get(key)
      expect(l, `legacy missing '${key}' (fixture broke)`).toBeDefined()
      expect(c, `core missing '${key}' (adapter projection broke)`).toBeDefined()
      expect(norm(c!.normalized), `value parity on '${key}'`).toBe(norm(l!.normalized))
    }
  })

  it('B2. date surface form pinned: ead expiry stays ISO on the Core path (D2 date branch does not fire)', () => {
    // At D2 time the key is still 'ead_validity_to' (projection happens in the
    // adapter, AFTER the knowledge layer) — it contains neither 'date' nor 'dob',
    // so knowledgeNormalize's ISO→USCIS branch never fires: the reader's ISO value
    // passes through UNCHANGED and matches legacy's ISO surface exactly. Pinned
    // because a REGISTRY key rename (e.g. spec field → 'ead_expiration_date')
    // would silently flip this field into the G5 MM/DD/YYYY rewrite.
    const legacyMap = fieldMap(legacy)
    const coreMap = fieldMap(core)
    expect(legacyMap.get('ead_expiration_date')!.normalized).toBe(FICTIONAL.eadExpiresIso)
    expect(coreMap.get('ead_expiration_date')!.normalized).toBe(FICTIONAL.eadExpiresIso)
  })

  it('C. review semantics: a_number (critical) from Core is never LESS reviewed than legacy', () => {
    const legacyMap = fieldMap(legacy)
    const coreMap = fieldMap(core)
    for (const [key, l] of legacyMap) {
      const c = coreMap.get(key)
      if (!c) continue
      if (l.review) {
        expect(c.review, `legacy flags '${key}' for review — Core must too`).toBe(true)
      }
    }
    // a_number is one of the six critical fields (canonical/policy.ts) →
    // Core must force review without an MRZ anchor, even on a clean high-confidence read.
    expect(coreMap.get('a_number')!.review, 'Core must review critical a_number without an MRZ anchor').toBe(true)

    // And on an UNCERTAIN read (low confidence), the critical gate must hold too.
    const lowConf = coreEadResult({ a_number: { confidence: 0.4 } })
    const aNum = lowConf.fields.find((f) => f.field === 'a_number')
    expect(aNum).toBeDefined()
    expect(aNum!.review_required, 'low-confidence a_number must be review-flagged by Core').toBe(true)
  })

  it('D. firewall compatibility: adapter-projected keys survive applyContract — G3 CLOSED', () => {
    const contract = applyContract('ead', core.fields.map((f) => f.field), 'ead')
    const accepted = new Set(contract.accepted_field_keys)
    // Every legacy-consumed key the adapter emits must pass the exact-key firewall:
    const legacyConsumed = legacy.fields.map((f) => f.field)
    const rejected = legacyConsumed.filter((k) => !accepted.has(k))
    expect(
      rejected,
      `ead slot firewall rejects adapter-emitted keys [${rejected.join(', ')}]`,
    ).toEqual([])
  })
})
