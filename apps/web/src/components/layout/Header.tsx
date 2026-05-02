import { useTranslations, useLocale } from 'next-intl'
import Link from 'next/link'
import { Logo } from '@/components/brand/Logo'
import { LocaleSwitcher } from './LocaleSwitcher'

export function Header() {
  const t = useTranslations('header')
  const locale = useLocale()

  return (
    // H&F-matched: backdrop-blur(20px), 68px desktop height, subtle shadow
    <header className="sticky top-0 z-50 w-full bg-white/96 backdrop-blur-[20px] border-b border-slate-100/80" style={{ boxShadow: 'var(--shadow-header)' }}>
      <div className="max-w-[1200px] mx-auto px-4 md:px-6 h-14 md:h-[68px] flex items-center justify-between gap-4">
        <Logo locale={locale} />

        {/* Desktop nav — H&F pattern: 150ms transition, rounded pill hover */}
        <nav className="hidden md:flex items-center gap-1 text-sm" aria-label="Main navigation">
          <Link href={`/${locale}/services`} className="text-ink-600 hover:text-ink-900 hover:bg-slate-100 transition-[background,color] duration-150 font-medium px-3 py-1.5 rounded-md">
            {t('nav.services')}
          </Link>
          <Link href={`/${locale}/services/translate-document`} className="text-ink-600 hover:text-ink-900 hover:bg-slate-100 transition-[background,color] duration-150 font-medium px-3 py-1.5 rounded-md">
            {t('nav.documents')}
          </Link>
          <Link href={`/${locale}/faq`} className="text-ink-600 hover:text-ink-900 hover:bg-slate-100 transition-[background,color] duration-150 font-medium px-3 py-1.5 rounded-md">
            {t('nav.faq')}
          </Link>
          <Link href={`#sources`} className="text-ink-600 hover:text-ink-900 hover:bg-slate-100 transition-[background,color] duration-150 font-medium px-3 py-1.5 rounded-md">
            {t('nav.sources')}
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <LocaleSwitcher />
          {/* H&F CTA: pill shape (999px radius), semibold, 150ms transition, active scale */}
          <Link
            href={`#case-status`}
            className="hidden sm:inline-flex items-center bg-brand-600 hover:bg-brand-700 active:scale-[0.97] text-white text-sm font-semibold px-4 py-2 rounded-[999px] transition-[background,transform] duration-150"
          >
            {t('ctaStatus')}
          </Link>
        </div>
      </div>
    </header>
  )
}
