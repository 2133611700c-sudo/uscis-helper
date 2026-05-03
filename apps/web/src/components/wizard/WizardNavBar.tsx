'use client'

const TOTAL_STEPS = 12

interface WizardNavBarProps {
  step: number
  onBack: () => void
  onNext: () => void
  onValidate?: () => boolean
}

/**
 * Bottom navigation bar for the wizard.
 * - Step 0: Back is hidden
 * - Step 12: Next is replaced with "Done"
 * - Fixed at bottom on mobile, inline in main column on desktop
 */
export function WizardNavBar({ step, onBack, onNext, onValidate }: WizardNavBarProps) {
  const isFirst = step === 0
  const isLast = step === TOTAL_STEPS

  function handleNext() {
    if (onValidate && !onValidate()) return
    onNext()
  }

  return (
    <div className="flex items-center justify-between border-t border-slate-200 bg-white px-4 py-3 fixed bottom-0 left-0 right-0 z-40 lg:static lg:z-auto lg:border-t lg:mt-6">
      {/* Back */}
      {isFirst ? (
        <div className="w-20" aria-hidden="true" />
      ) : (
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 rounded-md px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
        >
          ← Back
        </button>
      )}

      {/* Step counter */}
      <span className="text-sm font-medium text-slate-500">
        Step {step + 1} of {TOTAL_STEPS + 1}
      </span>

      {/* Next / Done */}
      {isLast ? (
        <button
          type="button"
          onClick={onNext}
          className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 transition-colors"
        >
          Done
        </button>
      ) : (
        <button
          type="button"
          onClick={handleNext}
          className="flex items-center gap-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
        >
          Next →
        </button>
      )}
    </div>
  )
}
