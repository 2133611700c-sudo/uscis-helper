'use client'

import { useMemo, useState } from 'react'
import { ArrowLeft, CheckCircle2, FileCheck2, Save } from 'lucide-react'
import { type TranslationDocumentType } from '@/data/translationDocuments'
import { translationDocuments } from '@/data/translationDocuments'
import { DocumentUploadBox } from './DocumentUploadBox'
import { DraftResultPlaceholder } from './DraftResultPlaceholder'
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
// Manual entry field definitions per document type
// ---------------------------------------------------------------------------

type FieldDef = { key: string; label: string; required: boolean }

const MANUAL_FIELDS: Record<string, FieldDef[]> = {
  'i-131': [
    { key: 'full_name', label: 'Full Legal Name', required: true },
    { key: 'date_of_birth', label: 'Date of Birth', required: true },
    { key: 'country_of_birth', label: 'Country of Birth', required: true },
    { key: 'a_number', label: 'A-Number (if any)', required: false },
    { key: 'parole_expiration', label: 'Parole Expiration Date', required: true },
    { key: 'address', label: 'Current US Address', required: false },
  ],
  'i-765': [
    { key: 'full_name', label: 'Full Legal Name', required: true },
    { key: 'date_of_birth', label: 'Date of Birth', required: true },
    { key: 'country_of_birth', label: 'Country of Birth', required: true },
    { key: 'a_number', label: 'A-Number', required: true },
    { key: 'category', label: 'EAD Category (e.g. (c)(11))', required: true },
  ],
}

const DEFAULT_MANUAL_FIELDS: FieldDef[] = [
  { key: 'full_name', label: 'Full Legal Name', required: true },
  { key: 'date_of_birth', label: 'Date of Birth', required: true },
  { key: 'document_number', label: 'Document Number', required: true },
  { key: 'issuing_authority', label: 'Issuing Authority', required: false },
  { key: 'issue_date', label: 'Issue Date', required: false },
  { key: 'expiry_date', label: 'Expiry Date', required: false },
]

function getFieldsForDocument(docType: TranslationDocumentType): FieldDef[] {
  return MANUAL_FIELDS[docType] ?? DEFAULT_MANUAL_FIELDS
}

// ---------------------------------------------------------------------------
// PATCH reviewed fields
// ---------------------------------------------------------------------------

async function patchReviewedFields(
  orderId: string,
  fieldsReviewed: Record<string, string>,
): Promise<boolean> {
  try {
    const res = await fetch('/api/translation/process', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        order_id: orderId,
        fields_reviewed: fieldsReviewed,
        status: 'fields_submitted',
      }),
    })
    return res.ok
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// ManualEntryForm
// ---------------------------------------------------------------------------

interface ManualEntryFormProps {
  documentType: TranslationDocumentType
  orderId: string
  onSaved: () => void
}

function ManualEntryForm({ documentType, orderId, onSaved }: ManualEntryFormProps) {
  const fields = getFieldsForDocument(documentType)
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(fields.map((f) => [f.key, ''])),
  )
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  async function handleSave() {
    setIsSaving(true)
    setSaveError(null)
    const ok = await patchReviewedFields(orderId, values)
    setIsSaving(false)
    if (ok) {
      onSaved()
    } else {
      setSaveError('Could not save fields. Please try again.')
    }
  }

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-4">
      <div>
        <p className="text-sm font-semibold text-blue-900">Manual field entry required</p>
        <p className="mt-1 text-sm text-blue-700">
          Automatic text extraction is not available yet. Please enter the fields below.
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
              value={values[field.key] ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
              placeholder={field.label}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        ))}
      </div>

      {saveError && (
        <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {saveError}
        </p>
      )}

      <button
        type="button"
        onClick={() => void handleSave()}
        disabled={isSaving}
        className="inline-flex items-center gap-2 rounded-btn bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
      >
        <Save className="h-4 w-4" />
        {isSaving ? 'Saving…' : 'Save Fields'}
      </button>
    </div>
  )
}

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
// Upload API call
// ---------------------------------------------------------------------------

interface UploadResult {
  order_id: string
  status: string
  ocr_status: string
  message: string
}

async function uploadDocument(file: File, locale: string): Promise<UploadResult | null> {
  try {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('locale', locale)

    const res = await fetch('/api/translation/upload', {
      method: 'POST',
      body: formData,
    })

    if (!res.ok) return null
    return await res.json() as UploadResult
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TranslationServicePanel({
  selectedDocument,
  messages,
  onResetDocument,
}: TranslationServicePanelProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [showResult, setShowResult] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [fieldsSaved, setFieldsSaved] = useState(false)

  const documentContent = messages.documents[selectedDocument]
  const documentConfig = useMemo(
    () => translationDocuments.find((document) => document.id === selectedDocument),
    [selectedDocument],
  )

  function handleFileSelect(file: File | null) {
    setShowResult(false)
    setUploadResult(null)
    setUploadError(null)
    if (!file) {
      setSelectedFile(null)
      setErrorMessage(null)
      return
    }

    if (file.size > MAX_FILE_BYTES) {
      setSelectedFile(file)
      setErrorMessage(messages.upload.fileTooLarge)
      return
    }

    if (!isAcceptedFile(file)) {
      setSelectedFile(file)
      setErrorMessage(messages.upload.unsupportedType)
      return
    }

    setSelectedFile(file)
    setErrorMessage(null)
  }

  async function handleCreateDraft() {
    if (!selectedFile || errorMessage || isUploading) return

    setIsUploading(true)
    setUploadError(null)

    // Detect locale from browser (fallback to 'en')
    const locale =
      typeof window !== 'undefined'
        ? (document.documentElement.lang?.slice(0, 2) ?? 'en')
        : 'en'

    const result = await uploadDocument(selectedFile, locale)

    setIsUploading(false)

    if (!result) {
      setUploadError('Upload failed. Please try again.')
      return
    }

    setUploadResult(result)
    setShowResult(true)
  }

  function resetFlow() {
    setSelectedFile(null)
    setErrorMessage(null)
    setShowResult(false)
    setUploadResult(null)
    setUploadError(null)
    setIsUploading(false)
    setFieldsSaved(false)
  }

  if (!documentContent || !documentConfig) return null

  const isManualReviewRequired = uploadResult?.ocr_status === 'manual_review_required'

  return (
    <div className="rounded-card border border-slate-200 bg-white p-5 shadow-card md:p-6">
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

          <DocumentUploadBox
            messages={{
              ...messages.upload,
              uploadButton: messages.panel.uploadButton,
            }}
            selectedFile={selectedFile}
            onFileSelect={handleFileSelect}
            errorMessage={errorMessage}
          />

          {/* Legal disclaimer — always visible before upload */}
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
            AI draft only. Messenginfo does not certify translations. You review and sign the certification yourself.
          </p>

          {/* Upload error */}
          {uploadError && (
            <p className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              {uploadError}
            </p>
          )}

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => void handleCreateDraft()}
              disabled={!selectedFile || !!errorMessage || isUploading}
              className="inline-flex w-full items-center justify-center rounded-btn bg-brand-600 px-5 py-3 text-base font-medium text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300 sm:w-auto"
            >
              {isUploading ? 'Uploading…' : messages.panel.createDraftButton}
            </button>
            <button
              type="button"
              onClick={() => {
                resetFlow()
                onResetDocument()
              }}
              className="inline-flex w-full items-center justify-center rounded-btn border border-slate-200 px-5 py-3 text-base font-medium text-ink-700 transition-colors hover:bg-slate-50 sm:w-auto"
            >
              {messages.panel.useAnotherDocument}
            </button>
          </div>

          {/* Upload result */}
          {showResult && uploadResult && (
            <div className="space-y-3">
              {/* Order received confirmation */}
              <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3">
                <p className="text-sm font-semibold text-green-800">
                  Your document has been received.
                </p>
                <p className="mt-1 text-sm text-green-700">
                  Order ID: <span className="font-mono font-semibold">{uploadResult.order_id}</span>
                </p>
                <p className="mt-1 text-sm text-green-700">
                  Our team will prepare your translation draft.
                </p>
              </div>

              {/* Manual entry form */}
              {isManualReviewRequired && !fieldsSaved && (
                <ManualEntryForm
                  documentType={selectedDocument}
                  orderId={uploadResult.order_id}
                  onSaved={() => setFieldsSaved(true)}
                />
              )}
              {isManualReviewRequired && fieldsSaved && (
                <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3">
                  <p className="text-sm font-semibold text-green-800">Fields saved.</p>
                  <p className="mt-1 text-sm text-green-700">
                    Our team will prepare your translation packet.
                  </p>
                </div>
              )}

              <DraftResultPlaceholder
                title={messages.result.placeholderTitle}
                body={messages.result.noBackend}
                draftOnly={messages.result.draftOnly}
                downloadLabel={messages.result.downloadDraft}
                sendToEmailLabel={messages.result.sendToEmail}
                startAnotherLabel={messages.result.startAnother}
                onReset={resetFlow}
              />
            </div>
          )}
        </div>

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
