'use client'

import { useMemo, useState } from 'react'
import { type TranslationDocumentType } from '@/data/translationDocuments'
import { DocumentTypeGrid } from './DocumentTypeGrid'
import { TranslationServicePanel } from './TranslationServicePanel'

interface TranslationServiceExperienceProps {
  messages: {
    chooseDocumentTitle: string
    chooseDocumentSubtitle: string
    startAction: string
    documents: Record<string, {
      title: string
      description: string
      panelTitle: string
      fieldsIncluded: string[]
      uploadInstructions: string[]
      riskNote: string
    }>
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
}

export function TranslationServiceExperience({ messages }: TranslationServiceExperienceProps) {
  const [selectedDocument, setSelectedDocument] = useState<TranslationDocumentType | null>(null)

  const gridMessages = useMemo(
    () => ({
      startAction: messages.startAction,
      documents: Object.fromEntries(
        Object.entries(messages.documents).map(([key, value]) => [
          key,
          { title: value.title, description: value.description },
        ]),
      ),
    }),
    [messages.documents, messages.startAction],
  )

  return (
    <div className="space-y-6">
      <div className="rounded-card border border-slate-200 bg-white p-5 shadow-card md:p-6">
        <h2 className="text-2xl font-bold text-ink-900 md:text-3xl">{messages.chooseDocumentTitle}</h2>
        <p className="mt-2 text-base leading-relaxed text-ink-600 md:text-lg">{messages.chooseDocumentSubtitle}</p>
        <div className="mt-6">
          <DocumentTypeGrid
            messages={gridMessages}
            selectedDocument={selectedDocument}
            onSelect={setSelectedDocument}
          />
        </div>
      </div>

      {selectedDocument && (
        <TranslationServicePanel
          selectedDocument={selectedDocument}
          messages={messages}
          onResetDocument={() => setSelectedDocument(null)}
        />
      )}
    </div>
  )
}
