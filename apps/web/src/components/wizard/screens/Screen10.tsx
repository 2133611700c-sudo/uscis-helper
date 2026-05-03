'use client'

import { useState } from 'react'
import { useWizard } from '@/contexts/WizardContext'

export function Screen10() {
  const { state, setPaymentStatus, setStep } = useWizard()
  const { packageSize, packagePrice } = state
  const [loading, setLoading] = useState(false)

  function handlePay() {
    setLoading(true)
    setTimeout(() => {
      setPaymentStatus('mock_paid')
      setStep(11)
    }, 1500)
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Complete your payment</h1>
        <p className="mt-2 text-sm text-slate-500">
          Secure payment for your application preparation service.
        </p>
      </div>

      {/* Order summary */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-600">
            Service fee — {packageSize} applicant{packageSize !== 1 ? 's' : ''}
          </span>
          <span className="text-lg font-bold text-slate-900">${packagePrice}</span>
        </div>
        <div className="mt-3 border-t border-slate-200 pt-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-700">Total</span>
          <span className="text-xl font-bold text-slate-900">${packagePrice}</span>
        </div>
      </div>

      <button
        type="button"
        onClick={handlePay}
        disabled={loading}
        className={[
          'w-full rounded-xl px-6 py-4 text-base font-semibold text-white transition-all',
          loading
            ? 'bg-blue-400 cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-700',
        ].join(' ')}
      >
        {loading ? 'Processing…' : 'Pay with card →'}
      </button>

      <p className="text-xs text-slate-400 leading-relaxed">
        This is our service fee for form preparation assistance. USCIS filing fees are separate
        and paid directly to USCIS. Check current fees at uscis.gov/feecalculator.
      </p>
    </div>
  )
}
