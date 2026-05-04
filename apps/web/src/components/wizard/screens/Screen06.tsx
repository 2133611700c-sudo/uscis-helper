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

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Have this information ready</h1>
        <p className="mt-2 text-sm text-slate-500">
          You will enter these details directly on Form I-131. Check each item you have available.
        </p>
      </div>

      {/* Security notice */}
      <div className="rounded-xl bg-blue-50 border border-blue-200 p-4">
        <p className="text-xs text-blue-800 leading-relaxed">
          <strong>Privacy:</strong> We do not collect or store your personal identifiers
          (name, date of birth, I-94 number, passport number). Enter them directly on the
          official form. Do not include sensitive numbers in the explanation field.
        </p>
      </div>

      <MemberTabs activeIndex={activeIndex} onChange={setActiveIndex} />

      <div
        id={`member-panel-${activeIndex}`}
        role="tabpanel"
        aria-label={`Checklist for ${activeMember.alias}`}
        className="space-y-2"
      >
        {CHECKLIST_ITEMS.map((item) => (
          <label
            key={item.key}
            className={[
              'flex items-center gap-3 cursor-pointer rounded-xl border-2 p-3 transition-colors',
              activeMember.fields[item.key] === 'yes'
                ? 'border-green-300 bg-green-50'
                : 'border-slate-200 bg-white hover:border-slate-300',
            ].join(' ')}
          >
            <input
              type="checkbox"
              checked={activeMember.fields[item.key] === 'yes'}
              onChange={(e) => handleCheck(item.key, e.target.checked)}
              className="h-4 w-4 shrink-0 rounded border-slate-300 text-green-600 focus:ring-green-500"
            />
            <span className="text-sm text-slate-700">{item.label}</span>
          </label>
        ))}
      </div>

      <a
        href="https://i94.cbp.dhs.gov/"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
      >
        Look up your I-94 record at i94.cbp.dhs.gov →
      </a>

      <button
        type="button"
        onClick={() => setStep(7)}
        className="w-full rounded-xl bg-blue-600 px-6 py-3 text-base font-semibold text-white hover:bg-blue-700 transition-colors"
      >
        Continue →
      </button>
    </div>
  )
}
