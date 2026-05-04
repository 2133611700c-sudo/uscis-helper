'use client'

const TOTAL_STEPS = 12

interface WizardNavBarProps {
  step: number
  onBack: () => void
  onNext: () => void
  onValidate?: () => boolean
}

/**
 * Bottom navigation bar — matches prototype style:
 *   [← Back] [Step X of 13] [Next →] / [Done]
 * Fixed on mobile, inline on desktop.
 */
export function WizardNavBar({ step, onBack, onNext, onValidate }: WizardNavBarProps) {
  const isFirst = step === 0
  const isLast = step === TOTAL_STEPS

  function handleNext() {
    if (onValidate && !onValidate()) return
    onNext()
  }

  return (
    <div
      className="flex items-center gap-2 px-4 py-3 fixed bottom-0 left-0 right-0 z-40 lg:static lg:z-auto lg:mt-6"
      style={{
        background: 'var(--surface)',
        borderTop: '1px solid var(--border)',
      }}
    >
      {/* Back */}
      {isFirst ? (
        <div className="w-[56px] flex-shrink-0" aria-hidden="true" />
      ) : (
        <button
          type="button"
          onClick={onBack}
          className="flex-shrink-0 rounded-[10px] text-[15px] font-semibold transition-all active:scale-95"
          style={{
            background: 'var(--surface)',
            border: '1.5px solid var(--border-strong)',
            color: 'var(--text-1)',
            padding: '14px 18px',
            minHeight: '52px',
          }}
        >
          ← Back
        </button>
      )}

      {/* Step counter */}
      <span
        className="flex-1 text-center text-[14px] font-medium"
        style={{ color: 'var(--text-3)', fontVariantNumeric: 'tabular-nums' }}
      >
        Step {step + 1} of {TOTAL_STEPS + 1}
      </span>

      {/* Next / Done */}
      {isLast ? (
        <button
          type="button"
          onClick={onNext}
          className="flex-shrink-0 rounded-[10px] text-[15px] font-bold transition-all active:scale-95"
          style={{
            background: 'var(--success)',
            color: '#fff',
            border: 'none',
            padding: '14px 24px',
            minHeight: '52px',
          }}
        >
          Done ✓
        </button>
      ) : (
        <button
          type="button"
          onClick={handleNext}
          className="flex-1 rounded-[10px] text-[15px] font-bold transition-all active:scale-95"
          style={{
            background: 'var(--btn-action)',
            color: 'var(--btn-action-text)',
            border: 'none',
            padding: '14px',
            minHeight: '52px',
          }}
        >
          Next →
        </button>
      )}
    </div>
  )
}
