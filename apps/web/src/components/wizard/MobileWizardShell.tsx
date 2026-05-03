'use client'

import type { ReactNode } from 'react'

interface MobileWizardShellProps {
  children: ReactNode
  slug: string
}

/**
 * Mobile/tablet wizard shell (<1024px). Single-column flow with sticky
 * top bar (step counter + language) and bottom action area. Stage 2 will
 * fill in step controller + Mia FAB.
 */
export function MobileWizardShell({ children, slug }: MobileWizardShellProps) {
  return (
    <div data-testid="mobile-wizard-shell" data-slug={slug} className="min-h-screen bg-white">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-ink-900">Messenginfo</span>
          {/* Stage 2: language switcher slot */}
          <span className="text-ink-500">{/* step counter slot */}</span>
        </div>
      </header>
      <main className="px-4 py-5">{children}</main>
      {/* Stage 2: bottom action bar (Back / Next), Mia FAB */}
    </div>
  )
}
