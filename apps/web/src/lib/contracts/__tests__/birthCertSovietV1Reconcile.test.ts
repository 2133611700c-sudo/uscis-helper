/**
 * Phase 2 (migration-plan.md) — RECONCILE the unified contract against the OTHER
 * alias islands without replacing them yet. The Phase 1 test already locked the
 * contract to A/B and to `buildMirrorValues`; this file closes the remaining gaps:
 *
 *   D — canonical/core/keyAliases.ts  KEY_ALIASES      (second, separate alias map)
 *   C — docintel/ensemble/handwrittenFieldRoute.ts FIELD_BOX_TEMPLATES (crop layer)
 *   + the latent HTR empty-intersection bug (SCHEMA_AUDIT conflict #1) — pinned so
 *     that wiring the sidecar later cannot silently regress the child-name route.
 *
 * Pure assertions over exported data. No runtime behaviour is touched and the two
 * legacy alias maps are NOT modified — Phase 3 will make them DERIVE from the
 * contract; this test is the drift guard that makes that safe.
 */
import { describe, it, expect } from 'vitest'
import {
  birthCertSovietV1Contract as CONTRACT,
  readKeyToRuntime,
  fieldByRuntimeKey,
} from '../birthCertSovietV1Contract'
import { KEY_ALIASES, primaryKeyOf } from '@/lib/canonical/core/keyAliases'
import { FIELD_BOX_TEMPLATES } from '@/lib/docintel/ensemble/handwrittenFieldRoute'

describe('Phase 2 — KEY_ALIASES (D) does not contradict the contract', () => {
  const runtimeKeys = new Set(CONTRACT.map((f) => f.runtimeKey))

  it('every KEY_ALIASES group that touches a contract runtimeKey is consistent with it', () => {
    // For any alias group whose primary OR an alias is a contract runtimeKey, the
    // whole group must collapse to ONE contract field — never split a contract field
    // across two primaries, never merge two contract fields under one primary.
    for (const [primary, aliases] of Object.entries(KEY_ALIASES)) {
      const group = [primary, ...aliases]
      const hit = group.filter((k) => runtimeKeys.has(k))
      if (hit.length === 0) continue // alias group unrelated to this doc type
      // all contract-runtimeKeys in the group must be the SAME key
      const distinct = new Set(hit)
      expect(distinct.size, `KEY_ALIASES group [${group}] maps to >1 contract field ${[...distinct]}`).toBe(1)
    }
  })

  it("date_of_birth ↔ dob agree across D and the contract", () => {
    // KEY_ALIASES: date_of_birth -> [dob]; contract: runtimeKey date_of_birth, readSideKey dob.
    expect(KEY_ALIASES.date_of_birth).toContain('dob')
    expect(readKeyToRuntime('dob')).toBe('date_of_birth')
  })

  it('family_name / given_name latin aliases resolve to the same contract field', () => {
    // KEY_ALIASES: family_name -> [family_name_latin] (raw vs latin value layer of ONE field).
    expect(fieldByRuntimeKey(primaryKeyOf('family_name_latin'))?.runtimeKey).toBe('family_name')
    expect(fieldByRuntimeKey(primaryKeyOf('given_name_latin'))?.runtimeKey).toBe('given_name')
  })

  it('patronymic is grouped under middle_name in D but the contract preserves the "Patronymic" label (HARD RULE)', () => {
    // KEY_ALIASES treats patronymic as a synonym of the USCIS form field middle_name,
    // but the contract MUST still label it "Patronymic", never "Middle Name".
    expect(KEY_ALIASES.middle_name).toContain('patronymic')
    const f = fieldByRuntimeKey('patronymic')
    expect(f, 'contract has a patronymic field').toBeDefined()
    expect(f?.englishLabel).toBe('Patronymic')
    expect(f?.englishLabel).not.toBe('Middle Name')
  })
})

describe('Phase 2 — C crop layer (FIELD_BOX_TEMPLATES) reconciles to contract runtimeKeys', () => {
  const cropKeys = Object.keys(FIELD_BOX_TEMPLATES.ua_birth_certificate ?? {})

  it('the crop layer covers the three child-name fields', () => {
    expect(cropKeys.sort()).toEqual(['family_name', 'given_name', 'patronymic'])
  })

  it('every crop key is a contract runtimeKey whose locator is fixed_region', () => {
    for (const k of cropKeys) {
      const f = fieldByRuntimeKey(k)
      expect(f, `crop key '${k}' must be a contract field`).toBeDefined()
      expect(f?.locator, `crop field '${k}' must be a fixed_region locator`).toBe('fixed_region')
    }
  })
})

describe('Phase 2 — latent HTR empty-intersection bug pinned (SCHEMA_AUDIT conflict #1)', () => {
  // documentFieldReader.ts:595 — pinned literal (not exported). If this drifts, update here.
  const HTR_NAME_FIELDS = new Set(['family_name', 'given_name', 'patronymic'])
  // A read-side child-name keys (documentRegistry DocTypeSpec ua_birth_certificate).
  const A_CHILD_NAME_KEYS = ['child_family_name', 'child_given_name', 'child_patronymic']

  it('TODAY the raw A keys are NOT in HTR_NAME_FIELDS → intersection empty → HTR never fires (the bug)', () => {
    for (const a of A_CHILD_NAME_KEYS) {
      expect(HTR_NAME_FIELDS.has(a), `'${a}' should NOT match HTR_NAME_FIELDS directly`).toBe(false)
    }
  })

  it('the contract BRIDGES it: each A child-name key maps to a runtimeKey that IS in HTR_NAME_FIELDS', () => {
    for (const a of A_CHILD_NAME_KEYS) {
      const rt = readKeyToRuntime(a)
      expect(rt, `contract must map '${a}'`).toBeDefined()
      expect(HTR_NAME_FIELDS.has(rt!), `'${a}' → '${rt}' must land in HTR_NAME_FIELDS`).toBe(true)
    }
  })
})
