'use client'

import { LanguageSwitcher } from './LanguageSwitcher'
import { ThemeToggle } from './ThemeToggle'
import { useWizard } from '@/contexts/WizardContext'

const TOTAL_STEPS = 12

const STEP_LABELS: Record<number, string> = {
  0: 'Welcome',
  1: 'About the Form',
  2: 'Package',
  3: 'Family',
  4: 'Documents',
  5: 'Recognition',
  6: 'Confirm',
  7: 'Info & Evidence',
  8: 'Filing Method',
  9: 'Preview',
  10: 'Payment',
  11: 'Download',
  12: 'Transfer',
}

function SyncIndicator() {
  const { syncStatus } = useWizard()

  if (syncStatus === 'idle') return null

  const label =
    syncStatus === 'saving'
      ? 'Saving…'
      : syncStatus === 'saved'
        ? '✓ Saved'
        : 'Could not save'

  const color =
    syncStatus === 'saving'
      ? 'var(--text-3)'
      : syncStatus === 'saved'
        ? 'var(--success)'
        : 'var(--warning-text)'

  return (
    <span
      className="text-[11px] font-medium flex items-center gap-1"
      style={{ color }}
    >
      <span
        className="w-[5px] h-[5px] rounded-full inline-block"
        style={{ background: color, animation: syncStatus === 'saving' ? 'pulse 1s infinite' : undefined }}
      />
      {label}
    </span>
  )
}

function ProgressDots({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: TOTAL_STEPS + 1 }).map((_, i) => {
        const isDone = i < step
        const isActive = i === step
        return (
          <span
            key={i}
            style={{
              width: isActive ? '18px' : '6px',
              height: '6px',
              borderRadius: isActive ? '3px' : '50%',
              background: isActive ? 'var(--primary)' : isDone ? 'var(--primary)' : 'var(--border-strong)',
              opacity: isDone && !isActive ? 0.5 : 1,
              transition: 'all 0.2s',
              flexShrink: 0,
              display: 'inline-block',
            }}
          />
        )
      })}
    </div>
  )
}

/**
 * Sticky header — 2 rows matching prototype:
 *   Row 1: progress dots | lang + theme
 *   Row 2: step label    | sync status
 */
export function WizardHeader() {
  const { state } = useWizard()
  const stepLabel = STEP_LABELS[state.step] ?? `Step ${state.step + 1}`

  return (
    <header
      className="sticky top-0 z-50 px-4 py-2.5 flex flex-col gap-1.5"
      style={{
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      {/* Row 1: progress + lang/theme */}
      <div className="flex items-center justify-between gap-2">
        <ProgressDots step={state.step} />
        <div className="flex items-center gap-2 flex-shrink-0">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </div>

      {/* Row 2: step label + sync status */}
      <div className="flex items-center justify-between gap-2">
        <span
          className="text-[12px] font-semibold"
          style={{ color: 'var(--text-2)', fontVariantNumeric: 'tabular-nums' }}
        >
          Step {state.step + 1} of {TOTAL_STEPS + 1} · {stepLabel}
        </span>
        <SyncIndicator />
      </div>
    </header>
  )
}
