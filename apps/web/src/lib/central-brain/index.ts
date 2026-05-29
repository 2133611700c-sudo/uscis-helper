/**
 * Central Brain — single entry point for all products. Migrated products run
 * through the shared recognition engine; un-migrated return delegated_to_legacy
 * (their existing pipeline untouched — TPS never breaks).
 */
import { extractDocument } from '../engine/orchestrator'
import { eligibilityCategory } from '../engine/eadCategory'
import type { NamedReader } from '../engine/consensus'
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

export interface BrainDeps { readers?: NamedReader[]; proseTranslator?: ProseTranslator }

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

  // ── translation (MIGRATED): readers → consensus → D2 → D3 ──
  if (!deps.readers || deps.readers.length < 2) {
    throw new Error('translation requires ≥2 independent readers (single reader = hallucination risk)')
  }
  const fields: BrainField[] = []
  const sources = new Set<string>()
  for (const doc of req.documents) {
    const r = await extractDocument(doc.image, doc.mime, doc.docTypeId, deps.readers, { proseTranslator: deps.proseTranslator })
    if (OFFICIAL_SOURCE[doc.docTypeId]) sources.add(OFFICIAL_SOURCE[doc.docTypeId])
    for (const f of r.fields) {
      fields.push({ field: f.field, value: f.latin, cyrillic: f.cyrillic,
        can_read: f.can_read, review_required: f.review_required, source: f.source })
    }
  }
  // EAD: eligibility category is chosen by rules from a CONFIRMED basis, never guessed.
  if (req.product === 'ead') {
    const cat = eligibilityCategory(req.userCorrections?.eligibility_basis)
    fields.push(cat
      ? { field: 'eligibility_category', value: `${cat.code} — ${cat.label}`, cyrillic: '', can_read: true, review_required: true, source: 'rules:confirmed-basis' }
      : { field: 'eligibility_category', value: '', cyrillic: '', can_read: false, review_required: true, source: 'rules:basis-not-confirmed (must be selected, not guessed)' })
  }
  const reviewRequiredFields = fields.filter((f) => f.review_required).map((f) => f.field)
  const missingRequiredFields = fields.filter((f) => !f.can_read).map((f) => f.field)
  const productReadiness = missingRequiredFields.length ? 'incomplete'
    : reviewRequiredFields.length ? 'needs_review' : 'ready'

  return { product: req.product, migrated: true, docTypes, recognizedFields: fields,
    reviewRequiredFields, missingRequiredFields, productReadiness,
    officialSourcesUsed: [...sources],
    auditId: recordAudit({ product: req.product, officialSources: [...sources], fields: fields.map((f) => ({ field: f.field, value: f.value, source: f.source, can_read: f.can_read, review_required: f.review_required })) }),
    riskFlags: [...(req.product==='reparole_u4u'?['intake/recognition only — I-131 generation still via legacy generate-packet']:[]), ...(req.product==='ead'?['I-765 generation still via legacy generate-packet; category by rules not AI']:[])] }
}
