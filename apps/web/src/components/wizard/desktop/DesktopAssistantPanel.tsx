'use client'

import { useWizard } from '@/contexts/WizardContext'

interface DesktopAssistantPanelProps {
  slug: string
}

const USCIS_LINKS = [
  {
    label: 'USCIS · Form I-131',
    href: 'https://www.uscis.gov/i-131',
  },
  {
    label: 'USCIS · Processing Times',
    href: 'https://egov.uscis.gov/processing-times/',
  },
  {
    label: 'CBP · I-94 Lookup',
    href: 'https://i94.cbp.dhs.gov/',
  },
  {
    label: 'USCIS · Re-Parole Information',
    href: 'https://www.uscis.gov/humanitarian/re-parole',
  },
] as const

/**
 * Right assistant panel for the desktop wizard.
 * Shows Mia intro + official USCIS source links.
 */
export function DesktopAssistantPanel({ slug }: DesktopAssistantPanelProps) {
  const { setMiaOpen } = useWizard()

  return (
    <aside
      data-testid="desktop-assistant-panel"
      data-slug={slug}
      className="border-l border-slate-200 bg-white p-5 overflow-y-auto"
    >
      {/* Mia card */}
      <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 mb-6">
        <h2 className="mb-1 text-sm font-semibold text-blue-900">Mia — Your Assistant</h2>
        <p className="mb-3 text-xs text-blue-700 leading-relaxed">
          Ask Mia any question about the Re-Parole U4U process
        </p>
        <button
          type="button"
          onClick={() => setMiaOpen(true)}
          className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors"
        >
          Ask Mia →
        </button>
      </div>

      {/* Official sources */}
      <div>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Official Sources
        </h3>
        <ul className="space-y-2">
          {USCIS_LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 hover:underline transition-colors"
              >
                <svg
                  className="h-3 w-3 shrink-0 text-slate-400"
                  viewBox="0 0 12 12"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M2 10L10 2M10 2H5M10 2v5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </div>

      <p className="mt-6 text-xs text-slate-400 leading-relaxed">
        Information and document support only. Not legal advice.
      </p>
    </aside>
  )
}
