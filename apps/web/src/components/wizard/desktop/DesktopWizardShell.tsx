'use client'

import type { ReactNode } from 'react'
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
 * Stage 2 wires WizardController state. Shell-only here.
 *
 * IMPORTANT: This component is rendered ONLY on desktop, by WizardShell's
 * viewport router. Do NOT add `lg:hidden` / `md:block` toggles — that
 * duplicates DOM and breaks shared state. One shell in the tree at a time.
 */
export function DesktopWizardShell({ children, slug }: DesktopWizardShellProps) {
  return (
    <div data-testid="desktop-wizard-shell" data-slug={slug} className="min-h-screen bg-white">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white px-6 py-3">
        <div className="flex items-center justify-between">
          <span className="text-base font-semibold text-ink-900">Messenginfo</span>
          {/* Stage 2: step counter + language switcher */}
        </div>
      </header>
      <div className="grid min-h-[calc(100vh-57px)] grid-cols-[280px_1fr_360px]">
        <DesktopStepSidebar slug={slug} />
        <main className="overflow-x-hidden p-6">{children}</main>
        <DesktopAssistantPanel slug={slug} />
      </div>
    </div>
  )
}
