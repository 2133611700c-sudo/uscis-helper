'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'

const LS_KEY = 'site:theme'

/**
 * Standalone light/dark toggle for the main site header.
 * Does NOT use WizardContext — safe to use outside the wizard.
 * Reads/writes localStorage and applies `dark` class to <html>.
 */
export function SiteThemeToggle() {
  const [isDark, setIsDark] = useState(false)

  // Hydrate from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LS_KEY)
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      const dark = stored === 'dark' || (stored === null && prefersDark)
      setIsDark(dark)
      if (dark) {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
    } catch {
      // localStorage unavailable — ignore
    }
  }, [])

  function handleToggle() {
    const next = !isDark
    setIsDark(next)
    try {
      localStorage.setItem(LS_KEY, next ? 'dark' : 'light')
    } catch {
      // ignore
    }
    if (next) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      className="rounded-md border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100 transition-colors"
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  )
}
