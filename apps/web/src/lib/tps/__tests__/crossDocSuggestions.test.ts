/**
 * crossDocSuggestions.test.ts — CLIENT Seam A pure helpers. Deterministic, no network/Gemini.
 * Proves: defensive capture (flag-OFF [] ⇒ [], malformed ⇒ [], never throws); apply produces a
 * HELD pre-filled field (one-click confirm, never auto-applied) without mutating input; the
 * server→wizard key alias; and (source-inspection) that the live wizard imports + calls them.
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import {
  extractCrossDocSuggestions,
  applyCrossDocSuggestion,
  wizardFieldKey,
  type CrossDocField,
} from '../crossDocSuggestions'

describe('extractCrossDocSuggestions', () => {
  it('parses a valid one-suggestion response', () => {
    const resp = {
      ok: true,
      cross_doc_suggestions: [
        { field_key: 'date_of_birth', suggested_value: '1986-06-25', from_doc_type: 'ua_international_passport' },
      ],
    }
    expect(extractCrossDocSuggestions(resp)).toEqual([
      { field_key: 'date_of_birth', suggested_value: '1986-06-25', from_doc_type: 'ua_international_passport' },
    ])
  })

  it('flag-OFF shape (empty array) ⇒ []', () => {
    expect(extractCrossDocSuggestions({ ok: true, cross_doc_suggestions: [] })).toEqual([])
  })

  it('missing key entirely ⇒ [] (no throw)', () => {
    expect(extractCrossDocSuggestions({ ok: true })).toEqual([])
  })

  it('malformed inputs ⇒ [] (never throws)', () => {
    expect(extractCrossDocSuggestions(null)).toEqual([])
    expect(extractCrossDocSuggestions(undefined)).toEqual([])
    expect(extractCrossDocSuggestions('string')).toEqual([])
    expect(extractCrossDocSuggestions(42)).toEqual([])
    expect(extractCrossDocSuggestions({ cross_doc_suggestions: 'x' })).toEqual([])
    expect(extractCrossDocSuggestions({ cross_doc_suggestions: [null, 1, 'y'] })).toEqual([])
  })

  it('filters entries missing any key or with non-string / empty values', () => {
    const resp = {
      cross_doc_suggestions: [
        { field_key: 'dob', suggested_value: '1986-06-25', from_doc_type: 'passport' }, // good
        { field_key: 'sex', suggested_value: '' , from_doc_type: 'passport' }, // empty value
        { field_key: '', suggested_value: 'X', from_doc_type: 'passport' }, // empty key
        { field_key: 'x', suggested_value: 'Y' }, // missing from_doc_type
        { field_key: 'n', suggested_value: 5, from_doc_type: 'p' }, // non-string value
      ],
    }
    expect(extractCrossDocSuggestions(resp)).toEqual([
      { field_key: 'dob', suggested_value: '1986-06-25', from_doc_type: 'passport' },
    ])
  })
})

describe('applyCrossDocSuggestion', () => {
  const s = { field_key: 'date_of_birth', suggested_value: '1986-06-25', from_doc_type: 'ua_international_passport' }

  it('held/undefined current ⇒ pre-filled field, STILL held for review', () => {
    const out = applyCrossDocSuggestion(undefined, s)
    expect(out.value).toBe('1986-06-25')
    expect(out.requires_review).toBe(true) // never auto-applied
    expect(out.source).toBe('inferred') // existing enum member
    expect(out.source_document_id).toBe('cross_doc:ua_international_passport')
    expect(out.source_zone).toBe('cross_doc_reconciled')
  })

  it('preserves doc_slot from the current field when present', () => {
    const cur: CrossDocField = {
      value: '', source: 'ai_vision', requires_review: true, doc_slot: 'birth_certificate',
      source_document_id: null, source_zone: null, raw_value: null, confidence: null,
    }
    expect(applyCrossDocSuggestion(cur, s).doc_slot).toBe('birth_certificate')
  })

  it('does NOT mutate the input field', () => {
    const cur: CrossDocField = {
      value: 'held', source: 'ai_vision', requires_review: true, doc_slot: 'birth_certificate',
      source_document_id: null, source_zone: null, raw_value: null, confidence: null,
    }
    const frozen = Object.freeze({ ...cur })
    applyCrossDocSuggestion(cur, s)
    expect(cur).toEqual(frozen) // unchanged
  })
})

describe('wizardFieldKey alias', () => {
  it('maps canonical keys to wizard keys', () => {
    expect(wizardFieldKey('date_of_birth')).toBe('dob')
    expect(wizardFieldKey('patronymic')).toBe('middle_name')
  })
  it('passes through unknown / already-matching keys', () => {
    expect(wizardFieldKey('family_name')).toBe('family_name')
    expect(wizardFieldKey('sex')).toBe('sex')
  })
})

describe('TPSWizardV2 wires the pure helpers (source contract)', () => {
  const SRC = fs.readFileSync(
    path.resolve(__dirname, '../../../app/[locale]/services/tps-ukraine/start/TPSWizardV2.tsx'),
    'utf-8',
  )
  it('imports from the pure module', () => {
    expect(SRC).toMatch(/from\s*['"]@\/lib\/tps\/crossDocSuggestions['"]/)
  })
  it('captures suggestions from the response and applies them on click', () => {
    expect(SRC).toMatch(/extractCrossDocSuggestions\(/)
    expect(SRC).toMatch(/applyCrossDocSuggestion\(/)
  })
})
