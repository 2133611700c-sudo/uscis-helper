/**
 * Phase 10 / Workstream D — the single Gemini→contract extraction boundary.
 *
 * The live reader (docintel geminiVisionProvider) already derives its response
 * schema from the documentRegistry read-side spec — ONE schema source. This module
 * provides the CONTRACT-side counterpart: a schema generated from the Unified
 * Document Contract, a provenance record, and a sanitizer that enforces the
 * boundary invariants on any model response BEFORE it becomes canonical:
 *   - the model returns CANDIDATES only — it can never declare a field confirmed
 *     or write a release/final value (confirmation belongs to the user/reviewer);
 *   - unknown keys (not in the contract) are dropped (no schema drift / injection);
 *   - missing values are NOT fabricated (absent → omitted, never invented).
 *
 * Pure functions; no network/model call. Designed so a future flag-gated wiring can
 * route the live provider's raw response through sanitizeContractExtractionResponse.
 */
import { birthCertSovietV1Contract, BIRTH_CERT_LEGACY_DOCTYPE } from './birthCertSovietV1Contract'

export const CONTRACT_EXTRACTION_SCHEMA_VERSION = 'ua_birth_certificate_soviet_v1@1'

export interface ContractExtractionFieldSchema {
  key: string // the extraction (read-side) key the model fills
  required: boolean
  rendering: string
  criticality: string
}

/** Build the extraction schema for a docType from the contract (single source). */
export function buildContractExtractionSchema(docType: string | null | undefined): {
  docType: string
  schemaVersion: string
  fields: ContractExtractionFieldSchema[]
} | null {
  if ((docType ?? '') !== BIRTH_CERT_LEGACY_DOCTYPE) return null
  const fields = birthCertSovietV1Contract
    .filter((f) => f.readSideKey)
    .map((f) => ({
      key: f.readSideKey as string,
      required: f.occurrence === 'REQUIRED_ONCE' || f.occurrence === 'REQUIRED_MULTIPLE',
      rendering: f.rendering,
      criticality: f.criticality,
    }))
  return { docType: BIRTH_CERT_LEGACY_DOCTYPE, schemaVersion: CONTRACT_EXTRACTION_SCHEMA_VERSION, fields }
}

export interface ExtractionProvenance {
  provider: string
  requestedModel: string
  actualModel: string
  promptSchemaVersion: string
  extractedAt: string // ISO timestamp (caller-supplied; pure fn never reads the clock)
  sourcePage?: number | null
  /** true when actualModel !== requestedModel — a fallback was used (force review). */
  modelMismatch: boolean
}

export function buildExtractionProvenance(input: {
  provider: string
  requestedModel: string
  actualModel: string
  extractedAt: string
  sourcePage?: number | null
}): ExtractionProvenance {
  return {
    provider: input.provider,
    requestedModel: input.requestedModel,
    actualModel: input.actualModel,
    promptSchemaVersion: CONTRACT_EXTRACTION_SCHEMA_VERSION,
    extractedAt: input.extractedAt,
    sourcePage: input.sourcePage ?? null,
    modelMismatch: input.actualModel !== input.requestedModel,
  }
}

export interface RawModelField {
  field: string
  value?: string | null
  raw_cyrillic?: string | null
  // anything the model might (incorrectly) try to assert — stripped below:
  confirmed?: unknown
  final_value?: unknown
  [k: string]: unknown
}

export interface SanitizedField {
  field: string
  value: string | null
  raw_cyrillic: string | null
  review_required: boolean
  confirmed: false // ALWAYS false out of the model boundary
}

export interface SanitizeResult {
  fields: SanitizedField[]
  droppedUnknownKeys: string[]
  strippedConfirmedClaims: string[]
}

/**
 * Enforce the boundary on a raw model response: drop unknown keys, strip any
 * model-claimed confirmed/final_value, keep only candidate values, never fabricate.
 */
export function sanitizeContractExtractionResponse(
  raw: RawModelField[],
  docType: string | null | undefined,
): SanitizeResult {
  const schema = buildContractExtractionSchema(docType)
  const known = schema ? new Set(schema.fields.map((f) => f.key)) : null
  const handwritten = new Map((schema?.fields ?? []).map((f) => [f.key, f.rendering === 'handwritten']))
  const fields: SanitizedField[] = []
  const droppedUnknownKeys: string[] = []
  const strippedConfirmedClaims: string[] = []

  for (const r of raw) {
    if (known && !known.has(r.field)) { droppedUnknownKeys.push(r.field); continue }
    if (r.confirmed !== undefined || r.final_value !== undefined) strippedConfirmedClaims.push(r.field)
    const value = typeof r.value === 'string' && r.value.trim() ? r.value : null
    const rawCyr = typeof r.raw_cyrillic === 'string' && r.raw_cyrillic.trim() ? r.raw_cyrillic : null
    // candidate-only; handwritten/critical fields always need review; no fabrication.
    fields.push({
      field: r.field,
      value,
      raw_cyrillic: rawCyr,
      review_required: handwritten.get(r.field) === true || value === null,
      confirmed: false,
    })
  }
  return { fields, droppedUnknownKeys, strippedConfirmedClaims }
}
