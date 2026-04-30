'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useTranslations, useLocale } from 'next-intl'
import { MessageCircle, X, Search, Grid3X3, Library, Mail } from 'lucide-react'

export function MiaFloatingWidget() {
  const [open, setOpen] = useState(false)
  const t = useTranslations('miaWidget')
  const locale = useLocale()

  const links = [
    { href: `#case-status`, label: t('links.caseStatus'), icon: Search },
    { href: `#services`, label: t('links.services'), icon: Grid3X3 },
    { href: `#sources`, label: t('links.sources'), icon: Library },
    { href: `/${locale}/contact`, label: t('links.contact'), icon: Mail },
  ]

  return (
    <div data-mia-widget className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-50 flex flex-col items-end gap-3">
      {open && (
        <div className="w-80 max-h-[420px] rounded-card bg-white shadow-card-hover border border-slate-100 flex flex-col overflow-hidden animate-in slide-in-from-bottom-2 duration-200">
          {/* Header */}
          <div className="bg-brand-600 text-white px-4 py-3 flex items-center justify-between">
            <span className="text-sm font-semibold">Mia</span>
            <button
              onClick={() => setOpen(false)}
              className="text-white/80 hover:text-white transition-colors"
              aria-label="Close Mia widget"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4">
            <p className="text-sm text-ink-700 mb-4">{t('greeting')}</p>
            <nav className="flex flex-col gap-2">
              {links.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 rounded-btn border border-slate-100 px-3 py-2.5 text-sm text-ink-700 hover:bg-brand-50 hover:border-brand-100 hover:text-brand-700 transition-colors"
                >
                  <Icon className="w-4 h-4 text-brand-600 shrink-0" />
                  {label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Footer */}
          <div className="border-t border-slate-100 px-4 py-2">
            <p className="text-[10px] text-ink-500 leading-relaxed">{t('disclaimer')}</p>
          </div>
        </div>
      )}

      {/* Trigger button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-14 h-14 rounded-full bg-brand-600 hover:bg-brand-700 text-white shadow-card-hover flex items-center justify-center transition-colors"
        aria-label={open ? 'Close Mia' : 'Open Mia'}
        aria-expanded={open}
      >
        {open ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </button>
    </div>
  )
}
