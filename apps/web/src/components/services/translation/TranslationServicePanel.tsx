'use client'

import { useMemo, useState, type ChangeEvent } from 'react'
import { ArrowLeft, CheckCircle2, FileCheck2 } from 'lucide-react'
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

export function TranslationServicePanel({
  selectedDocument,
  messages,
  onResetDocument,
}: TranslationServicePanelProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [showResult, setShowResult] = useState(false)

  const documentContent = messages.documents[selectedDocument]
  const documentConfig = useMemo(
    () => translationDocuments.find((document) => document.id === selectedDocument),
    [selectedDocument],
  )

  function handleFileSelect(file: File | null) {
    setShowResult(false)
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

  function handleCreateDraft() {
    if (!selectedFile || errorMessage) return
    setShowResult(true)
  }

  function resetFlow() {
    setSelectedFile(null)
    setErrorMessage(null)
    setShowResult(false)
  }

  if (!documentContent || !documentConfig) return null

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

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={handleCreateDraft}
              disabled={!selectedFile || !!errorMessage}
              className="inline-flex w-full items-center justify-center rounded-btn bg-brand-600 px-5 py-3 text-base font-medium text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300 sm:w-auto"
            >
              {messages.panel.createDraftButton}
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

          {showResult && (
            <DraftResultPlaceholder
              title={messages.result.placeholderTitle}
              body={messages.result.noBackend}
              draftOnly={messages.result.draftOnly}
              downloadLabel={messages.result.downloadDraft}
              sendToEmailLabel={messages.result.sendToEmail}
              startAnotherLabel={messages.result.startAnother}
              onReset={resetFlow}
            />
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
