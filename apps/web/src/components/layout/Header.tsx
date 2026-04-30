import { useTranslations, useLocale } from 'next-intl'
import Link from 'next/link'
import { Logo } from '@/components/brand/Logo'
import { LocaleSwitcher } from './LocaleSwitcher'

export function Header() {
  const t = useTranslations('header')
  const locale = useLocale()

  return (
    <header className="sticky top-0 z-50 w-full bg-white/95 backdrop-blur-sm border-b border-slate-100" style={{ boxShadow: 'var(--shadow-header)' }}>
      <div className="max-w-[1200px] mx-auto px-4 md:px-6 h-16 flex items-center justify-between gap-4">
        <Logo locale={locale} />

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-5 text-sm" aria-label="Main navigation">
          <Link href={`/${locale}/services`} className="text-ink-600 hover:text-ink-900 transition-colors font-medium">
            {t('nav.services')}
          </Link>
          <Link href={`/${locale}/services/translate-document`} className="text-ink-600 hover:text-ink-900 transition-colors font-medium">
            {t('nav.documents')}
          </Link>
          <Link href={`/${locale}/faq`} className="text-ink-600 hover:text-ink-900 transition-colors font-medium">
            {t('nav.faq')}
          </Link>
          <Link href={`#sources`} className="text-ink-600 hover:text-ink-900 transition-colors font-medium">
            {t('nav.sources')}
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <LocaleSwitcher />
          <Link
            href={`#case-status`}
            className="hidden sm:inline-flex items-center bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-btn transition-colors"
          >
            {t('ctaStatus')}
          </Link>
        </div>
      </div>
    </header>
  )
}
