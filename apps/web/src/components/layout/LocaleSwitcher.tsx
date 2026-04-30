'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useRouter, usePathname } from 'next/navigation'
import { routing } from '@/i18n/routing'
import { cn } from '@/lib/utils'

const labels: Record<string, string> = { en: 'EN', ru: 'RU', uk: 'UK', es: 'ES' }
const localeIndex = Object.fromEntries(routing.locales.map((locale, index) => [locale, index])) as Record<string, number>

export function LocaleSwitcher() {
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  const t = useTranslations('header.languageSelector')

  function switchLocale(newLocale: string) {
    if (newLocale === locale) return
    const segments = pathname.split('/')
    segments[1] = newLocale
    router.push(segments.join('/'))
  }

  return (
    <div
      className="relative inline-grid grid-cols-4 items-center rounded-full border border-slate-200 bg-slate-100 p-1 shadow-sm overflow-hidden"
      aria-label={t('label')}
    >
      <span
        aria-hidden="true"
        className="absolute left-1 top-1 bottom-1 rounded-full bg-brand-600 shadow-sm transition-transform duration-300 ease-out"
        style={{
          width: 'calc(25% - 0.375rem)',
          transform: `translateX(calc(${localeIndex[locale] ?? 0} * 100% + ${localeIndex[locale] ?? 0} * 0.125rem))`,
        }}
      />
      {routing.locales.map((l) => (
        <button
          key={l}
          onClick={() => switchLocale(l)}
          className={cn(
            'relative z-10 min-w-[42px] sm:min-w-[46px] px-2.5 py-2 text-xs font-semibold rounded-full transition-colors duration-200',
            l === locale
              ? 'text-white'
              : 'text-ink-600 hover:text-ink-900'
          )}
          aria-label={`Switch to ${labels[l]}`}
          aria-current={l === locale ? 'true' : undefined}
        >
          {labels[l]}
        </button>
      ))}
    </div>
  )
}
