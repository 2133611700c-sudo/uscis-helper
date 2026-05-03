'use client'

import { useWizard } from '@/contexts/WizardContext'
import { calcPrice } from '@/contexts/WizardContext'

const MIN_COUNT = 1
const MAX_INLINE = 6

export function Screen02() {
  const { state, setPackageSize, setStep } = useWizard()
  const { packageSize } = state

  function decrement() {
    if (packageSize > MIN_COUNT) setPackageSize(packageSize - 1)
  }

  function increment() {
    setPackageSize(packageSize + 1)
  }

  function handleChoose() {
    setStep(3)
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">How many people are applying?</h1>
        <p className="mt-2 text-sm text-slate-500">
          Select the number of family members in this application packet.
        </p>
      </div>

      {/* Quick-select cards 1-6 */}
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: MAX_INLINE }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setPackageSize(n)}
            className={[
              'rounded-xl border-2 py-4 text-lg font-bold transition-colors',
              packageSize === n
                ? 'border-blue-600 bg-blue-50 text-blue-700'
                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300',
            ].join(' ')}
          >
            {n}
          </button>
        ))}
      </div>

      {/* +/- for more than 6 */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={decrement}
          disabled={packageSize <= MIN_COUNT}
          aria-label="Decrease count"
          className="w-10 h-10 rounded-full border border-slate-300 text-slate-700 text-xl font-bold hover:bg-slate-50 disabled:opacity-40 transition-colors"
        >
          −
        </button>
        <span className="text-2xl font-bold text-slate-900 w-8 text-center">{packageSize}</span>
        <button
          type="button"
          onClick={increment}
          aria-label="Increase count"
          className="w-10 h-10 rounded-full border border-slate-300 text-slate-700 text-xl font-bold hover:bg-slate-50 transition-colors"
        >
          +
        </button>
        <span className="text-sm text-slate-500 ml-2">
          {packageSize} {packageSize === 1 ? 'person' : 'people'}
        </span>
      </div>

      {/* Price display */}
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
        <p className="text-base font-semibold text-blue-900">
          {packageSize} {packageSize === 1 ? 'person' : 'people'} — ${calcPrice(packageSize)} service fee
        </p>
        <p className="mt-1 text-xs text-blue-700">
          Our service fee covers assistance with form preparation only.
        </p>
      </div>

      <button
        type="button"
        onClick={handleChoose}
        className="w-full rounded-xl bg-blue-600 px-6 py-3 text-base font-semibold text-white hover:bg-blue-700 transition-colors"
      >
        Choose this package
      </button>
    </div>
  )
}
