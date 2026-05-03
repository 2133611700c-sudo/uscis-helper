'use client'

import { useState, useEffect } from 'react'
import { useWizard } from '@/contexts/WizardContext'
import { MemberTabs } from '@/components/wizard/MemberTabs'

export function Screen05() {
  const { state, setStep } = useWizard()
  const { members } = state
  const [activeIndex, setActiveIndex] = useState(0)
  const [processing, setProcessing] = useState(true)

  useEffect(() => {
    setProcessing(true)
    const timer = setTimeout(() => setProcessing(false), 1500)
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
        {processing ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <div
              className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600"
              aria-label="Processing"
            />
            <p className="text-sm text-slate-500">Processing…</p>
          </div>
        ) : (
          <>
            {/* Honest status: document received, manual review required */}
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-1">
              <p className="text-sm font-semibold text-amber-800">
                Document received — manual review required
              </p>
              <p className="text-sm text-amber-700">
                Automatic field recognition is not available. You will enter your information
                manually in the next step.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setStep(6)}
              className="w-full rounded-xl bg-blue-600 px-6 py-3 text-base font-semibold text-white hover:bg-blue-700 transition-colors"
            >
              Continue to enter information →
            </button>
          </>
        )}
      </div>
    </div>
  )
}
