/**
 * buildMirrorValues — the missing bridge between EXTRACTION and the official
 * MIRROR schema. readDocument emits fields keyed by docintel-registry names
 * (child_family_name, dob, place_of_birth_city, ...); the official schema uses
 * its own normative keys (child_surname, date_of_birth, place_of_birth, ...).
 * This maps the former to the latter so renderOfficialTranslation can draw a
 * faithful English mirror from REAL data (previously it was fed only by mockOCR).
 *
 * Phase 3 contract: release value is finalValue-first (final_value when C3 ran,
 * else normalized_value). Review/uncertain fields carry review=true so the
 * renderer marks them [CONFIRM]; missing fields stay blank → [enter from document].
 * No value is ever invented.
 */
import type { OfficialFormSchema } from '../forms/ukraine/schemas/types'

export interface FieldValue { value: string; review: boolean; canRead: boolean }

/** A field as it arrives from extraction / the generate-pdf payload. */
export interface ExtractedFieldLite {
  field: string
  value?: string | null
  normalized_value?: string | null
  final_value?: string | null
  review_required?: boolean | null
}

/**
 * Per-docType alias map: EXTRACTION field name → SCHEMA key.
 * Only renames are listed; keys that already match are resolved directly.
 * Schema keys with no extraction source (e.g. series_number, oblast_of_birth)
 * are left blank and the renderer prompts the user to enter them.
 */
const ALIASES: Record<string, Record<string, string>> = {
  ua_birth_certificate: {
    child_family_name: 'child_surname',
    dob: 'date_of_birth',
    place_of_birth_city: 'place_of_birth',
    province_of_birth: 'oblast_of_birth',
    issuing_authority: 'place_of_registration',
  },
  ua_marriage_certificate: {
    // date_of_marriage / act_record_number / issuing_authority / date_of_issue match directly
  },
  ua_divorce_certificate: {
    // date_of_divorce / act_record_number / issuing_authority match directly
  },
}

function releaseValue(f: ExtractedFieldLite): string {
  // finalValue-first (Phase 3), then normalized_value, then value.
  const v = f.final_value !== undefined && f.final_value !== null
    ? f.final_value
    : (f.normalized_value ?? f.value ?? '')
  return (v ?? '').trim()
}

/**
 * Build the schema-keyed value map the mirror renderer expects.
 * Every schema field gets an entry: present+clean, present+review, or blank.
 */
export function buildMirrorValues(
  schema: OfficialFormSchema,
  extracted: ExtractedFieldLite[],
): Record<string, FieldValue> {
  const alias = ALIASES[schema.docType] ?? {}
  // Resolve each extracted field to its schema key (alias or identity).
  const bySchemaKey = new Map<string, ExtractedFieldLite>()
  for (const f of extracted) {
    const schemaKey = alias[f.field] ?? f.field
    // Prefer the first non-empty occurrence; don't let a later blank overwrite a value.
    const existing = bySchemaKey.get(schemaKey)
    if (!existing || (!releaseValue(existing) && releaseValue(f))) bySchemaKey.set(schemaKey, f)
  }

  const out: Record<string, FieldValue> = {}
  for (const spec of schema.fields) {
    const f = bySchemaKey.get(spec.key)
    if (!f) { out[spec.key] = { value: '', review: false, canRead: false }; continue }
    const value = releaseValue(f)
    if (!value) { out[spec.key] = { value: '', review: false, canRead: false }; continue }
    out[spec.key] = { value, review: f.review_required === true, canRead: true }
  }
  return out
}
