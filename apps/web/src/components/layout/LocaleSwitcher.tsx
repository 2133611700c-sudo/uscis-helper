'use client'

import { useEffect, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter, usePathname } from 'next/navigation'
import { routing } from '@/i18n/routing'
import { cn } from '@/lib/utils'

const labels: Record<string, string> = { en: 'EN', ru: 'RU', uk: 'UK', es: 'ES' }

export function LocaleSwitcher() {
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  const t = useTranslations('header.languageSelector')
  const [activeLocale, setActiveLocale] = useState(locale)
  const [indicatorStyle, setIndicatorStyle] = useState<{ left: number; width: number }>({ left: 0, width: 0 })
  const containerRef = useRef<HTMLDivElement>(null)
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  useEffect(() => {
    setActiveLocale(locale)
  }, [locale])

  useEffect(() => {
    const updateIndicator = () => {
      const activeButton = buttonRefs.current[activeLocale]
      const container = containerRef.current

      if (!activeButton || !container) return

      setIndicatorStyle({
        left: activeButton.offsetLeft,
        width: activeButton.offsetWidth,
      })
    }

    updateIndicator()
    window.addEventListener('resize', updateIndicator)
    return () => window.removeEventListener('resize', updateIndicator)
  }, [activeLocale])

  function switchLocale(newLocale: string) {
    if (newLocale === activeLocale) return
    setActiveLocale(newLocale)
    const segments = pathname.split('/')
    segments[1] = newLocale
    router.push(segments.join('/'))
  }

  return (
    <div
      ref={containerRef}
      className="relative inline-grid grid-cols-4 items-center rounded-full border border-slate-200 bg-slate-100 p-1 shadow-sm"
      aria-label={t('label')}
    >
      <span
        aria-hidden="true"
        className="absolute top-1 bottom-1 rounded-full bg-brand-600 shadow-sm transition-all duration-300 ease-out"
        style={{
          left: indicatorStyle.left,
          width: indicatorStyle.width,
        }}
      />
      {routing.locales.map((l) => (
        <button
          key={l}
          ref={(node) => {
            buttonRefs.current[l] = node
          }}
          onClick={() => switchLocale(l)}
          className={cn(
            'relative z-10 min-w-[40px] sm:min-w-[44px] px-2.5 py-1.5 text-xs font-semibold rounded-full transition-colors duration-200',
            l === activeLocale
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
