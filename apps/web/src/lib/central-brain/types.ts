/** Central Brain — unified contract for ALL Messenginfo products. */
export type Product = 'tps' | 'reparole_u4u' | 'ead' | 'translation'
export type Mode = 'normal' | 'owner' | 'test'

export interface BrainRequest {
  product: Product
  locale: string
  documents: Array<{ docTypeId: string; image: Buffer; mime: string }>
  userCorrections?: Record<string, string>
  mode?: Mode
}

export interface BrainField {
  field: string; value: string; cyrillic: string
  can_read: boolean; review_required: boolean; source: string
}

export interface BrainResult {
  product: Product
  migrated: boolean              // is this product wired to the central brain yet?
  docTypes: string[]
  recognizedFields: BrainField[]
  reviewRequiredFields: string[]
  missingRequiredFields: string[]
  productReadiness: 'ready' | 'needs_review' | 'incomplete' | 'delegated_to_legacy'
  officialSourcesUsed: string[]
  auditId: string | null
  riskFlags: string[]
}
