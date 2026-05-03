'use client'

interface DesktopAssistantPanelProps {
  slug: string
}

/**
 * Right panel for desktop wizard. Replaces the mobile floating Mia trigger.
 * Holds USCIS official-source links + Mia chat (Stage 2). Shell-only stub.
 */
export function DesktopAssistantPanel({ slug }: DesktopAssistantPanelProps) {
  return (
    <aside
      data-testid="desktop-assistant-panel"
      data-slug={slug}
      className="border-l border-slate-200 bg-white p-5"
    >
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-500">
        Help &amp; sources
      </h2>
      {/* Stage 2: Mia card + sources list + checklist */}
      <ul className="space-y-2 text-sm text-ink-700">
        <li>
          <a
            href="https://www.uscis.gov/i-131"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-600 hover:text-brand-700"
          >
            USCIS · Form I-131
          </a>
        </li>
        <li>
          <a
            href="https://i94.cbp.dhs.gov/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-600 hover:text-brand-700"
          >
            CBP · I-94 Lookup
          </a>
        </li>
        <li>
          <a
            href="https://egov.uscis.gov/processing-times/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-600 hover:text-brand-700"
          >
            USCIS · Processing Times
          </a>
        </li>
      </ul>
      <p className="mt-4 text-xs text-ink-500">
        Information and document support only. Not legal advice.
      </p>
    </aside>
  )
}
