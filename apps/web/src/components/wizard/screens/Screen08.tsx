'use client'

import { useWizard } from '@/contexts/WizardContext'
import type { WizardState } from '@/contexts/WizardContext'

type FilingOption = {
  value: WizardState['filingMethod']
  title: string
  description: string
  icon: string
}

const OPTIONS: FilingOption[] = [
  {
    value: 'online',
    title: 'Online via myUSCIS',
    description: 'File electronically at my.uscis.gov. Requires a myUSCIS account. Verify current fee at uscis.gov/feecalculator.',
    icon: '🌐',
  },
  {
    value: 'mail',
    title: 'Mail to USCIS lockbox',
    description: 'Print and mail I-131 with photos and supporting documents. Verify current fee at uscis.gov/feecalculator. Check uscis.gov/i-131-addresses for current mailing address.',
    icon: '📬',
  },
  {
    value: 'unsure',
    title: 'I am not sure yet',
    description: 'We will include instructions for both methods in your packet. You can decide later.',
    icon: '🤔',
  },
]

export function Screen08() {
  const { state, setFilingMethod, setStep } = useWizard()
  const { filingMethod } = state

  function handleSelect(value: WizardState['filingMethod']) {
    setFilingMethod(value)
    setStep(9)
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[22px] font-bold leading-tight mb-2" style={{ color: 'var(--text-1)' }}>
          How will you file?
        </h1>
        <p className="text-[15px]" style={{ color: 'var(--text-2)' }}>
          Choose the submission method that works best for you.
        </p>
      </div>

      <div className="space-y-2.5">
        {OPTIONS.map((opt) => {
          const isSelected = filingMethod === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleSelect(opt.value)}
              className="w-full text-left rounded-[12px] transition-all active:scale-[0.99]"
              style={{
                background: isSelected ? 'var(--accent)' : 'var(--surface)',
                border: isSelected ? '2px solid var(--primary)' : '1.5px solid var(--border-strong)',
                padding: isSelected ? '13px' : '14px',
              }}
            >
              <div className="flex items-start gap-3">
                <span className="text-[20px] flex-shrink-0">{opt.icon}</span>
                <div>
                  <p className="text-[14px] font-semibold mb-1" style={{ color: isSelected ? 'var(--primary)' : 'var(--text-1)' }}>
                    {opt.title}
                  </p>
                  <p className="text-[13px]" style={{ color: 'var(--text-2)' }}>{opt.description}</p>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* Regulatory callout */}
      <div
        className="rounded-[12px] p-3.5 space-y-2"
        style={{ background: 'var(--info-bg)', border: '1px solid var(--info-border)' }}
      >
        <p className="text-[12px] font-semibold" style={{ color: 'var(--info-text)' }}>
          Form I-131 (edition 01/20/25) — key items:
        </p>
        <div className="text-[12px] space-y-1" style={{ color: 'var(--info-text)' }}>
          <p>· <strong>Part 2, Item 1.e</strong> — Select "Re-Parole" as the basis for your application.</p>
          <p>· <strong>Box 10.C</strong> — Enter your current parole expiration date (from your I-94 or approval notice).</p>
        </div>
      </div>

      {/* Mailing address warning */}
      <div
        className="rounded-[12px] p-3.5"
        style={{ background: 'var(--warning-bg)', border: '1px solid var(--warning-border)' }}
      >
        <p className="text-[12px]" style={{ color: 'var(--warning-text)' }}>
          Mailing addresses can change. Always verify at{' '}
          <a
            href="https://www.uscis.gov/i-131-addresses"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--warning-text)', fontWeight: 600 }}
          >
            uscis.gov/i-131-addresses ↗
          </a>
          {' '}before sending.
        </p>
      </div>
    </div>
  )
}
