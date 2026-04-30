'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Search } from 'lucide-react'

export function CaseStatusChecker() {
  const t = useTranslations('caseStatus')
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const normalized = input.replace(/[\s-]/g, '').toUpperCase()
    const receiptRegex = /^(EAC|WAC|LIN|SRC|NBC|MSC|IOE)\d{10}$/

    if (!receiptRegex.test(normalized)) {
      setError(t('errorInvalid'))
      return
    }

    // NEVER append receipt to URL
    // NEVER store receipt anywhere
    window.open('https://egov.uscis.gov/', '_blank', 'noopener,noreferrer')
    setError(null)
  }

  return (
    <section
      id="case-status"
      className="mt-8 rounded-card bg-white border border-slate-200 p-5 md:p-6 shadow-card"
    >
      <h2 className="text-lg font-semibold text-ink-900 mb-1">{t('title')}</h2>
      <p className="text-sm text-ink-500 mb-4">{t('description')}</p>
      <form onSubmit={onSubmit} className="flex flex-col sm:flex-row gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-500 pointer-events-none" />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t('placeholder')}
            className="w-full pl-9 pr-3 py-2.5 rounded-btn border border-slate-200 text-sm text-ink-900 placeholder:text-ink-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <button
          type="submit"
          className="shrink-0 bg-brand-600 hover:bg-brand-700 text-white text-base font-medium px-5 py-2.5 rounded-btn transition-colors"
        >
          {t('button')}
        </button>
      </form>
      {error && (
        <p className="mt-2 text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
      <p className="mt-2 text-sm text-ink-500">{t('privacyNote')}</p>
    </section>
  )
}
