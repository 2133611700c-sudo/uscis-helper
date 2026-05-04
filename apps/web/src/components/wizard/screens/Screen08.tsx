'use client'

import { useWizard } from '@/contexts/WizardContext'
import type { WizardState } from '@/contexts/WizardContext'

type FilingOption = {
  value: WizardState['filingMethod']
  title: string
  description: string
}

const OPTIONS: FilingOption[] = [
  {
    value: 'online',
    title: 'Online via myUSCIS',
    description: 'File electronically through myUSCIS. Requires a myUSCIS account.',
  },
  {
    value: 'mail',
    title: 'Mail to USCIS lockbox',
    description:
      'Print and mail your completed I-131 with photos and supporting documents. Check uscis.gov/i-131-addresses for the current mailing address.',
  },
  {
    value: 'unsure',
    title: 'I am not sure yet',
    description:
      'We will include instructions for both methods in your packet. You can decide later.',
  },
]

export function Screen08() {
  const { state, setFilingMethod, setStep } = useWizard()
  const { filingMethod } = state

  function handleSelect(value: WizardState['filingMethod']) {
    setFilingMethod(value)
    setStep(9)
  }

  return (
    <div className="max-w-lg mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">How will you file?</h1>
        <p className="mt-2 text-sm text-slate-500">
          Choose the submission method that works best for you.
        </p>
      </div>

      <div className="space-y-3">
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => handleSelect(opt.value)}
            className={[
              'w-full text-left rounded-xl border-2 p-4 transition-colors',
              filingMethod === opt.value
                ? 'border-blue-600 bg-blue-50'
                : 'border-slate-200 bg-white hover:border-slate-300',
            ].join(' ')}
          >
            <p className={[
              'text-sm font-semibold',
              filingMethod === opt.value ? 'text-blue-700' : 'text-slate-800',
            ].join(' ')}>
              {opt.title}
            </p>
            <p className="mt-1 text-xs text-slate-500">{opt.description}</p>
          </button>
        ))}
      </div>

      {/* Regulatory callout: I-131 form specifics */}
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 space-y-1.5">
        <p className="text-xs font-semibold text-blue-900">Form I-131 (edition 01/20/25) — key items:</p>
        <ul className="text-xs text-blue-800 space-y-1 list-disc list-inside">
          <li>
            <strong>Part 2, Item 1.e</strong> — Select "Re-Parole" as the basis for your application.
          </li>
          <li>
            <strong>Box 10.C</strong> — Enter your current parole expiration date (from your I-94 or approval notice).
          </li>
        </ul>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
        <p className="text-xs text-amber-800">
          Mailing addresses can change. Always verify at{' '}
          <a
            href="https://www.uscis.gov/i-131-addresses"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            uscis.gov/i-131-addresses
          </a>{' '}
          before sending.
        </p>
      </div>
    </div>
  )
}
