/**
 * uiWiring.test.ts — B3 UI wiring guard.
 *
 * Validates that ReparoleWizardV2 correctly routes to /api/reparole/ocr/extract
 * when NEXT_PUBLIC_ONE_CORE_REPAROLE_ENABLED=true and falls back to
 * /api/tps/ocr/extract when flag is OFF or slot is not covered by Core.
 *
 * Uses source-level inspection (same approach as shadowWiring.test.ts) so
 * this test runs in Node without mounting the React component.
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const WIZARD_PATH = path.resolve(
  __dirname,
  '../../../../../[locale]/services/re-parole-u4u/start/ReparoleWizardV2.tsx',
)
const SRC = fs.readFileSync(WIZARD_PATH, 'utf-8')

describe('ReparoleWizardV2 — B3 UI wiring', () => {
  it('declares REPAROLE_CORE_ENABLED from NEXT_PUBLIC_ONE_CORE_REPAROLE_ENABLED env var', () => {
    expect(SRC).toMatch(/REPAROLE_CORE_ENABLED\s*=\s*process\.env\.NEXT_PUBLIC_ONE_CORE_REPAROLE_ENABLED\s*===\s*['"]true['"]/)
  })

  it('defines CORE_COVERED_SLOTS with passport and booklet', () => {
    expect(SRC).toMatch(/CORE_COVERED_SLOTS/)
    expect(SRC).toMatch(/['"]passport['"]/)
    expect(SRC).toMatch(/['"]booklet['"]/)
  })

  it('routes to /api/reparole/ocr/extract when flag ON and slot covered', () => {
    expect(SRC).toMatch(/\/api\/reparole\/ocr\/extract/)
    // The ocrRoute selection logic must include both routes
    expect(SRC).toMatch(/useCoreRoute\s*\?\s*['"]\/api\/reparole\/ocr\/extract['"]/)
  })

  it('falls back to /api/tps/ocr/extract when flag OFF (old path unchanged)', () => {
    // The old route must still appear as the fallback
    expect(SRC).toMatch(/\/api\/tps\/ocr\/extract['"]/)
  })

  it('uses REPAROLE_CORE_ENABLED AND CORE_COVERED_SLOTS.has(id) for route selection', () => {
    expect(SRC).toMatch(/REPAROLE_CORE_ENABLED && CORE_COVERED_SLOTS\.has\(id\)/)
  })

  it('handles Core response shape when _core===true (maps date_of_birth to dob)', () => {
    expect(SRC).toMatch(/json\?\._core\s*===\s*true/)
    // date_of_birth → dob mapping must exist
    expect(SRC).toMatch(/date_of_birth.*dob/)
  })

  it('handles old TPS response shape (json.module.fields) when flag OFF', () => {
    expect(SRC).toMatch(/json\?\.module\?\.fields/)
  })

  it('does not call /api/reparole/ocr/extract for i94 slot (Core does not cover it)', () => {
    // The route selection logic must check CORE_COVERED_SLOTS — i94 is NOT in that set
    // so the wizard will always use old path for i94
    const coreSetDef = SRC.match(/CORE_COVERED_SLOTS\s*=\s*new Set\(\[([^\]]*)\]\)/)
    expect(coreSetDef).not.toBeNull()
    const setContents = coreSetDef?.[1] ?? ''
    expect(setContents).not.toMatch(/i94/)
    expect(setContents).not.toMatch(/ead/)
    expect(setContents).not.toMatch(/dl/)
  })
})

// ── Response shape integration tests (pure logic, no fetch) ──────────────────

/**
 * Simulate the Core response → FieldExtraction mapping logic extracted
 * from handleUpload. This validates both response shapes without mounting React.
 */

type ExtractionSource =
  | 'ocr_mrz' | 'ocr_visual' | 'ocr_keyword'
  | 'ai_brain' | 'user_input' | 'user_corrected' | 'inferred'

interface FieldExtraction {
  value: string
  source: ExtractionSource
  requires_review: boolean
  doc_slot: string
}

function parseCoreResponse(json: Record<string, unknown>, id: string): Record<string, FieldExtraction> {
  const CORE_FIELD_MAP: Record<string, string> = {
    family_name: 'family_name',
    given_name: 'given_name',
    middle_name: 'middle_name',
    date_of_birth: 'dob',
    sex: 'sex',
    country_of_birth: 'country_of_birth',
    country_of_nationality: 'country_of_nationality',
    passport_number: 'passport_number',
    passport_expiration_date: 'passport_expiration_date',
    i94_admission_number: 'i94_admission_number',
    last_entry_date: 'last_entry_date',
    i94_class_of_admission: 'i94_class_of_admission',
    a_number: 'a_number',
  }
  const uncertainSet = new Set<string>(
    Array.isArray(json.uncertain_fields) ? json.uncertain_fields as string[] : [],
  )
  const fields: Record<string, FieldExtraction> = {}
  for (const [coreKey, wizardKey] of Object.entries(CORE_FIELD_MAP)) {
    const v = json[coreKey]
    if (typeof v !== 'string' || !v) continue
    const needsReview = Boolean(json.review_required) || uncertainSet.has(coreKey)
    fields[wizardKey] = {
      value: v,
      source: 'ai_brain',
      requires_review: needsReview,
      doc_slot: id,
    }
  }
  return fields
}

describe('Core response parsing — ReParoleCoreAnswers → FieldExtraction', () => {
  it('maps family_name / given_name / date_of_birth (as dob) correctly', () => {
    const coreResp = {
      ok: true,
      _core: true,
      _flag: 'ONE_CORE_REPAROLE_ENABLED',
      core_status: 'ok',
      fallback_used: false,
      review_required: false,
      uncertain_fields: [],
      family_name: 'SHEVCHENKO',
      given_name: 'TARAS',
      date_of_birth: '1814-03-09',
      sex: 'M',
      country_of_birth: 'Ukraine',
      country_of_nationality: 'Ukraine',
      passport_number: 'AA123456',
      passport_expiration_date: '2030-01-01',
      i94_admission_number: null,
      last_entry_date: null,
      i94_class_of_admission: null,
      a_number: null,
    }
    const fields = parseCoreResponse(coreResp, 'passport')
    expect(fields.family_name?.value).toBe('SHEVCHENKO')
    expect(fields.given_name?.value).toBe('TARAS')
    expect(fields.dob?.value).toBe('1814-03-09')
    expect(fields.sex?.value).toBe('M')
    expect(fields.dob?.source).toBe('ai_brain')
    expect(fields.dob?.requires_review).toBe(false)
  })

  it('sets requires_review=true when core_status is partial', () => {
    const coreResp = {
      ok: true,
      _core: true,
      core_status: 'partial',
      fallback_used: false,
      review_required: true,
      uncertain_fields: ['date_of_birth'],
      family_name: 'KOVALENKO',
      given_name: 'OKSANA',
      date_of_birth: null, // missing — uncertain
    }
    const fields = parseCoreResponse(coreResp, 'passport')
    expect(fields.family_name?.requires_review).toBe(true) // review_required=true propagates
    expect(fields.dob).toBeUndefined() // null → not added
  })

  it('does not add i94 fields when i94_admission_number is null', () => {
    const coreResp = {
      ok: true,
      _core: true,
      core_status: 'ok',
      fallback_used: false,
      review_required: false,
      uncertain_fields: ['i94_admission_number'],
      family_name: 'BONDAR',
      given_name: 'MYKOLA',
      date_of_birth: '1990-06-15',
      i94_admission_number: null, // not uploaded — stays null
    }
    const fields = parseCoreResponse(coreResp, 'passport')
    expect(fields.i94_admission_number).toBeUndefined()
  })

  it('handles fallback_used=true response without throwing', () => {
    const coreResp = {
      ok: true,
      _core: true,
      core_status: 'ok',
      fallback_used: true,
      review_required: false,
      uncertain_fields: [],
      family_name: 'PETRENKO',
      given_name: 'IVAN',
      date_of_birth: '1985-11-20',
    }
    expect(() => parseCoreResponse(coreResp, 'passport')).not.toThrow()
    const fields = parseCoreResponse(coreResp, 'passport')
    expect(fields.family_name?.value).toBe('PETRENKO')
  })
})
