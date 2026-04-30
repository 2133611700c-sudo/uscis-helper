'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useRouter, usePathname } from 'next/navigation'
import { routing } from '@/i18n/routing'

const labels: Record<string, string> = { en: 'EN', ru: 'RU', uk: 'UK', es: 'ES' }

export function LocaleSwitcher() {
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  const t = useTranslations('header.languageSelector')

  function switchLocale(newLocale: string) {
    const segments = pathname.split('/')
    segments[1] = newLocale
    router.push(segments.join('/'))
  }

  return (
    <div className="flex items-center gap-1" aria-label={t('label')}>
      {routing.locales.map((l) => (
        <button
          key={l}
          onClick={() => switchLocale(l)}
          className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
            l === locale
              ? 'bg-brand-600 text-white'
              : 'text-ink-500 hover:text-ink-900 hover:bg-slate-100'
          }`}
          aria-label={`Switch to ${labels[l]}`}
          aria-current={l === locale ? 'true' : undefined}
        >
          {labels[l]}
        </button>
      ))}
    </div>
  )
}
