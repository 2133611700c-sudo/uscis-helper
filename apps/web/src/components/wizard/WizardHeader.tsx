'use client'

import { LanguageSwitcher } from './LanguageSwitcher'
import { ThemeToggle } from './ThemeToggle'

/**
 * Sticky header for the mobile wizard.
 * Left: logo text. Right: LanguageSwitcher + ThemeToggle.
 */
export function WizardHeader() {
  return (
    <header className="sticky top-0 z-50 flex items-center justify-between border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur-sm">
      <span className="text-base font-bold tracking-tight text-slate-900">Messenginfo</span>
      <div className="flex items-center gap-2">
        <LanguageSwitcher />
        <ThemeToggle />
      </div>
    </header>
  )
}
