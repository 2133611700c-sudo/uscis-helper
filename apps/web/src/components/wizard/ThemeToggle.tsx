'use client'

import { useEffect } from 'react'
import { Moon, Sun } from 'lucide-react'
import { useWizard } from '@/contexts/WizardContext'

const SS_KEY = 'wizard:theme'

/**
 * Light/dark theme toggle.
 * - Reads/sets `theme` from WizardContext
 * - Applies `data-theme` attribute to `document.documentElement`
 * - Also syncs to sessionStorage key `wizard:theme`
 */
export function ThemeToggle() {
  const { state, setTheme } = useWizard()
  const isDark = state.theme === 'dark'

  // Apply data-theme to root element whenever theme changes
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', state.theme)
    try {
      sessionStorage.setItem(SS_KEY, state.theme)
    } catch {
      // sessionStorage unavailable — ignore
    }
  }, [state.theme])

  function handleToggle() {
    setTheme(isDark ? 'light' : 'dark')
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
