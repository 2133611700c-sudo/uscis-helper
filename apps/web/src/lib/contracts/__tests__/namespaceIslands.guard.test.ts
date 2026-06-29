/**
 * One-Brain Step B (EXPANSION) — NAMESPACE DRIFT GUARD for the OTHER islands.
 *
 * namespaceContract.guard.test.ts already guards the TWO green directions:
 *   - read-side  : documentRegistry DocTypeSpec(ua_birth_certificate).fields[].field
 *   - output     : birthCertificateSchema.fields[].key
 * This file does NOT re-test those. It extends the drift guard to the OTHER
 * birth-certificate field-list ISLANDS, so a NEW orphan key in any of them
 * fails CI:
 *
 *   Island 1 — TPS OCR slot contract   : DOCUMENT_CONTRACTS.birth_certificate.allowed_fields
 *              (apps/web/src/lib/tps/ocr/documentContracts.ts)
 *   Island 2 — DeepSeek extraction      : BIRTH_CERT_EXTRACTION_TARGETS
 *              (apps/web/src/lib/translation/extraction/birthCertificateExtractionPrompt.ts)
 *   Island 3 — translation module       : BIRTH_CERT_ALL_FIELD_TARGETS
 *              (apps/web/src/lib/translation/modules/birthCertificate.module.ts)
 *
 * A key "resolves to the Unified Document Contract" if ANY of these hit:
 *   readKeyToRuntime(key) | outputKeyToRuntime(key) | fieldByRuntimeKey(key)
 *   | the key is a declared legacyReadAlias.
 *
 * HONESTY OVER A FALSE PASS:
 *   Some island keys are genuinely NOT covered by the contract yet (they are
 *   extraction/render-stage concepts the v1 contract did not model — e.g.
 *   `document_type`, `citizenship`, `*_english` label projections). Forcing
 *   them through a resolver would be a lie. Instead they are recorded in an
 *   explicit, per-island-documented KNOWN_UNMAPPED allow-list. The guard then
 *   RATCHETS that allow-list: the set of unmapped keys may SHRINK (someone
 *   wires an island into the contract) but may NEVER GROW (a new orphan key is
 *   added). That keeps the file green at HEAD, honest about today's gaps, and
 *   still fatal to fresh namespace drift.
 *
 * Pure assertions over exported data. Additive: edits NO existing module.
 */
import { describe, it, expect } from 'vitest'
import {
  birthCertSovietV1Contract as CONTRACT,
  readKeyToRuntime,
  outputKeyToRuntime,
  fieldByRuntimeKey,
} from '../birthCertSovietV1Contract'
import { DOCUMENT_CONTRACTS } from '@/lib/tps/ocr/documentContracts'
import { BIRTH_CERT_EXTRACTION_TARGETS } from '@/lib/translation/extraction/birthCertificateExtractionPrompt'
import { BIRTH_CERT_ALL_FIELD_TARGETS } from '@/lib/translation/modules/birthCertificate.module'

/** Every read-side alias declared anywhere on the contract (TPS-path / historical keys). */
const LEGACY_READ_ALIASES = new Set(CONTRACT.flatMap((f) => f.legacyReadAliases ?? []))

/** A key is unified iff it resolves via ANY contract direction or a legacy alias. */
function keyResolves(key: string): boolean {
  return (
    readKeyToRuntime(key) !== undefined ||
    outputKeyToRuntime(key) !== undefined ||
    fieldByRuntimeKey(key) !== undefined ||
    LEGACY_READ_ALIASES.has(key)
  )
}

// ── The islands under guard (NOT the two already covered by namespaceContract.guard) ──
const ISLANDS: Array<{ name: string; keys: readonly string[] }> = [
  {
    name: 'tps/ocr/documentContracts.ts DOCUMENT_CONTRACTS.birth_certificate.allowed_fields',
    keys: DOCUMENT_CONTRACTS.birth_certificate.allowed_fields,
  },
  {
    name: 'translation/extraction/birthCertificateExtractionPrompt.ts BIRTH_CERT_EXTRACTION_TARGETS',
    keys: BIRTH_CERT_EXTRACTION_TARGETS,
  },
  {
    name: 'translation/modules/birthCertificate.module.ts BIRTH_CERT_ALL_FIELD_TARGETS',
    keys: BIRTH_CERT_ALL_FIELD_TARGETS,
  },
]

/**
 * KNOWN_UNMAPPED — island keys the Unified Document Contract genuinely does
 * NOT model yet (NOT drift, NOT a false pass — documented gaps). Each is a
 * pipeline-stage concept outside the v1 field contract:
 *
 *   tps/ocr/documentContracts.ts (slot contract):
 *     - issuing_authority_english : English-label PROJECTION of issuing_authority,
 *       produced downstream; the contract carries the source key, not its
 *       translated twin.
 *
 *   extraction + module fieldTargets (same DeepSeek target list, duplicated):
 *     - document_type             : classifier output, not a form field.
 *     - certificate_series        : pre-split series token (contract models the
 *       merged certificate_series_number → document.series / document.number).
 *     - certificate_number        : pre-split number token (see above).
 *     - citizenship               : not modeled on the Soviet v1 template.
 *     - registration_place        : extraction synonym for place_of_registration;
 *       not yet declared as a contract alias.
 *     - repeated_certificate_marker : ПОВТОРНО marker → contract Mark, not a field.
 *     - readable_stamp_text       : stamp OCR text → Mark, not a field.
 *     - document_language_layer   : RU/UA layer metadata, not a field.
 *     - archive_or_duplicate_note : free-text note, not a field.
 *
 * RATCHET: this set may SHRINK (wire a key into the contract) but never GROW.
 * Adding a NEW orphan key to any island will NOT be in this set → CI fails.
 */
const KNOWN_UNMAPPED: ReadonlySet<string> = new Set<string>([
  // documentContracts.ts
  'issuing_authority_english',
  // extraction + module fieldTargets
  'document_type',
  'certificate_series',
  'certificate_number',
  'citizenship',
  'registration_place',
  'repeated_certificate_marker',
  'readable_stamp_text',
  'document_language_layer',
  'archive_or_duplicate_note',
])

describe('namespace islands guard — sanity: islands are non-empty and imported', () => {
  it.each(ISLANDS)('island "$name" exposes keys', ({ keys }) => {
    expect(keys.length).toBeGreaterThan(0)
  })
})

describe('namespace islands guard — no NEW orphan key (resolves OR is KNOWN_UNMAPPED)', () => {
  it.each(ISLANDS)('island "$name": every key resolves to the contract or is documented-unmapped', ({ name, keys }) => {
    const orphans = keys.filter((k) => !keyResolves(k) && !KNOWN_UNMAPPED.has(k))
    expect(
      orphans,
      `NEW namespace drift in island [${name}]: ${JSON.stringify(orphans)}. ` +
        `Each key must resolve via readKeyToRuntime | outputKeyToRuntime | fieldByRuntimeKey | a legacyReadAlias, ` +
        `or — if the contract genuinely does not model it yet — be added to KNOWN_UNMAPPED with a comment.`,
    ).toEqual([])
  })
})

describe('namespace islands guard — KNOWN_UNMAPPED ratchet (may shrink, never grow)', () => {
  it('every KNOWN_UNMAPPED entry is STILL an unmapped key on some island (no stale allow-listing)', () => {
    const allIslandKeys = new Set(ISLANDS.flatMap((i) => i.keys))
    const stale = [...KNOWN_UNMAPPED].filter((k) => !allIslandKeys.has(k) || keyResolves(k))
    expect(
      stale,
      `KNOWN_UNMAPPED contains entries that are no longer unmapped island keys (now resolve, or removed from every island): ` +
        `${JSON.stringify(stale)}. Remove them so the allow-list ratchets down honestly.`,
    ).toEqual([])
  })

  it('the live unmapped-key set never EXCEEDS KNOWN_UNMAPPED (no new drift slips in)', () => {
    const liveUnmapped = new Set(
      ISLANDS.flatMap((i) => i.keys).filter((k) => !keyResolves(k)),
    )
    const grew = [...liveUnmapped].filter((k) => !KNOWN_UNMAPPED.has(k))
    expect(
      grew,
      `unmapped island keys NOT in KNOWN_UNMAPPED (namespace drift): ${JSON.stringify(grew)}.`,
    ).toEqual([])
    // Tightness: the floor equals exactly today's documented gaps.
    expect(liveUnmapped.size).toBe(KNOWN_UNMAPPED.size)
  })
})
