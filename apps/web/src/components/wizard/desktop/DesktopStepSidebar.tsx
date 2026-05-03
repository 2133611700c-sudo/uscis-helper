'use client'

import { useWizard } from '@/contexts/WizardContext'

interface DesktopStepSidebarProps {
  slug: string
}

const STEP_NAMES = [
  'Welcome',
  'About the Form',
  'Package',
  'Family',
  'Documents',
  'Recognition',
  'Confirm',
  'Info & Evidence',
  'Filing Method',
  'Preview',
  'Payment',
  'Download',
  'Transfer',
] as const

/**
 * Left sidebar for the desktop wizard.
 * Shows all 13 steps (0–12) with:
 *   - past steps: green checkmark
 *   - current step: green dot + bold text
 *   - future steps: grey dot
 */
export function DesktopStepSidebar({ slug }: DesktopStepSidebarProps) {
  const { state } = useWizard()
  const currentStep = state.step

  return (
    <aside
      data-testid="desktop-step-sidebar"
      data-slug={slug}
      className="border-r border-slate-200 bg-slate-50 p-5 overflow-y-auto"
    >
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
        Steps
      </h2>
      <ol className="space-y-1">
        {STEP_NAMES.map((name, index) => {
          const isPast = index < currentStep
          const isCurrent = index === currentStep
          const isFuture = index > currentStep

          return (
            <li
              key={index}
              className={[
                'flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm',
                isCurrent ? 'bg-green-50 font-semibold text-green-800' : '',
                isPast ? 'text-slate-600' : '',
                isFuture ? 'text-slate-400' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {/* Indicator */}
              <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                {isPast && (
                  <svg
                    className="h-4 w-4 text-green-500"
                    viewBox="0 0 16 16"
                    fill="none"
                    aria-hidden="true"
                  >
                    <circle cx="8" cy="8" r="7" fill="currentColor" fillOpacity="0.15" />
                    <path
                      d="M5 8l2 2 4-4"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
                {isCurrent && (
                  <span className="h-2.5 w-2.5 rounded-full bg-green-500" aria-hidden="true" />
                )}
                {isFuture && (
                  <span className="h-2 w-2 rounded-full bg-slate-300" aria-hidden="true" />
                )}
              </span>

              {/* Step number + name */}
              <span>
                <span className="text-xs text-slate-400 mr-1">{index}.</span>
                {name}
              </span>
            </li>
          )
        })}
      </ol>
    </aside>
  )
}
