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

  const links = [
    { href: `/${locale}`, label: t('home'), icon: Home },
    { href: `/${locale}/services`, label: t('services'), icon: Grid3X3 },
    { href: `#case-status`, label: t('status'), icon: Search },
    { href: `/${locale}/contact`, label: t('contact'), icon: Mail },
  ]

  return (
    <nav
      data-mobile-bar
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white border-t border-slate-200"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Mobile navigation"
    >
      <div className="grid grid-cols-4 h-14">
        {links.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors',
                isActive ? 'text-brand-600' : 'text-ink-500 hover:text-ink-900',
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon className="w-5 h-5" />
              <span>{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
