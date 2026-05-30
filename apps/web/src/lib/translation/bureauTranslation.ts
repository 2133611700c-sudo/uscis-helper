/**
 * bureauTranslation.ts — end-to-end bureau-style translation PDF for a civil-status
 * document: recognized (already-normalized English) fields → canonical mapping →
 * official schema values → renderOfficialTranslation (pdf-lib). FLAG-GATED at the
 * route; this module changes nothing on its own.
 *
 * Pipeline: recognized {field:value} → mapping (raw→canonical, e.g. child_full_name
 * split) → FieldValue map (value/review/canRead) → official bureau PDF.
 */
import { renderOfficialTranslation, type FieldValue } from './pdf/templates/ukraine/renderOfficialTranslation'
import type { OfficialFormSchema } from './forms/ukraine/schemas/types'
import { birthCertificateSchema } from './forms/ukraine/schemas/birth-certificate.schema'
import { marriageCertificateSchema } from './forms/ukraine/schemas/marriage-certificate.schema'
import { divorceCertificateSchema } from './forms/ukraine/schemas/divorce-certificate.schema'
import { deathCertificateSchema } from './forms/ukraine/schemas/death-certificate.schema'
import { nameChangeCertificateSchema } from './forms/ukraine/schemas/name-change-certificate.schema'
import { mapBirthCertificate } from './forms/ukraine/mappings/birthCertificate.mapping'

const SCHEMAS: Record<string, OfficialFormSchema> = {
  ua_birth_certificate: birthCertificateSchema,
  ua_marriage_certificate: marriageCertificateSchema,
  ua_divorce_certificate: divorceCertificateSchema,
  ua_death_certificate: deathCertificateSchema,
  ua_name_change_certificate: nameChangeCertificateSchema,
}

export function bureauSchemaFor(docType: string): OfficialFormSchema | null {
  return SCHEMAS[docType] ?? null
}

/** Apply the canonical mapping for a doc type (recognized keys → schema keys). */
function mapRecognized(docType: string, recognized: Record<string, string>): Record<string, { value: string; reviewRequired: boolean }> {
  if (docType === 'ua_birth_certificate') return mapBirthCertificate(recognized)
  // generic 1:1: recognized key == schema key (split-name docs add their own mappers later)
  const out: Record<string, { value: string; reviewRequired: boolean }> = {}
  for (const [k, v] of Object.entries(recognized)) if (v && v.trim()) out[k] = { value: v.trim(), reviewRequired: false }
  return out
}

export interface RecognizedField { field: string; normalized_value?: string | null; review_required?: boolean }

/**
 * Render the official bureau-style English translation PDF for a civil-status doc.
 * Returns null if the doc type has no official schema (caller falls back).
 */
export async function renderBureauTranslation(
  docType: string,
  fields: RecognizedField[],
  opts: { signerName?: string } = {},
): Promise<{ pdf: Buffer; unresolved: string[]; certifiable: boolean } | null> {
  const schema = bureauSchemaFor(docType)
  if (!schema) return null

  const recognized: Record<string, string> = {}
  const reviewByKey: Record<string, boolean> = {}
  for (const f of fields) {
    if (f.normalized_value && f.normalized_value.trim()) recognized[f.field] = f.normalized_value.trim()
    reviewByKey[f.field] = !!f.review_required
  }
  const mapped = mapRecognized(docType, recognized)

  const values: Record<string, FieldValue> = {}
  let missingRequired = 0
  for (const spec of schema.fields) {
    const m = mapped[spec.key]
    const value = m?.value ?? ''
    const canRead = !!value
    if (!canRead && spec.required) missingRequired++
    values[spec.key] = {
      value,
      canRead,
      // review if the mapping flagged it, OR the recognizer flagged the raw field,
      // OR the field-contract conditions apply (handwriting/etc. are surfaced upstream).
      review: (m?.reviewRequired ?? false) || (reviewByKey[spec.key] ?? false),
    }
  }

  const { pdf, unresolved } = await renderOfficialTranslation(schema, values, { signerName: opts.signerName })
  return { pdf, unresolved, certifiable: missingRequired === 0 }
}
