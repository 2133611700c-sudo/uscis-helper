'use client'

import type { ReactNode } from 'react'
import { WizardHeader } from '@/components/wizard/WizardHeader'
import { DesktopStepSidebar } from './DesktopStepSidebar'
import { DesktopAssistantPanel } from './DesktopAssistantPanel'

interface DesktopWizardShellProps {
  children: ReactNode
  slug: string
}

/**
 * Desktop wizard shell (≥1024px). 3-column layout:
 *   [280 step sidebar] | [1fr main work area] | [360 assistant panel]
 *
 * IMPORTANT: Rendered ONLY on desktop by WizardShell viewport router.
 * Do NOT add `lg:hidden` / `md:block` — that duplicates DOM and breaks
 * shared state. One shell in the tree at a time.
 */
export function DesktopWizardShell({ children, slug }: DesktopWizardShellProps) {
  return (
    <div data-testid="desktop-wizard-shell" data-slug={slug} className="min-h-screen bg-white dark:bg-slate-900 transition-colors duration-200">
      <WizardHeader />
      <div className="grid min-h-[calc(100vh-57px)] grid-cols-[280px_1fr_360px]">
        <DesktopStepSidebar slug={slug} />
        <main className="overflow-x-hidden p-6">{children}</main>
        <DesktopAssistantPanel slug={slug} />
      </div>
    </div>
  )
}
