'use client'

import { useMemo, useState } from 'react'
import { ArrowLeft, CheckCircle2, Download, FileCheck2 } from 'lucide-react'
import { type TranslationDocumentType } from '@/data/translationDocuments'
import { translationDocuments } from '@/data/translationDocuments'
import { downloadTranslationTemplate } from '@/lib/translation/generateTranslationHTML'
import { DocumentUploadBox } from './DocumentUploadBox'
import { OfficialTranslationSourceBox } from './OfficialTranslationSourceBox'

interface TranslationDocumentContent {
  title: string
  description: string
  panelTitle: string
  fieldsIncluded: string[]
  uploadInstructions: string[]
  riskNote: string
}

interface TranslationMessages {
  documents: Record<string, TranslationDocumentContent>
  panel: {
    whatYouGet: string
    whatToUpload: string
    uploadButton: string
    createDraftButton: string
    useAnotherDocument: string
  }
  upload: {
    dropText: string
    acceptedTypes: string
    maxSize: string
    privacyNote: string
    localOnlyNotice: string
    fileTooLarge: string
    unsupportedType: string
    heicWarning: string
    removeFile: string
  }
  result: {
    placeholderTitle: string
    noBackend: string
    draftOnly: string
    downloadDraft: string
    sendToEmail: string
    startAnother: string
  }
  source: {
    sourceLabel: string
    title: string
    body: string
    uscisPolicyManual: string
    ecfr: string
    lastCheckedLabel: string
  }
}

interface TranslationServicePanelProps {
  selectedDocument: TranslationDocumentType
  messages: TranslationMessages
  onResetDocument: () => void
}

const MAX_FILE_BYTES = 10 * 1024 * 1024

// ---------------------------------------------------------------------------
// Field definitions per document type
// ---------------------------------------------------------------------------

type FieldDef = { key: string; label: string; required: boolean }

const MANUAL_FIELDS: Record<string, FieldDef[]> = {
  passport: [
    { key: 'full_name', label: 'Full Legal Name (Last, First, Middle)', required: true },
    { key: 'date_of_birth', label: 'Date of Birth', required: true },
    { key: 'place_of_birth', label: 'Place of Birth (City, Country)', required: true },
    { key: 'nationality', label: 'Nationality / Citizenship', required: false },
    { key: 'gender', label: 'Gender', required: false },
    { key: 'document_number', label: 'Passport Number', required: true },
    { key: 'issue_date', label: 'Date of Issue', required: false },
    { key: 'expiry_date', label: 'Date of Expiry', required: false },
    { key: 'issuing_authority', label: 'Issuing Authority', required: false },
  ],
  'birth-certificate': [
    { key: 'full_name', label: "Child's Full Legal Name", required: true },
    { key: 'date_of_birth', label: 'Date of Birth', required: true },
    { key: 'place_of_birth', label: 'Place of Birth (City, Region, Country)', required: true },
    { key: 'father_name', label: "Father's Full Name", required: false },
    { key: 'mother_name', label: "Mother's Full Name", required: false },
    { key: 'document_number', label: 'Certificate / Registration Number', required: false },
    { key: 'issue_date', label: 'Date of Issue', required: false },
    { key: 'issuing_authority', label: 'Issuing Authority (Office / City)', required: false },
  ],
  'marriage-certificate': [
    { key: 'spouse1_name', label: 'Spouse 1 — Full Legal Name', required: true },
    { key: 'spouse2_name', label: 'Spouse 2 — Full Legal Name', required: true },
    { key: 'date_of_marriage', label: 'Date of Marriage', required: true },
    { key: 'place_of_marriage', label: 'Place of Marriage (City, Country)', required: false },
    { key: 'document_number', label: 'Certificate / Registration Number', required: false },
    { key: 'issue_date', label: 'Date of Issue', required: false },
    { key: 'issuing_authority', label: 'Issuing Authority', required: false },
  ],
  'divorce-certificate': [
    { key: 'spouse1_name', label: 'Former Spouse 1 — Full Legal Name', required: true },
    { key: 'spouse2_name', label: 'Former Spouse 2 — Full Legal Name', required: true },
    { key: 'date_of_divorce', label: 'Date of Divorce', required: true },
    { key: 'place_of_divorce', label: 'Place of Divorce (City, Country)', required: false },
    { key: 'document_number', label: 'Certificate / Registration Number', required: false },
    { key: 'issue_date', label: 'Date of Issue', required: false },
    { key: 'issuing_authority', label: 'Issuing Authority / Court', required: false },
  ],
  'diploma-transcript': [
    { key: 'full_name', label: "Graduate's Full Legal Name", required: true },
    { key: 'degree_title', label: 'Degree / Qualification Title', required: true },
    { key: 'institution', label: 'Name of Institution', required: true },
    { key: 'graduation_date', label: 'Date of Graduation', required: false },
    { key: 'document_number', label: 'Diploma / Certificate Number', required: false },
    { key: 'issuing_authority', label: 'Issuing Authority', required: false },
  ],
  'military-document': [
    { key: 'full_name', label: "Service Member's Full Legal Name", required: true },
    { key: 'date_of_birth', label: 'Date of Birth', required: false },
    { key: 'document_number', label: 'Document Number / Military ID', required: false },
    { key: 'service_branch', label: 'Branch of Service', required: false },
    { key: 'issue_date', label: 'Date of Issue', required: false },
    { key: 'issuing_authority', label: 'Issuing Authority', required: false },
  ],
  'driver-license': [
    { key: 'full_name', label: "Driver's Full Legal Name", required: true },
    { key: 'date_of_birth', label: 'Date of Birth', required: true },
    { key: 'address', label: 'Address on Document', required: false },
    { key: 'document_number', label: 'License Number', required: true },
    { key: 'issue_date', label: 'Date of Issue', required: false },
    { key: 'expiry_date', label: 'Date of Expiry', required: false },
    { key: 'issuing_authority', label: 'Issuing Authority (State / Country)', required: false },
  ],
}

const DEFAULT_MANUAL_FIELDS: FieldDef[] = [
  { key: 'full_name', label: 'Full Legal Name', required: true },
  { key: 'date_of_birth', label: 'Date of Birth', required: false },
  { key: 'document_number', label: 'Document Number', required: false },
  { key: 'issue_date', label: 'Date of Issue', required: false },
  { key: 'issuing_authority', label: 'Issuing Authority', required: false },
]

function getFieldsForDocument(docType: TranslationDocumentType): FieldDef[] {
  return MANUAL_FIELDS[docType] ?? DEFAULT_MANUAL_FIELDS
}

const ORIGINAL_LANGUAGES = [
  { value: 'Ukrainian', label: 'Ukrainian / Українська' },
  { value: 'Russian', label: 'Russian / Русский' },
  { value: 'Spanish', label: 'Spanish / Español' },
  { value: 'French', label: 'French / Français' },
  { value: 'German', label: 'German / Deutsch' },
  { value: 'Polish', label: 'Polish / Polski' },
  { value: 'Portuguese', label: 'Portuguese / Português' },
  { value: 'Arabic', label: 'Arabic / العربية' },
  { value: 'Chinese', label: 'Chinese / 中文' },
  { value: 'Other', label: 'Other language' },
]

const CONFIRMATION_CHECKS = [
  'I entered the fields from my actual document — not from memory.',
  'I understand this is a draft template. I will complete the certification block and sign it myself.',
  'I understand Messenginfo does not certify translations. I am the translator of record.',
]

function isAcceptedFile(file: File) {
  const lowerName = file.name.toLowerCase()
  return (
    file.type === 'image/jpeg' ||
    file.type === 'image/png' ||
    file.type === 'application/pdf' ||
    file.type === 'image/heic' ||
    file.type === 'image/heif' ||
    lowerName.endsWith('.jpg') ||
    lowerName.endsWith('.jpeg') ||
    lowerName.endsWith('.png') ||
    lowerName.endsWith('.pdf') ||
    lowerName.endsWith('.heic') ||
    lowerName.endsWith('.heif')
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TranslationServicePanel({
  selectedDocument,
  messages,
  onResetDocument,
}: TranslationServicePanelProps) {
  const fields = getFieldsForDocument(selectedDocument)

  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [fieldValues, setFieldValues] = useState<Record<string, string>>(
    Object.fromEntries(fields.map((f) => [f.key, ''])),
  )
  const [originalLanguage, setOriginalLanguage] = useState('Ukrainian')
  const [checks, setChecks] = useState([false, false, false])
  const [downloaded, setDownloaded] = useState(false)

  const documentContent = messages.documents[selectedDocument]
  const documentConfig = useMemo(
    () => translationDocuments.find((document) => document.id === selectedDocument),
    [selectedDocument],
  )

  // Required fields are filled
  const requiredFilled = fields
    .filter((f) => f.required)
    .every((f) => (fieldValues[f.key] ?? '').trim().length > 0)

  // At least one field has any value
  const anyFilled = Object.values(fieldValues).some((v) => v.trim().length > 0)

  // All confirmations checked
  const allChecked = checks.every(Boolean)

  // Download is unlocked when: required fields filled + all 3 boxes checked
  const canDownload = requiredFilled && allChecked

  function handleFileSelect(file: File | null) {
    if (!file) {
      setSelectedFile(null)
      setFileError(null)
      return
    }
    if (file.size > MAX_FILE_BYTES) {
      setSelectedFile(file)
      setFileError(messages.upload.fileTooLarge)
      return
    }
    if (!isAcceptedFile(file)) {
      setSelectedFile(file)
      setFileError(messages.upload.unsupportedType)
      return
    }
    setSelectedFile(file)
    setFileError(null)
  }

  function handleDownload() {
    downloadTranslationTemplate(selectedDocument, fieldValues, originalLanguage)
    setDownloaded(true)
  }

  function resetFlow() {
    setSelectedFile(null)
    setFileError(null)
    setFieldValues(Object.fromEntries(fields.map((f) => [f.key, ''])))
    setOriginalLanguage('Ukrainian')
    setChecks([false, false, false])
    setDownloaded(false)
  }

  if (!documentContent || !documentConfig) return null

  return (
    <div className="rounded-card border border-slate-200 bg-white p-5 shadow-card md:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.08em] text-brand-600">
            {documentContent.panelTitle}
          </p>
          <p className="mt-2 text-base leading-relaxed text-ink-600">{documentContent.riskNote}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            resetFlow()
            onResetDocument()
          }}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-ink-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" />
          {messages.panel.useAnotherDocument}
        </button>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
        <div className="space-y-6">
          {/* What you get / what to upload info boxes */}
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-card border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-center gap-2">
                <FileCheck2 className="h-5 w-5 text-brand-600" />
                <h3 className="text-lg font-semibold text-ink-900">{messages.panel.whatYouGet}</h3>
              </div>
              <ul className="mt-4 space-y-3">
                {documentContent.fieldsIncluded.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm leading-relaxed text-ink-700">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-card border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-brand-600" />
                <h3 className="text-lg font-semibold text-ink-900">{messages.panel.whatToUpload}</h3>
              </div>
              <ul className="mt-4 space-y-3">
                {documentContent.uploadInstructions.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm leading-relaxed text-ink-700">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Upload box — optional, for future OCR */}
          <div>
            <p className="mb-2 text-sm font-medium text-ink-700">
              Optional: upload your document (photo or scan) — used for reference only
            </p>
            <DocumentUploadBox
              messages={{
                ...messages.upload,
                uploadButton: messages.panel.uploadButton,
              }}
              selectedFile={selectedFile}
              onFileSelect={handleFileSelect}
              errorMessage={fileError}
            />
          </div>

          {/* ── STEP 1: Original language selector ── */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
            <p className="mb-3 text-sm font-semibold text-ink-900">
              Step 1 — Original language of your document
            </p>
            <select
              value={originalLanguage}
              onChange={(e) => setOriginalLanguage(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {ORIGINAL_LANGUAGES.map((lang) => (
                <option key={lang.value} value={lang.value}>
                  {lang.label}
                </option>
              ))}
            </select>
          </div>

          {/* ── STEP 2: Field entry ── */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 space-y-4">
            <div>
              <p className="text-sm font-semibold text-ink-900">
                Step 2 — Enter the fields from your document
              </p>
              <p className="mt-1 text-sm text-ink-500">
                Copy exactly as written. Fields marked <span className="text-red-500">*</span> are required.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {fields.map((field) => (
                <div key={field.key} className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-ink-700">
                    {field.label}
                    {field.required && <span className="ml-1 text-red-500">*</span>}
                  </label>
                  <input
                    type="text"
                    value={fieldValues[field.key] ?? ''}
                    onChange={(e) =>
                      setFieldValues((v) => ({ ...v, [field.key]: e.target.value }))
                    }
                    placeholder={field.label}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              ))}
            </div>

            {anyFilled && !requiredFilled && (
              <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                Fill in all required fields (*) to unlock the download.
              </p>
            )}
          </div>

          {/* ── STEP 3: Confirmation checkboxes ── */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 space-y-3">
            <p className="text-sm font-semibold text-ink-900">
              Step 3 — Confirm before downloading
            </p>
            {CONFIRMATION_CHECKS.map((text, i) => (
              <label key={i} className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={checks[i]}
                  onChange={(e) =>
                    setChecks((prev) => {
                      const next = [...prev]
                      next[i] = e.target.checked
                      return next
                    })
                  }
                  className="mt-0.5 h-4 w-4 rounded border-slate-400 text-brand-600 focus:ring-brand-500"
                />
                <span className="text-sm leading-relaxed text-ink-700">{text}</span>
              </label>
            ))}
          </div>

          {/* Legal disclaimer */}
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
            ⚠ AI draft only. Messenginfo does not certify translations. You review, complete the
            certification block, and sign it yourself before submitting to USCIS (8 CFR 103.2(b)(3)).
          </p>

          {/* ── Download button ── */}
          {!downloaded ? (
            <button
              type="button"
              onClick={handleDownload}
              disabled={!canDownload}
              className="inline-flex w-full items-center justify-center gap-2 rounded-btn bg-brand-600 px-5 py-3 text-base font-medium text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300 sm:w-auto"
            >
              <Download className="h-5 w-5" />
              Download Translation Draft (.html)
            </button>
          ) : (
            <div className="space-y-3">
              <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3">
                <p className="text-sm font-semibold text-green-800">✓ Download started.</p>
                <p className="mt-1 text-sm text-green-700">
                  Open the file in your browser → File → Print → Save as PDF. Then sign the
                  certification block by hand before submitting to USCIS.
                </p>
              </div>
              <div className="flex gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={handleDownload}
                  className="inline-flex items-center gap-2 rounded-btn border border-brand-300 px-4 py-2 text-sm font-medium text-brand-700 transition-colors hover:bg-brand-50"
                >
                  <Download className="h-4 w-4" />
                  Download again
                </button>
                <button
                  type="button"
                  onClick={() => {
                    resetFlow()
                    onResetDocument()
                  }}
                  className="inline-flex items-center gap-2 rounded-btn border border-slate-200 px-4 py-2 text-sm font-medium text-ink-700 transition-colors hover:bg-slate-50"
                >
                  ← Translate another document
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">
          <OfficialTranslationSourceBox
            sourceLabel={messages.source.sourceLabel}
            title={messages.source.title}
            body={messages.source.body}
            uscisPolicyManualLabel={messages.source.uscisPolicyManual}
            ecfrLabel={messages.source.ecfr}
            lastCheckedLabel={messages.source.lastCheckedLabel}
          />
        </div>
      </div>
    </div>
  )
}
