/**
 * Central Brain — single entry point for all products. Migrated products run
 * through the C3 recognition path (Gemini read + Google Vision presence-confirm,
 * winner of the 4-config bench: printed 5–6/6, handwriting 0 fabrications).
 * Un-migrated → delegated_to_legacy (existing flow untouched; TPS never breaks).
 */
import { extractDocumentPresence } from '../engine/presence'
import type { EngineResult } from '../engine/orchestrator'
import type { ProseTranslator } from '../engine/translator'
import { MIGRATION_STATE, brainHealth } from './health'
import { recordAudit } from './audit/ledger'
import type { BrainRequest, BrainResult, BrainField } from './types'
export { brainHealth }
export type { BrainRequest, BrainResult, Product } from './types'

const OFFICIAL_SOURCE: Record<string, string> = {
  ua_marriage_certificate: 'КМУ №1025 (10.11.2010)',
  ua_birth_certificate: 'КМУ №1025 (10.11.2010)',
  ua_divorce_certificate: 'КМУ №1025 (10.11.2010)',
  ua_internal_passport_booklet: 'КМУ №353 (1994) / ВРУ №2503-XII (1992)',
  ua_international_passport: 'КМУ №152 (2014)',
}

export interface BrainDeps {
  geminiApiKey?: string
  gvApiKey?: string
  proseTranslator?: ProseTranslator
  /** test/override hook — recognize one document (defaults to C3 presence path). */
  recognize?: (image: Buffer, mime: string, docTypeId: string) => Promise<EngineResult>
}

export async function analyze(req: BrainRequest, deps: BrainDeps = {}): Promise<BrainResult> {
  const state = MIGRATION_STATE[req.product]
  if (!state) throw new Error(`unknown product: ${req.product}`)
  const docTypes = req.documents.map((d) => d.docTypeId)

  if (!state.migrated) {
    return { product: req.product, migrated: false, docTypes, recognizedFields: [],
      reviewRequiredFields: [], missingRequiredFields: [], productReadiness: 'delegated_to_legacy',
      officialSourcesUsed: [], auditId: null,
      riskFlags: [`product not migrated (step ${state.step}): ${state.note}`] }
  }

  const recognize = deps.recognize ?? ((image: Buffer, mime: string, docTypeId: string) => {
    if (!deps.geminiApiKey || !deps.gvApiKey) throw new Error('central-brain requires geminiApiKey + gvApiKey (or an injected recognize)')
    return extractDocumentPresence(image, mime, docTypeId, { geminiApiKey: deps.geminiApiKey, gvApiKey: deps.gvApiKey, proseTranslator: deps.proseTranslator })
  })

  const fields: BrainField[] = []
  const sources = new Set<string>()
  for (const doc of req.documents) {
    const r = await recognize(doc.image, doc.mime, doc.docTypeId)
    if (OFFICIAL_SOURCE[doc.docTypeId]) sources.add(OFFICIAL_SOURCE[doc.docTypeId])
    for (const f of r.fields) fields.push({ field: f.field, value: f.latin, cyrillic: f.cyrillic, can_read: f.can_read, review_required: f.review_required, source: f.source })
  }

  // EAD: eligibility category chosen by rules from a CONFIRMED basis, never guessed.
  if (req.product === 'ead') {
    const { eligibilityCategory } = await import('../engine/eadCategory')
    const cat = eligibilityCategory(req.userCorrections?.eligibility_basis)
    fields.push(cat
      ? { field: 'eligibility_category', value: `${cat.code} — ${cat.label}`, cyrillic: '', can_read: true, review_required: true, source: 'rules:confirmed-basis' }
      : { field: 'eligibility_category', value: '', cyrillic: '', can_read: false, review_required: true, source: 'rules:basis-not-confirmed (must be selected, not guessed)' })
  }

  const reviewRequiredFields = fields.filter((f) => f.review_required).map((f) => f.field)
  const missingRequiredFields = fields.filter((f) => !f.can_read).map((f) => f.field)
  const productReadiness = missingRequiredFields.length ? 'incomplete' : reviewRequiredFields.length ? 'needs_review' : 'ready'

  return { product: req.product, migrated: true, docTypes, recognizedFields: fields,
    reviewRequiredFields, missingRequiredFields, productReadiness,
    officialSourcesUsed: [...sources],
    auditId: recordAudit({ product: req.product, officialSources: [...sources], fields: fields.map((f) => ({ field: f.field, value: f.value, source: f.source, can_read: f.can_read, review_required: f.review_required })) }),
    riskFlags: [...(req.product === 'reparole_u4u' ? ['intake/recognition only — I-131 generation still via legacy generate-packet'] : []), ...(req.product === 'ead' ? ['I-765 generation still via legacy generate-packet; category by rules not AI'] : [])] }
}
