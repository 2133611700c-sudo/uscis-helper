'use client'

import { useState } from 'react'
import { GLOSSARY } from './GlossaryProvider'

interface GlossaryTooltipProps {
  term: string
  children: React.ReactNode
}

/**
 * Wraps `children` with a dotted underline and shows the glossary definition
 * on hover (desktop) or tap (mobile).
 *
 * Uses a CSS-based tooltip — no Radix required.
 */
export function GlossaryTooltip({ term, children }: GlossaryTooltipProps) {
  const definition = GLOSSARY[term]
  const [visible, setVisible] = useState(false)

  if (!definition) {
    // No glossary entry — render children as-is
    return <>{children}</>
  }

  return (
    <span className="relative inline-block">
      {/* Trigger */}
      <span
        role="button"
        tabIndex={0}
        aria-label={`Definition: ${term}`}
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
        onClick={() => setVisible((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setVisible((v) => !v)
          }
          if (e.key === 'Escape') setVisible(false)
        }}
        className={[
          'cursor-help',
          'border-b border-dashed border-slate-400',
          'text-inherit',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:rounded-sm',
        ].join(' ')}
      >
        {children}
      </span>

      {/* Tooltip bubble */}
      {visible && (
        <span
          role="tooltip"
          className={[
            'absolute bottom-full left-1/2 -translate-x-1/2 mb-2',
            'z-50 w-64 max-w-[calc(100vw-2rem)]',
            'rounded-lg bg-slate-800 text-white text-sm leading-snug',
            'px-3 py-2 shadow-xl',
            // Arrow
            "after:content-[''] after:absolute after:top-full after:left-1/2 after:-translate-x-1/2",
            'after:border-4 after:border-transparent after:border-t-slate-800',
          ].join(' ')}
        >
          <span className="block font-semibold text-xs text-slate-300 mb-1">{term}</span>
          {definition}
        </span>
      )}
    </span>
  )
}
