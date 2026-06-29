/**
 * One-Brain Step B — NAMESPACE CI GUARD.
 *
 * Proves that EVERY birth-certificate field key that exists on the two GREEN
 * single-namespace directions resolves through the Unified Document Contract
 * (birthCertSovietV1Contract), so the historical key drift can never silently
 * reappear:
 *   - child_* / family_name  (read-side child names)
 *   - dob / date_of_birth     (synonym)
 *   - registration_number / act_record_number / series_number / certificate_series_number
 *
 * Two directions asserted here (both already GREEN at HEAD — the contract was
 * built FROM documentRegistry + the official schema, so read-side and output
 * keys already resolve):
 *   1. read-side  : getDocTypeSpec(BIRTH_CERT_LEGACY_DOCTYPE).fields[].field
 *                   → readKeyToRuntime(key) OR a legacyReadAlias resolves.
 *   2. output     : birthCertificateSchema.fields[].key
 *                   → outputKeyToRuntime(key) resolves.
 * Plus a RATCHET so contract coverage of the read-side spec never regresses.
 *
 * RELATIONSHIP TO birthCertSovietV1Contract.test.ts (Phase 1) and
 * birthCertSovietV1Reconcile.test.ts (Phase 2):
 *   Phase 1 locks the contract ⇄ A/B layers (orphan-free, exact-1 mapping).
 *   Phase 2 reconciles islands C (FIELD_BOX_TEMPLATES) and D (KEY_ALIASES).
 *   This guard is a COMPLEMENTARY SUPERSET on the read-side spec ⇄ contract
 *   direction: it additionally honours `legacyReadAlias` resolution (so a
 *   future TPS-path alias key is not flagged as an orphan), it ratchets the
 *   covered-key count, and it is the single place a CI reviewer can read to see
 *   WHICH alias islands are still un-unified. It intentionally does NOT
 *   re-litigate Phase 1's exact-1 invariant.
 *
 * THE SIX ISLANDS (one namespace goal) — coverage status:
 *   ✅ A read-side  documentRegistry DocTypeSpec ......... asserted below
 *   ✅ B output     birth-certificate.schema OfficialFormSchema  asserted below
 *   ⬜ documentBrain schema ............................. TODO (not yet bridged)
 *   ⬜ dualOcrCrossref field map ........................ TODO (not yet bridged)
 *   ⬜ documentContracts (legacy per-product contracts) . TODO (not yet bridged)
 *   ⬜ translationExtractor extraction keys ............. TODO (partial via legacyReadAliases)
 *   ⬜ field-mapper (buildMirrorValues) ................. partially via Phase 1/2
 * The ⬜ islands are deliberately NOT asserted here (they are not all green at
 * HEAD); this guard asserts ONLY the two proven-green directions so it stays
 * GREEN and additive. Wiring each remaining island = extend this guard.
 *
 * Pure assertions over exported data. No runtime behaviour touched. Additive:
 * this file creates no edits to any existing module.
 */
import { describe, it, expect } from 'vitest'
import {
  birthCertSovietV1Contract as CONTRACT,
  BIRTH_CERT_LEGACY_DOCTYPE,
  readKeyToRuntime,
  outputKeyToRuntime,
} from '../birthCertSovietV1Contract'
import { getDocTypeSpec } from '@/lib/docintel/documentRegistry'
import { birthCertificateSchema } from '@/lib/translation/forms/ukraine/schemas/birth-certificate.schema'

const READ_SIDE_KEYS = (getDocTypeSpec(BIRTH_CERT_LEGACY_DOCTYPE)?.fields ?? []).map((f) => f.field)
const OUTPUT_KEYS = birthCertificateSchema.fields.map((f) => f.key)

/** All read-side aliases declared anywhere on the contract (TPS-path / historical keys). */
const LEGACY_READ_ALIASES = new Set(
  CONTRACT.flatMap((f) => f.legacyReadAliases ?? []),
)

/**
 * RATCHET FLOOR — the number of read-side keys that resolve to the contract
 * today. Coverage may only grow. If you legitimately add a read-side field,
 * cover it in the contract and bump this floor; you may NEVER lower it.
 */
const READ_SIDE_COVERAGE_FLOOR = 12

function readKeyResolves(key: string): boolean {
  return readKeyToRuntime(key) !== undefined || LEGACY_READ_ALIASES.has(key)
}

describe('namespace guard — sanity: both green layers are present', () => {
  it('the read-side spec and the output schema both expose birth-cert keys', () => {
    expect(READ_SIDE_KEYS.length).toBeGreaterThan(0)
    expect(OUTPUT_KEYS.length).toBeGreaterThan(0)
    expect(birthCertificateSchema.docType).toBe(BIRTH_CERT_LEGACY_DOCTYPE)
  })
})

describe('namespace guard — read-side spec → Unified Contract (no orphan key)', () => {
  it('EVERY documentRegistry read-side key resolves (direct or via legacyReadAlias)', () => {
    const orphans = READ_SIDE_KEYS.filter((k) => !readKeyResolves(k))
    expect(
      orphans,
      `read-side keys not covered by the Unified Document Contract: ${JSON.stringify(orphans)}. ` +
        `Add a contract field (readSideKey) or a legacyReadAlias so the namespace stays unified.`,
    ).toEqual([])
  })

  it.each(READ_SIDE_KEYS)('read-side key %s resolves to a contract entry', (key) => {
    expect(readKeyResolves(key), `'${key}' must resolve via readKeyToRuntime or a legacyReadAlias`).toBe(true)
  })
})

describe('namespace guard — output schema → Unified Contract (no orphan key)', () => {
  it('EVERY birthCertificateSchema output key resolves via outputKeyToRuntime', () => {
    const orphans = OUTPUT_KEYS.filter((k) => outputKeyToRuntime(k) === undefined)
    expect(
      orphans,
      `output keys not covered by the Unified Document Contract: ${JSON.stringify(orphans)}. ` +
        `Add a contract field (outputKey) so the namespace stays unified.`,
    ).toEqual([])
  })

  it.each(OUTPUT_KEYS)('output key %s resolves to a contract entry', (key) => {
    expect(outputKeyToRuntime(key), `'${key}' must resolve via outputKeyToRuntime`).toBeDefined()
  })
})

describe('namespace guard — coverage ratchet (never regress)', () => {
  it('the count of contract-covered read-side keys is >= the floor', () => {
    const covered = READ_SIDE_KEYS.filter((k) => readKeyResolves(k)).length
    expect(
      covered,
      `read-side coverage dropped to ${covered} (floor ${READ_SIDE_COVERAGE_FLOOR}). ` +
        `Coverage may only grow — restore the mapping or, if you ADDED coverage, raise the floor.`,
    ).toBeGreaterThanOrEqual(READ_SIDE_COVERAGE_FLOOR)
  })

  it('the floor matches all current read-side keys (every key is covered today)', () => {
    // At HEAD the contract was built from documentRegistry, so 100% resolve.
    expect(READ_SIDE_KEYS.length).toBe(READ_SIDE_COVERAGE_FLOOR)
    expect(READ_SIDE_KEYS.every(readKeyResolves)).toBe(true)
  })
})

describe('namespace guard — specific drift killers (regression pins)', () => {
  it('child_* read-side names collapse onto the flat child runtimeKeys', () => {
    expect(readKeyToRuntime('child_family_name')).toBe('family_name')
    expect(readKeyToRuntime('child_given_name')).toBe('given_name')
    expect(readKeyToRuntime('child_patronymic')).toBe('patronymic')
  })

  it('dob (read) and date_of_birth (output) converge on one runtimeKey', () => {
    expect(readKeyToRuntime('dob')).toBe('date_of_birth')
    expect(outputKeyToRuntime('date_of_birth')).toBe('date_of_birth')
    expect(readKeyToRuntime('dob')).toBe(outputKeyToRuntime('date_of_birth'))
  })

  it('the act-record number is NOT confused with the certificate series/number', () => {
    // Silent-wrong incident (2026-06-11): act_record_number ≠ certificate number.
    const actRuntime = readKeyToRuntime('act_record_number')
    const seriesRuntime = readKeyToRuntime('certificate_series_number')
    expect(actRuntime).toBe('act_record_number')
    expect(seriesRuntime).toBe('document_series')
    expect(actRuntime).not.toBe(seriesRuntime)
  })
})
