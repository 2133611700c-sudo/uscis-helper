'use client'

import { useWizard } from '@/contexts/WizardContext'

export function Screen00() {
  const { state, setStep } = useWizard()
  const isReturning = Boolean(state.sessionId) && state.step > 0

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Welcome to the Re-Parole U4U Guide
        </h1>
        <p className="mt-3 text-slate-600">
          This step-by-step guide will help you prepare your I-131 re-parole application.
          We do not file on your behalf.
        </p>
      </div>

      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setStep(1)}
          className="w-full rounded-xl bg-blue-600 px-6 py-4 text-lg font-semibold text-white hover:bg-blue-700 active:scale-[0.98] transition-all"
        >
          Start →
        </button>

        {isReturning && (
          <button
            type="button"
            onClick={() => setStep(state.step)}
            className="w-full rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Continue where you left off (Step {state.step + 1})
          </button>
        )}
      </div>

      <p className="text-xs text-slate-400 leading-relaxed">
        This tool provides information only, not legal advice. For legal questions, consult
        a qualified immigration attorney.
      </p>
    </div>
  )
}
