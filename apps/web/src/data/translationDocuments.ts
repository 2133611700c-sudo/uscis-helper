import {
  CarFront,
  FileText,
  Files,
  GraduationCap,
  IdCard,
  ScrollText,
  Shield,
  type LucideIcon,
} from 'lucide-react'

export type TranslationDocumentType =
  | 'passport'
  | 'birth-certificate'
  | 'marriage-certificate'
  | 'divorce-certificate'
  | 'diploma-transcript'
  | 'military-document'
  | 'driver-license'
  | 'other-document'

export interface TranslationDocumentConfig {
  id: TranslationDocumentType
  icon: LucideIcon
  titleKey: string
  descriptionKey: string
  fieldsIncludedKey: string
  uploadInstructionsKey: string
  riskNoteKey: string
}

export const translationDocuments: TranslationDocumentConfig[] = [
  {
    id: 'passport',
    icon: IdCard,
    titleKey: 'translationService.documents.passport.title',
    descriptionKey: 'translationService.documents.passport.description',
    fieldsIncludedKey: 'translationService.documents.passport.fieldsIncluded',
    uploadInstructionsKey: 'translationService.documents.passport.uploadInstructions',
    riskNoteKey: 'translationService.documents.passport.riskNote',
  },
  {
    id: 'birth-certificate',
    icon: FileText,
    titleKey: 'translationService.documents.birthCertificate.title',
    descriptionKey: 'translationService.documents.birthCertificate.description',
    fieldsIncludedKey: 'translationService.documents.birthCertificate.fieldsIncluded',
    uploadInstructionsKey: 'translationService.documents.birthCertificate.uploadInstructions',
    riskNoteKey: 'translationService.documents.birthCertificate.riskNote',
  },
  {
    id: 'marriage-certificate',
    icon: ScrollText,
    titleKey: 'translationService.documents.marriageCertificate.title',
    descriptionKey: 'translationService.documents.marriageCertificate.description',
    fieldsIncludedKey: 'translationService.documents.marriageCertificate.fieldsIncluded',
    uploadInstructionsKey: 'translationService.documents.marriageCertificate.uploadInstructions',
    riskNoteKey: 'translationService.documents.marriageCertificate.riskNote',
  },
  {
    id: 'divorce-certificate',
    icon: ScrollText,
    titleKey: 'translationService.documents.divorceCertificate.title',
    descriptionKey: 'translationService.documents.divorceCertificate.description',
    fieldsIncludedKey: 'translationService.documents.divorceCertificate.fieldsIncluded',
    uploadInstructionsKey: 'translationService.documents.divorceCertificate.uploadInstructions',
    riskNoteKey: 'translationService.documents.divorceCertificate.riskNote',
  },
  {
    id: 'diploma-transcript',
    icon: GraduationCap,
    titleKey: 'translationService.documents.diplomaTranscript.title',
    descriptionKey: 'translationService.documents.diplomaTranscript.description',
    fieldsIncludedKey: 'translationService.documents.diplomaTranscript.fieldsIncluded',
    uploadInstructionsKey: 'translationService.documents.diplomaTranscript.uploadInstructions',
    riskNoteKey: 'translationService.documents.diplomaTranscript.riskNote',
  },
  {
    id: 'military-document',
    icon: Shield,
    titleKey: 'translationService.documents.militaryDocument.title',
    descriptionKey: 'translationService.documents.militaryDocument.description',
    fieldsIncludedKey: 'translationService.documents.militaryDocument.fieldsIncluded',
    uploadInstructionsKey: 'translationService.documents.militaryDocument.uploadInstructions',
    riskNoteKey: 'translationService.documents.militaryDocument.riskNote',
  },
  {
    id: 'driver-license',
    icon: CarFront,
    titleKey: 'translationService.documents.driverLicense.title',
    descriptionKey: 'translationService.documents.driverLicense.description',
    fieldsIncludedKey: 'translationService.documents.driverLicense.fieldsIncluded',
    uploadInstructionsKey: 'translationService.documents.driverLicense.uploadInstructions',
    riskNoteKey: 'translationService.documents.driverLicense.riskNote',
  },
  {
    id: 'other-document',
    icon: Files,
    titleKey: 'translationService.documents.otherDocument.title',
    descriptionKey: 'translationService.documents.otherDocument.description',
    fieldsIncludedKey: 'translationService.documents.otherDocument.fieldsIncluded',
    uploadInstructionsKey: 'translationService.documents.otherDocument.uploadInstructions',
    riskNoteKey: 'translationService.documents.otherDocument.riskNote',
  },
]
