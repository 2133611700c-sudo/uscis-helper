'use client'

import { useState } from 'react'
import { useWizard } from '@/contexts/WizardContext'
import { MemberTabs } from '@/components/wizard/MemberTabs'

// PII POLICY: We do NOT collect or store names, dates of birth, passport numbers,
// I-94 numbers, or other identifying information. Users enter these directly on
// the official USCIS form. This checklist only tracks which items are ready.

const CHECKLIST_ITEMS = [
  { key: 'hasName', label: 'Full legal name (as on passport)' },
  { key: 'hasDob', label: 'Date of birth' },
  { key: 'hasI94', label: 'I-94 number (find at i94.cbp.dhs.gov)' },
  { key: 'hasCountry', label: 'Country of birth' },
  { key: 'hasPassport', label: 'Passport number and expiration date' },
  { key: 'hasAddress', label: 'Current U.S. mailing address' },
  { key: 'hasParoleDate', label: 'Current parole expiration date (on I-94)' },
]

export function Screen06() {
  const { state, setMember, setStep } = useWizard()
  const { members } = state
  const [activeIndex, setActiveIndex] = useState(0)

  const activeMember = members[activeIndex]

  function handleCheck(key: string, checked: boolean) {
    if (!activeMember) return
    setMember(activeMember.id, {
      fields: { ...activeMember.fields, [key]: checked ? 'yes' : '' },
    })
  }

  if (!activeMember) return null

  const checkedCount = CHECKLIST_ITEMS.filter(
    (i) => activeMember.fields[i.key] === 'yes',
  ).length

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[22px] font-bold leading-tight mb-2" style={{ color: 'var(--text-1)' }}>
          Have this information ready
        </h1>
        <p className="text-[15px]" style={{ color: 'var(--text-2)' }}>
          Tap <strong>✓ Correct</strong> on each field or <strong>Edit</strong> if something is wrong.
          Mandatory confirmation before payment.
        </p>
      </div>

      {/* Privacy notice */}
      <div
        className="rounded-[12px] p-3.5"
        style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', display: 'flex', gap: '10px' }}
      >
        <span className="text-[16px] flex-shrink-0">🔒</span>
        <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-2)' }}>
          We do not store your personal identifiers (name, date of birth, I-94, passport number).
          Enter them directly on the official form.
        </p>
      </div>

      <MemberTabs activeIndex={activeIndex} onChange={setActiveIndex} />

      <div
        id={`member-panel-${activeIndex}`}
        role="tabpanel"
        aria-label={`Checklist for ${activeMember.alias}`}
        className="space-y-2"
      >
        {CHECKLIST_ITEMS.map((item) => {
          const isChecked = activeMember.fields[item.key] === 'yes'
          return (
            <label
              key={item.key}
              className="flex items-start gap-3 rounded-[12px] cursor-pointer transition-all"
              style={{
                background: isChecked ? 'var(--success-bg)' : 'var(--surface)',
                border: `1px solid ${isChecked ? 'var(--success-border)' : 'var(--border)'}`,
                padding: '14px',
              }}
            >
              {/* Custom checkbox */}
              <div
                className="w-[22px] h-[22px] rounded-[5px] flex-shrink-0 flex items-center justify-center mt-0.5"
                style={{
                  border: `2px solid ${isChecked ? 'var(--success)' : 'var(--border-strong)'}`,
                  background: isChecked ? 'var(--success)' : 'var(--surface)',
                }}
              >
                {isChecked && (
                  <span className="text-white font-bold text-[14px]">✓</span>
                )}
              </div>
              <input
                type="checkbox"
                checked={isChecked}
                onChange={(e) => handleCheck(item.key, e.target.checked)}
                className="sr-only"
              />
              <span className="text-[14px]" style={{ color: 'var(--text-1)' }}>
                {item.label}
              </span>
            </label>
          )
        })}
      </div>

      {checkedCount > 0 && (
        <p className="text-[13px] font-medium" style={{ color: 'var(--success-text)' }}>
          ✓ {checkedCount} of {CHECKLIST_ITEMS.length} items confirmed
        </p>
      )}

      <a
        href="https://i94.cbp.dhs.gov/"
        target="_blank"
        rel="noopener noreferrer"
        className="text-[14px] font-semibold no-underline transition-all"
        style={{ color: 'var(--primary)' }}
      >
        Look up your I-94 record at i94.cbp.dhs.gov →
      </a>

      <button
        type="button"
        onClick={() => setStep(7)}
        className="w-full rounded-[10px] text-[15px] font-bold transition-all active:scale-[0.98]"
        style={{
          background: 'var(--btn-action)',
          color: 'var(--btn-action-text)',
          border: 'none',
          padding: '14px',
          minHeight: '52px',
        }}
      >
        Continue →
      </button>
    </div>
  )
}
