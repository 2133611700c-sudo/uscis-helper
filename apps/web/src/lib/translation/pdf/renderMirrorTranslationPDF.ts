/**
 * renderMirrorTranslationPDF — the wiring that turns REAL extracted fields into a
 * faithful English MIRROR of the Ukrainian official document.
 *
 *   docType + extracted fields
 *     → getOfficialSchema(docType)            (registry: docType → normative schema)
 *     → buildMirrorValues(schema, extracted)  (map registry keys → schema keys)
 *     → renderOfficialTranslation(schema, …)  (draw the mirror PDF by schema layout)
 *
 * Returns null when no official schema exists for the docType (caller falls back
 * to the generic certification PDF). The mirror reproduces the document's
 * structure per its KMU source — header, person groups, act record, issuing
 * authority, seal/signature placeholders, translator certification — never a
 * spontaneous layout, and never an invented value (uncertain → [CONFIRM],
 * missing → [enter from document]).
 */
import { getOfficialSchema } from '../forms/ukraine/schemas/registry'
import { buildMirrorValues, collectMirrorExtras, type ExtractedFieldLite } from './buildMirrorValues'
import { renderOfficialTranslation } from './templates/ukraine/renderOfficialTranslation'
import { applyContractSplitFlow, normalizeContractSplitFields } from '@/lib/contracts/contractFieldFlow'
import { isUnifiedDocContractSplitEnabled } from '@/lib/contracts/splitMergedFields'

export interface MirrorPdfResult {
  pdf: Buffer
  unresolved: string[]
  docType: string
  schemaTitle: string
  officialSource: { act: string; url: string; authority: string; effectiveDate: string }
}

export async function renderMirrorTranslationPDF(
  docType: string | null | undefined,
  extracted: ExtractedFieldLite[],
  opts: { signerName?: string; signerAddress?: string; signedAt?: string } = {},
  env: Record<string, string | undefined> = process.env,
): Promise<MirrorPdfResult | null> {
  const schema = getOfficialSchema(docType)
  if (!schema) return null
  // Workstream C — when the split flag is ON, the contract split fields become
  // first-class rows in the mirror (contract-labeled extras section). OFF (default)
  // → `extracted` unchanged → byte-identical golden.
  let rows = extracted
  if (isUnifiedDocContractSplitEnabled(env) && (docType ?? '') === 'ua_birth_certificate') {
    const fieldOut = extracted.map((f) => ({
      field: f.field, value: f.value ?? null, raw_cyrillic: null,
      confidence: 1, review_required: f.review_required ?? false, kind: 'text' as const,
    }))
    const split = normalizeContractSplitFields(applyContractSplitFlow(fieldOut, docType ?? '', env), env)
    rows = split.map((f) => ({ field: f.field, value: f.value, normalized_value: f.value, review_required: f.review_required }))
  }
  const values = buildMirrorValues(schema, rows, env)
  const extras = collectMirrorExtras(schema, rows, env)
  const { pdf, unresolved } = await renderOfficialTranslation(schema, values, { ...opts, extras }, env)
  return {
    pdf,
    unresolved,
    docType: schema.docType,
    schemaTitle: schema.titleEn,
    officialSource: schema.officialSource,
  }
}
