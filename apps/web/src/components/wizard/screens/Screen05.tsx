'use client'

import { useState, useEffect } from 'react'
import { useWizard } from '@/contexts/WizardContext'
import { MemberTabs } from '@/components/wizard/MemberTabs'

type ExtractedField = { label: string; value: string }

const MOCK_EXTRACTED: ExtractedField[] = [
  { label: 'Last name', value: '[Extracted]' },
  { label: 'First name', value: '[Extracted]' },
  { label: 'Date of birth', value: '[Extracted]' },
  { label: 'I-94 number', value: '[Extracted]' },
]

export function Screen05() {
  const { state, setStep } = useWizard()
  const { members } = state
  const [activeIndex, setActiveIndex] = useState(0)
  const [analyzing, setAnalyzing] = useState(true)

  useEffect(() => {
    setAnalyzing(true)
    const timer = setTimeout(() => setAnalyzing(false), 2000)
    return () => clearTimeout(timer)
  }, [activeIndex])

  const activeMember = members[activeIndex]
  if (!activeMember) return null

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Reviewing your documents</h1>
        <p className="mt-2 text-sm text-slate-500">
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
        {analyzing ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <div
              className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600"
              aria-label="Analyzing"
            />
            <p className="text-sm text-slate-500">Analyzing… ⏳</p>
          </div>
        ) : (
          <>
            <div className="rounded-xl border border-green-200 bg-green-50 p-4 space-y-2">
              {MOCK_EXTRACTED.map((field) => (
                <div key={field.label} className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">{field.label}</span>
                  <span className="font-medium text-slate-800">{field.value}</span>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setStep(6)}
              className="w-full rounded-xl bg-blue-600 px-6 py-3 text-base font-semibold text-white hover:bg-blue-700 transition-colors"
            >
              Review the extracted information →
            </button>
          </>
        )}
      </div>
    </div>
  )
}
