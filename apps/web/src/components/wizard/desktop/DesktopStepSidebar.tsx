'use client'

interface DesktopStepSidebarProps {
  slug: string
}

/**
 * Left sidebar for desktop wizard. Stage 2 wires step state from
 * WizardController. Shell-only stub here.
 */
export function DesktopStepSidebar({ slug }: DesktopStepSidebarProps) {
  return (
    <aside
      data-testid="desktop-step-sidebar"
      data-slug={slug}
      className="border-r border-slate-200 bg-slate-50 p-5"
    >
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-500">
        Steps
      </h2>
      {/* Stage 2: step list + completion checkmarks + click-to-jump */}
      <p className="text-sm text-ink-600">Step list will appear here.</p>
    </aside>
  )
}
