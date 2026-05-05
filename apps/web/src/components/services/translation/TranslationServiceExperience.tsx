'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
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
  const [returnUrl, setReturnUrl] = useState<string | null>(null)
  const [fromSource, setFromSource] = useState<string | null>(null)

  // Read ?from= and ?return= params client-side (SSR-safe)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const from = params.get('from')
    const ret = params.get('return')
    if (from) setFromSource(from)
    if (ret) setReturnUrl(ret)
  }, [])

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

  // Label for the return banner — source-aware
  const returnLabel =
    fromSource === 're-parole-u4u'
      ? '← Return to Re-Parole packet'
      : returnUrl
        ? '← Go back'
        : null

  return (
    <div className="space-y-6">
      {/* Return-to-source banner — shown when ?from=re-parole-u4u */}
      {returnUrl && returnLabel && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 flex items-center gap-3">
          <ArrowLeft className="h-4 w-4 text-blue-700 shrink-0" />
          <p className="text-sm text-blue-800 flex-1">
            {fromSource === 're-parole-u4u'
              ? 'You arrived from the Re-Parole wizard. Translate your document here, then return to finish your packet.'
              : 'Translate your document, then return to continue.'}
          </p>
          <a
            href={returnUrl}
            className="text-sm font-semibold text-blue-700 hover:text-blue-900 transition-colors whitespace-nowrap"
          >
            {returnLabel}
          </a>
        </div>
      )}

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
