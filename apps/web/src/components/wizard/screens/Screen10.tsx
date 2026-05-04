'use client'

import { useState } from 'react'
import { useWizard } from '@/contexts/WizardContext'

const LEGAL_CHECKBOXES = [
  {
    id: 'check-accuracy',
    text: 'I have verified all fields above — they are correct.',
  },
  {
    id: 'check-responsibility',
    text: 'I understand that I am responsible for the accuracy of the data in the form.',
  },
  {
    id: 'check-not-filing',
    text: 'I understand that Messenginfo does not file on my behalf — I file myself at my.uscis.gov or by mail.',
  },
] as const

const PAY_FEATURES = [
  'Completed I-131 (editable DOCX)',
  'Document translations to English',
  'Step-by-step USCIS data transfer guide',
  'Document checklist',
  'Download link valid 7 days',
]

export function Screen10() {
  const { state, setPaymentStatus, setStep } = useWizard()
  const { packageSize, packagePrice } = state
  const [loading, setLoading] = useState(false)
  const [checked, setChecked] = useState<Record<string, boolean>>({})

  const allChecked = LEGAL_CHECKBOXES.every((c) => checked[c.id])

  function toggleCheck(id: string) {
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  function handlePay() {
    if (!allChecked) return
    setLoading(true)
    setTimeout(() => {
      setPaymentStatus('mock_paid')
      setStep(11)
    }, 1500)
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[22px] font-bold leading-tight mb-2" style={{ color: 'var(--text-1)' }}>
          Review &amp; confirm
        </h1>
        <p className="text-[15px]" style={{ color: 'var(--text-2)' }}>
          Please read and acknowledge the items below before generating your packet.
        </p>
      </div>

      {/* Paywall card */}
      <div
        className="rounded-[16px] p-5 text-center"
        style={{ border: '2px solid var(--primary)', background: 'var(--surface)' }}
      >
        <p className="text-[40px] mb-2">📄</p>
        <h2 className="text-[18px] font-bold mb-1.5" style={{ color: 'var(--text-1)' }}>
          Ready-Made Document Packet
        </h2>
        <p className="text-[13px] mb-4 leading-relaxed" style={{ color: 'var(--text-2)' }}>
          All documents ready for USCIS submission
        </p>

        {/* Price */}
        <div className="mb-3">
          <span className="text-[42px] font-extrabold" style={{ color: 'var(--text-1)', fontVariantNumeric: 'tabular-nums' }}>
            <span className="text-[24px] align-top">$</span>{packagePrice}
          </span>
          <p className="text-[13px]" style={{ color: 'var(--text-3)' }}>
            for {packageSize} packet{packageSize !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Features */}
        <div
          className="rounded-[10px] p-3 text-left mb-4"
          style={{ background: 'var(--surface-2)' }}
        >
          {PAY_FEATURES.map((f) => (
            <div key={f} className="flex items-start gap-2 py-1">
              <span className="font-bold flex-shrink-0" style={{ color: 'var(--success)' }}>✓</span>
              <span className="text-[13px]" style={{ color: 'var(--text-2)' }}>{f}</span>
            </div>
          ))}
        </div>

        {/* Payment note */}
        <span
          className="inline-block text-[11px] font-semibold px-3 py-1 rounded-full mb-3"
          style={{ background: 'var(--warning-bg)', color: 'var(--warning-text)' }}
        >
          Payment not yet enabled — free in prototype
        </span>
      </div>

      {/* Legal checkboxes */}
      <div
        className="rounded-[12px] p-3.5 space-y-0"
        style={{ background: 'var(--warning-bg)', border: '1px solid var(--warning-border)' }}
      >
        <p
          className="text-[11px] font-semibold uppercase tracking-wide mb-3"
          style={{ color: 'var(--warning-text)', letterSpacing: '0.6px' }}
        >
          Mandatory acknowledgments
        </p>
        {LEGAL_CHECKBOXES.map((item) => (
          <label
            key={item.id}
            className="flex items-start gap-2.5 py-2 cursor-pointer"
            onClick={() => toggleCheck(item.id)}
          >
            <div
              className="w-[22px] h-[22px] rounded-[5px] flex-shrink-0 flex items-center justify-center mt-0.5"
              style={{
                border: `2px solid ${checked[item.id] ? 'var(--success)' : 'var(--warning-text)'}`,
                background: checked[item.id] ? 'var(--success)' : 'var(--surface)',
              }}
            >
              {checked[item.id] && <span className="text-white font-bold text-[14px]">✓</span>}
            </div>
            <input type="checkbox" checked={!!checked[item.id]} onChange={() => toggleCheck(item.id)} className="sr-only" />
            <span className="text-[13px] leading-relaxed" style={{ color: 'var(--text-1)' }}>
              {item.text}
            </span>
          </label>
        ))}
      </div>

      {/* Privacy note */}
      <div
        className="rounded-[12px] p-3.5 flex items-start gap-2.5"
        style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
      >
        <span className="flex-shrink-0">🔒</span>
        <p className="text-[12px] leading-relaxed" style={{ color: 'var(--text-2)' }}>
          We do not store your documents and personal data after generating the packet. All information is deleted automatically.
        </p>
      </div>

      <button
        type="button"
        onClick={handlePay}
        disabled={loading || !allChecked}
        className="w-full rounded-[10px] text-[15px] font-bold transition-all active:scale-[0.98]"
        style={{
          background: allChecked && !loading ? 'var(--btn-action)' : 'var(--border-strong)',
          color: allChecked && !loading ? 'var(--btn-action-text)' : 'var(--text-3)',
          border: 'none',
          padding: '14px',
          minHeight: '52px',
          cursor: allChecked && !loading ? 'pointer' : 'not-allowed',
          opacity: allChecked && !loading ? 1 : 0.6,
        }}
      >
        {loading ? 'Generating packet…' : !allChecked ? 'Acknowledge all items above to continue' : `Pay $${packagePrice} →`}
      </button>

      <p className="text-[11px]" style={{ color: 'var(--text-3)' }}>
        USCIS filing fees ($580 online / $630 paper) are paid separately and directly to USCIS.{' '}
        <a href="https://www.uscis.gov/feecalculator" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>
          Check current fees ↗
        </a>
      </p>
    </div>
  )
}
