'use client'

import { useWizard } from '@/contexts/WizardContext'
import { WizardNavBar } from '@/components/wizard/WizardNavBar'
import { MiaFAB } from '@/components/wizard/MiaFAB'
import { MiaSheet } from '@/components/wizard/MiaSheet'
import { Screen00 } from '@/components/wizard/screens/Screen00'
import { Screen01 } from '@/components/wizard/screens/Screen01'
import { Screen02 } from '@/components/wizard/screens/Screen02'
import { Screen03 } from '@/components/wizard/screens/Screen03'
import { Screen04 } from '@/components/wizard/screens/Screen04'
import { Screen05 } from '@/components/wizard/screens/Screen05'
import { Screen06 } from '@/components/wizard/screens/Screen06'
import { Screen07 } from '@/components/wizard/screens/Screen07'
import { Screen08 } from '@/components/wizard/screens/Screen08'
import { Screen09 } from '@/components/wizard/screens/Screen09'
import { Screen10 } from '@/components/wizard/screens/Screen10'
import { Screen11 } from '@/components/wizard/screens/Screen11'
import { Screen12 } from '@/components/wizard/screens/Screen12'

const SCREENS: Record<number, React.ComponentType> = {
  0: Screen00,
  1: Screen01,
  2: Screen02,
  3: Screen03,
  4: Screen04,
  5: Screen05,
  6: Screen06,
  7: Screen07,
  8: Screen08,
  9: Screen09,
  10: Screen10,
  11: Screen11,
  12: Screen12,
}

function SyncIndicator({ status }: { status: import('@/contexts/WizardContext').SyncStatus }) {
  if (status === 'idle') return null

  const label =
    status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved' : 'Could not save'

  const color =
    status === 'saving'
      ? 'text-slate-400'
      : status === 'saved'
        ? 'text-green-600'
        : 'text-amber-600'

  return (
    <span
      aria-live="polite"
      className={`fixed top-2 right-3 z-50 text-[11px] font-medium transition-opacity ${color}`}
    >
      {label}
    </span>
  )
}

export function WizardController() {
  const { state, syncStatus, setStep } = useWizard()
  const { step } = state

  const ActiveScreen = SCREENS[step] ?? Screen00

  function handleBack() {
    if (step > 0) setStep(step - 1)
  }

  function handleNext() {
    if (step < 12) setStep(step + 1)
  }

  return (
    <div className="relative pb-20 lg:pb-0">
      <SyncIndicator status={syncStatus} />
      <ActiveScreen />
      <WizardNavBar step={step} onBack={handleBack} onNext={handleNext} />
      <MiaFAB />
      <MiaSheet />
    </div>
  )
}
