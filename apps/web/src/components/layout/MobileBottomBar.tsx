'use client'

import Link from 'next/link'
import { useTranslations, useLocale } from 'next-intl'
import { usePathname } from 'next/navigation'
import { Home, Grid3X3, Search, Mail } from 'lucide-react'
import { cn } from '@/lib/utils'

export function MobileBottomBar() {
  const t = useTranslations('mobileBar')
  const locale = useLocale()
  const pathname = usePathname()

  const links: Array<{ href: string; label: string; icon: typeof Home; external?: boolean }> = [
    { href: `/${locale}`, label: t('home'), icon: Home },
    { href: `/${locale}/services`, label: t('services'), icon: Grid3X3 },
    // Status — opens the official USCIS Case Status portal DIRECTLY in a new
    // tab. One tap, no intermediate page on our side.
    { href: 'https://egov.uscis.gov/', label: t('status'), icon: Search, external: true },
    { href: `/${locale}/contact`, label: t('contact'), icon: Mail },
  ]

  return (
    <nav
      data-mobile-bar="true"
      className="fixed bottom-0 inset-x-0 z-50 md:hidden bg-white border-t border-slate-200"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Mobile navigation"
    >
      <div className="grid grid-cols-4 h-14">
        {links.map(({ href, label, icon: Icon, external }) => {
          const isActive = !external && pathname === href
          const className = cn(
            // px-1 + min-width-0 so long labels (e.g. "Контакты") wrap
            // instead of truncating with an ellipsis on 360–390px viewports.
            'flex flex-col items-center justify-center gap-0.5 px-1 min-w-0 text-[11px] leading-tight font-medium transition-colors text-center',
            isActive ? 'text-brand-600' : 'text-ink-500 hover:text-ink-900',
          )
          if (external) {
            return (
              <a
                key={href}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className={className}
              >
                <Icon className="w-5 h-5" />
                <span className="block w-full break-words">{label}</span>
              </a>
            )
          }
          return (
            <Link
              key={href}
              href={href}
              className={className}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon className="w-5 h-5" />
              <span className="block w-full break-words">{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
