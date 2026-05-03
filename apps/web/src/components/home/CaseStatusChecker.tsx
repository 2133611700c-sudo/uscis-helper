'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'

const RECEIPT_REGEX = /^(EAC|WAC|LIN|SRC|NBC|MSC|IOE)\d{10}$/

export function CaseStatusChecker() {
  const t = useTranslations('caseStatus')
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const normalized = input.replace(/[\s-]/g, '').toUpperCase()

    if (!RECEIPT_REGEX.test(normalized)) {
      setError(t('errorInvalid'))
      return
    }

    // Open USCIS in new tab WITHOUT the receipt number.
    // We never POST, never store, never include in URL.
    window.open('https://egov.uscis.gov/', '_blank', 'noopener,noreferrer')

    // DO NOT clear input here — let user see what they typed
    // DO NOT call any tracking/analytics with normalized
    setError(null)
  }

  return (
    <section
      className="mt-8 rounded-card bg-white border border-slate-200 p-5 md:p-6 shadow-card"
    >
      <h2 className="text-lg font-semibold text-ink-900 mb-1">{t('title')}</h2>
      <p className="text-sm text-ink-500 mb-4">{t('subtitle')}</p>
      <form id="case-status" onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
        <div className="flex-1 relative">
          <label htmlFor="receipt-input" className="sr-only">Receipt number</label>
          <input
            id="receipt-input"
            type="text"
            autoComplete="off"
            spellCheck={false}
            inputMode="text"
            placeholder={t('placeholder')}
            value={input}
            onChange={(e) => { setInput(e.target.value); setError(null); }}
            aria-invalid={!!error}
            aria-describedby={error ? 'receipt-error' : 'receipt-help'}
            className="w-full px-3 py-2.5 rounded-btn border border-slate-200 text-sm text-ink-900 placeholder:text-ink-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          />
        </div>
        <button
          type="submit"
          className="shrink-0 bg-brand-600 hover:bg-brand-700 text-white text-base font-medium px-5 py-2.5 rounded-btn transition-colors"
        >
          {t('buttonLabel')}
        </button>
      </form>
      {error && (
        <p id="receipt-error" role="alert" className="mt-2 text-xs text-red-700">
          {error}
        </p>
      )}
      <p id="receipt-help" className="mt-2 text-sm text-ink-500">{t('disclaimer')}</p>
    </section>
  )
}
