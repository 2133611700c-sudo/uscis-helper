'use client'

import { ExternalLink } from 'lucide-react'

const infoCards = [
  {
    label: 'Edition: 01/20/25',
    detail:
      'Check the top-right corner of the form. ONLY the 01/20/25 edition is accepted.',
  },
  {
    label: 'Item 10.C',
    detail: 'For U4U re-parole, select checkbox 10.C on page 2 of I-131.',
  },
  {
    label: 'Filing Window',
    detail: 'File up to 180 days before your parole expires.',
  },
]

export function Screen01() {
  return (
    <div className="max-w-lg mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Form I-131 — Application for Travel Document
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Key facts about the form before you begin.
        </p>
      </div>

      <div className="space-y-3">
        {infoCards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-slate-200 bg-slate-50 p-4"
          >
            <p className="text-sm font-semibold text-slate-800">{card.label}</p>
            <p className="mt-1 text-sm text-slate-600">{card.detail}</p>
          </div>
        ))}
      </div>

      <a
        href="https://www.uscis.gov/i-131"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
      >
        Download I-131 from uscis.gov →
        <ExternalLink className="w-3.5 h-3.5" />
      </a>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm text-amber-800">
          <span className="font-semibold">Filing fees: </span>
          Check current fees at{' '}
          <a
            href="https://www.uscis.gov/feecalculator"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:no-underline"
          >
            uscis.gov/feecalculator
          </a>
        </p>
      </div>
    </div>
  )
}
