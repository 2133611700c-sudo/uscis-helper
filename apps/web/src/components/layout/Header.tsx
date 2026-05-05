import { useTranslations, useLocale } from 'next-intl'
import Link from 'next/link'
import { Logo } from '@/components/brand/Logo'
import { LocaleSwitcher } from './LocaleSwitcher'
import { SiteThemeToggle } from './SiteThemeToggle'

export function Header() {
  const t = useTranslations('header')
  const locale = useLocale()

  return (
    <header
      data-site-header="true"
      className="sticky top-0 z-50 w-full backdrop-blur-[20px] border-b"
      style={{
        background: 'var(--surface-1)',
        borderColor: 'var(--border)',
        boxShadow: 'var(--shadow-header)',
      }}
    >
      <div className="max-w-[1200px] mx-auto px-4 md:px-6 h-14 md:h-[68px] flex items-center justify-between gap-4">
        <Logo locale={locale} />

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1 text-sm" aria-label="Main navigation">
          <Link
            href={`/${locale}/services`}
            className="hover:bg-[var(--surface-3)] transition-[background,color] duration-150 font-medium px-3 py-1.5 rounded-md"
            style={{ color: 'var(--text-1)' }}
          >
            {t('nav.services')}
          </Link>
          <Link
            href={`/${locale}/services/translate-document`}
            className="hover:bg-[var(--surface-3)] transition-[background,color] duration-150 font-medium px-3 py-1.5 rounded-md"
            style={{ color: 'var(--text-1)' }}
          >
            {t('nav.documents')}
          </Link>
          <Link
            href={`/${locale}/faq`}
            className="hover:bg-[var(--surface-3)] transition-[background,color] duration-150 font-medium px-3 py-1.5 rounded-md"
            style={{ color: 'var(--text-1)' }}
          >
            {t('nav.faq')}
          </Link>
          <Link
            href={`#sources`}
            className="hover:bg-[var(--surface-3)] transition-[background,color] duration-150 font-medium px-3 py-1.5 rounded-md"
            style={{ color: 'var(--text-1)' }}
          >
            {t('nav.sources')}
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <SiteThemeToggle />
          <LocaleSwitcher />
          {/* Sign in — ghost pill button */}
          <Link
            href={`/${locale}/sign-in`}
            className="hidden sm:inline-flex items-center active:scale-[0.97] text-sm font-semibold px-4 py-2 rounded-[999px] transition-[background,transform] duration-150"
            style={{
              border: '1.5px solid var(--border)',
              color: 'var(--text-1)',
              background: 'transparent',
            }}
          >
            {t('signIn')}
          </Link>
          {/* Check status — filled CTA */}
          <Link
            href={`#case-status`}
            className="hidden sm:inline-flex items-center active:scale-[0.97] text-white text-sm font-semibold px-4 py-2 rounded-[999px] transition-[background,transform] duration-150"
            style={{ background: '#2563eb' }}
          >
            {t('ctaStatus')}
          </Link>
        </div>
      </div>
    </header>
  )
}
