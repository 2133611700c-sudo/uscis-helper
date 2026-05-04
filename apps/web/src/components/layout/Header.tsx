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

        {/* Desktop nav — readable #1a1a1a text on white */}
        <nav className="hidden md:flex items-center gap-1 text-sm" aria-label="Main navigation">
          <Link href={`/${locale}/services`} className="hover:bg-zinc-100 transition-[background,color] duration-150 font-medium px-3 py-1.5 rounded-md" style={{ color: '#1a1a1a' }}>
            {t('nav.services')}
          </Link>
          <Link href={`/${locale}/services/translate-document`} className="hover:bg-zinc-100 transition-[background,color] duration-150 font-medium px-3 py-1.5 rounded-md" style={{ color: '#1a1a1a' }}>
            {t('nav.documents')}
          </Link>
          <Link href={`/${locale}/faq`} className="hover:bg-zinc-100 transition-[background,color] duration-150 font-medium px-3 py-1.5 rounded-md" style={{ color: '#1a1a1a' }}>
            {t('nav.faq')}
          </Link>
          <Link href={`#sources`} className="hover:bg-zinc-100 transition-[background,color] duration-150 font-medium px-3 py-1.5 rounded-md" style={{ color: '#1a1a1a' }}>
            {t('nav.sources')}
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <LocaleSwitcher />
          {/* Sign in — ghost pill button */}
          <Link
            href={`/${locale}/sign-in`}
            className="hidden sm:inline-flex items-center active:scale-[0.97] text-sm font-semibold px-4 py-2 rounded-[999px] transition-[background,transform] duration-150"
            style={{
              border: '1.5px solid #d4d4d8',
              color: '#1a1a1a',
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
