/**
 * translationBridge.ts — connects TPS Robot to Translation Engine v5.
 *
 * One upload → two products:
 * - TPS forms (I-821, I-765) via pdfPrefiller
 * - Translation PDF + Certification via generateTranslationHTML
 *
 * This bridge does NOT rebuild anything. It takes extracted fields
 * from TPSAnswers and feeds them into the existing translation templates.
 *
 * ADR-006: One upload, two products.
 */

// ── Types ────────────────────────────────────────────────────────────────

/** Document types that the TPS pipeline extracts */
export type TPSDocumentType =
  | 'passport'          // International passport (MRZ)
  | 'passportBooklet'   // Ukrainian internal passport
  | 'i94'               // I-94 Arrival/Departure Record
  | 'ead'               // Employment Authorization Document
  | 'i797'              // USCIS Approval Notice
  | 'dl'                // Driver License / State ID

/** Translation template identifier */
export type TranslationTemplate =
  | 'internationalPassport'
  | 'passportBooklet'

/** Contract between TPS wizard and Translation engine */
export interface TranslationBridgePayload {
  document_type: TPSDocumentType
  source_pages: Array<{
    page_index: number
    is_blank: boolean
    image_data_url?: string  // base64 for non-blank pages
  }>
  normalized_fields: Record<string, string>
  controlling_spellings: Record<string, string>
  review_required: string[]
  confidence_map: Record<string, number>
  locale: 'uk' | 'ru' | 'en' | 'es'
}

/** Result from translation generation */
export interface TranslationBridgeResult {
  translation_html: string
  certification_html: string
  document_type: TPSDocumentType
  template_used: TranslationTemplate
  translated_pages: number
  blank_pages: number
  fields_translated: number
  review_warnings: string[]
}

// ── Rules ────────────────────────────────────────────────────────────────

/**
 * Determines if a document type needs translation for TPS packet.
 *
 * Rule: translate ONLY foreign-language evidence documents.
 * I-94, I-797, EAD, DL are already in English → no translation needed.
 * 8 CFR §103.2(b)(3): "Any document in a foreign language must be
 * accompanied by a full English translation."
 */
export function shouldTranslateForTPSPacket(docType: TPSDocumentType): boolean {
  switch (docType) {
    case 'passportBooklet':     return true   // Ukrainian, always needs translation
    case 'passport':            return true   // Ukrainian passport, MRZ is Latin but doc is bilingual
    case 'i94':                 return false  // English (CBP document)
    case 'ead':                 return false  // English (USCIS document)
    case 'i797':                return false  // English (USCIS document)
    case 'dl':                  return false  // English (US state document)
    default:                    return false
  }
}

/**
 * Resolves which translation template to use for a document type.
 * Strict mapping — no guessing.
 */
export function resolveTranslationTemplate(docType: TPSDocumentType): TranslationTemplate | null {
  switch (docType) {
    case 'passportBooklet':     return 'passportBooklet'
    case 'passport':            return 'internationalPassport'
    default:                    return null
  }
}

/**
 * ZIP manifest — canonical file names for translation outputs.
 */
export function translationFileName(docType: TPSDocumentType): string {
  switch (docType) {
    case 'passportBooklet':     return 'Translation_Internal_Passport.pdf'
    case 'passport':            return 'Translation_International_Passport.pdf'
    default:                    return `Translation_${docType}.pdf`
  }
}

export const CERTIFICATION_FILENAME = 'Certification_Translation.pdf'

/**
 * Checks if the TPS packet is complete regarding translations.
 * Returns list of missing translations (empty = all good).
 */
export function checkTranslationCompleteness(
  uploadedDocTypes: TPSDocumentType[],
  generatedTranslations: TPSDocumentType[],
): string[] {
  const missing: string[] = []
  for (const docType of uploadedDocTypes) {
    if (shouldTranslateForTPSPacket(docType)) {
      if (!generatedTranslations.includes(docType)) {
        missing.push(`Missing translation for ${docType}`)
      }
    }
  }
  return missing
}
