'use client'

import { useState, useEffect } from 'react'
import { useWizard } from '@/contexts/WizardContext'
import { MemberTabs } from '@/components/wizard/MemberTabs'

export function Screen05() {
  const { state, setStep } = useWizard()
  const { members } = state
  const [activeIndex, setActiveIndex] = useState(0)
  const [analyzing, setAnalyzing] = useState(false)

  const activeMember = members[activeIndex]

  // Determine if this member has at least one successfully uploaded doc
  const hasUploadedDocs =
    activeMember != null &&
    Object.values(activeMember.docs).some((d) => d.status === 'done')

  // Only run the "analyzing" spinner when there are actual uploads to process
  useEffect(() => {
    if (!hasUploadedDocs) {
      setAnalyzing(false)
      return
    }
    setAnalyzing(true)
    const timer = setTimeout(() => setAnalyzing(false), 2000)
    return () => clearTimeout(timer)
  }, [activeIndex, hasUploadedDocs])

  if (!activeMember) return null

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Reviewing your documents
        </h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Checking the uploaded files for each applicant.
        </p>
      </div>

      <MemberTabs activeIndex={activeIndex} onChange={setActiveIndex} />

      <div
        id={`member-panel-${activeIndex}`}
        role="tabpanel"
        aria-label={`Review for ${activeMember.alias}`}
        className="space-y-3"
      >
        {/* ── Case 1: spinner while analyzing real uploads ── */}
        {analyzing && (
          <div className="flex flex-col items-center gap-3 py-8">
            <div
              className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600"
              aria-label="Analyzing"
            />
            <p className="text-sm text-slate-500 dark:text-slate-400">Analyzing… ⏳</p>
          </div>
        )}

        {/* ── Case 2: no uploads → manual entry notice ── */}
        {!analyzing && !hasUploadedDocs && (
          <>
            <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700 p-4 space-y-2">
              <div className="flex items-start gap-2">
                <span className="text-lg leading-none">📄</span>
                <div>
                  <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                    No documents uploaded for {activeMember.alias}
                  </p>
                  <p className="mt-1 text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                    That&apos;s fine — you&apos;ll fill in the details directly on Form&nbsp;I-131.
                    Skip ahead and we&apos;ll guide you through every required field.
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setStep(6)}
              className="w-full rounded-xl bg-blue-600 px-6 py-3 text-base font-semibold text-white hover:bg-blue-700 transition-colors"
            >
              Continue — fill in details manually →
            </button>
          </>
        )}

        {/* ── Case 3: uploads done → show extracted data (real OCR coming soon) ── */}
        {!analyzing && hasUploadedDocs && (
          <>
            <div className="rounded-xl border border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-700 p-4 space-y-2">
              <p className="text-xs font-semibold text-green-700 dark:text-green-300 uppercase tracking-wide mb-2">
                Extracted from uploaded documents
              </p>
              {Object.entries(activeMember.docs)
                .filter(([, d]) => d.status === 'done')
                .map(([docKey]) => (
                  <div key={docKey} className="flex items-center justify-between text-sm py-0.5">
                    <span className="text-slate-600 dark:text-slate-400 capitalize">
                      {docKey.replace(/_/g, ' ')}
                    </span>
                    <span className="font-medium text-green-700 dark:text-green-300 text-xs">
                      ✓ Uploaded
                    </span>
                  </div>
                ))}
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Automated field extraction will be available in a future update.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setStep(6)}
              className="w-full rounded-xl bg-blue-600 px-6 py-3 text-base font-semibold text-white hover:bg-blue-700 transition-colors"
            >
              Continue →
            </button>
          </>
        )}
      </div>
    </div>
  )
}
