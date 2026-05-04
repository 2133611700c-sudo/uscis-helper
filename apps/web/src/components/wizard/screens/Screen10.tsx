'use client'

import { useState } from 'react'
import { useWizard } from '@/contexts/WizardContext'

const LEGAL_CHECKBOXES = [
  {
    id: 'check-not-legal-advice',
    text: 'I understand that Messenginfo provides document preparation assistance only, not legal advice. Messenginfo is not a law firm and does not represent me before USCIS.',
  },
  {
    id: 'check-uscis-fees-separate',
    text: 'I understand that USCIS filing fees are separate from this service fee and are paid directly to USCIS. The current fee amount is available at uscis.gov/feecalculator.',
  },
  {
    id: 'check-data-retention',
    text: 'I understand that my session data is stored temporarily to generate my packet and is deleted within 30 days. Messenginfo does not sell my personal information.',
  },
] as const

export function Screen10() {
  const { state, setPaymentStatus, setStep } = useWizard()
  const { packageSize, packagePrice } = state
  const [loading, setLoading] = useState(false)
  const [checked, setChecked] = useState<Record<string, boolean>>({})

  const allChecked = LEGAL_CHECKBOXES.every((c) => checked[c.id])

  function toggleCheck(id: string) {
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  function handlePay() {
    if (!allChecked) return
    setLoading(true)
    setTimeout(() => {
      setPaymentStatus('mock_paid')
      setStep(11)
    }, 1500)
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Review &amp; confirm</h1>
        <p className="mt-2 text-sm text-slate-500">
          Please read and acknowledge the items below before generating your packet.
        </p>
      </div>

      {/* Order summary */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-600">
            Document preparation — {packageSize} applicant{packageSize !== 1 ? 's' : ''}
          </span>
          <span className="text-lg font-bold text-slate-900">${packagePrice}</span>
        </div>
        <div className="mt-3 border-t border-slate-200 pt-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-700">Service fee</span>
          <span className="rounded-full bg-amber-100 px-3 py-0.5 text-xs font-semibold text-amber-700">
            Payment not yet enabled
          </span>
        </div>
      </div>

      {/* Legal checkboxes */}
      <div className="space-y-4">
        <p className="text-sm font-semibold text-slate-700">
          You must acknowledge all three items to continue:
        </p>
        {LEGAL_CHECKBOXES.map((item) => (
          <label
            key={item.id}
            className={[
              'flex items-start gap-3 cursor-pointer rounded-xl border-2 p-3 transition-colors',
              checked[item.id]
                ? 'border-blue-300 bg-blue-50'
                : 'border-slate-200 bg-white hover:border-slate-300',
            ].join(' ')}
          >
            <input
              type="checkbox"
              id={item.id}
              checked={!!checked[item.id]}
              onChange={() => toggleCheck(item.id)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-xs text-slate-700 leading-relaxed">{item.text}</span>
          </label>
        ))}
      </div>

      <button
        type="button"
        onClick={handlePay}
        disabled={loading || !allChecked}
        className={[
          'w-full rounded-xl px-6 py-4 text-base font-semibold text-white transition-all',
          loading || !allChecked
            ? 'bg-slate-300 cursor-not-allowed text-slate-500'
            : 'bg-blue-600 hover:bg-blue-700',
        ].join(' ')}
      >
        {loading ? 'Generating packet…' : !allChecked ? 'Please acknowledge all items above' : 'Continue — Generate My Packet →'}
      </button>

      <p className="text-xs text-slate-400 leading-relaxed">
        USCIS filing fees are paid separately and directly to USCIS.
        Check the current fee schedule at{' '}
        <a
          href="https://www.uscis.gov/feecalculator"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          uscis.gov/feecalculator
        </a>.
      </p>
    </div>
  )
}
