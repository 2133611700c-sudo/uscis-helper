'use client'

import { LanguageSwitcher } from './LanguageSwitcher'
import { ThemeToggle } from './ThemeToggle'
import { useWizard } from '@/contexts/WizardContext'

function SyncIndicator() {
  const { syncStatus } = useWizard()

  if (syncStatus === 'idle') return null

  const label =
    syncStatus === 'saving'
      ? 'Saving…'
      : syncStatus === 'saved'
        ? 'Saved'
        : 'Could not save — data in browser'

  const color =
    syncStatus === 'saving'
      ? 'text-slate-400'
      : syncStatus === 'saved'
        ? 'text-green-600'
        : 'text-amber-600'

  return (
    <span className={['text-[11px] font-medium transition-all', color].join(' ')}>
      {label}
    </span>
  )
}

/**
 * Sticky header for the mobile wizard.
 * Left: logo text + sync status. Right: LanguageSwitcher + ThemeToggle.
 */
export function WizardHeader() {
  return (
    <header className="sticky top-0 z-50 flex items-center justify-between border-b border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 px-4 py-3 backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <span className="text-base font-bold tracking-tight text-slate-900 dark:text-slate-100">Messenginfo</span>
        <SyncIndicator />
      </div>
      <div className="flex items-center gap-2">
        <LanguageSwitcher />
        <ThemeToggle />
      </div>
    </header>
  )
}
