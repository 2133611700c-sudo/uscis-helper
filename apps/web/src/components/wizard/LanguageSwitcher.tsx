'use client'

import { useWizard } from '@/contexts/WizardContext'
import type { WizardState } from '@/contexts/WizardContext'

type Locale = WizardState['locale']

const CYCLE: Locale[] = ['ru', 'uk', 'en', 'es']

const LOCALE_LABELS: Record<Locale, string> = {
  ru: '🇷🇺 RU',
  uk: '🇺🇦 UK',
  en: '🇺🇸 EN',
  es: '🇪🇸 ES',
}

/**
 * Cyclic locale switcher: ru → uk → en → es → ru
 * Reads and sets locale via WizardContext.
 */
export function LanguageSwitcher() {
  const { state, setLocale } = useWizard()

  function handleClick() {
    const currentIndex = CYCLE.indexOf(state.locale)
    const nextIndex = (currentIndex + 1) % CYCLE.length
    setLocale(CYCLE[nextIndex])
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors"
      aria-label="Switch language"
    >
      {LOCALE_LABELS[state.locale]}
    </button>
  )
}
