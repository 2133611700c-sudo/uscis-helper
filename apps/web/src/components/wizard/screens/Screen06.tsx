'use client'

import { useState } from 'react'
import { useWizard } from '@/contexts/WizardContext'
import { MemberTabs } from '@/components/wizard/MemberTabs'

type FieldDef = { key: string; label: string; required?: boolean; type?: string }

const FIELDS: FieldDef[] = [
  { key: 'lastName', label: 'Last name', required: true },
  { key: 'firstName', label: 'First name', required: true },
  { key: 'middleName', label: 'Middle name' },
  { key: 'dob', label: 'Date of birth', type: 'date' },
  { key: 'countryOfBirth', label: 'Country of birth' },
  { key: 'i94Number', label: 'I-94 number' },
]

export function Screen06() {
  const { state, setMember, setStep } = useWizard()
  const { members } = state
  const [activeIndex, setActiveIndex] = useState(0)

  const activeMember = members[activeIndex]

  function handleChange(key: string, value: string) {
    if (!activeMember) return
    setMember(activeMember.id, {
      fields: { ...activeMember.fields, [key]: value },
    })
  }

  if (!activeMember) return null

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Confirm your information</h1>
        <p className="mt-2 text-sm text-slate-500">
          Review and edit the details for each applicant.
        </p>
      </div>

      <MemberTabs activeIndex={activeIndex} onChange={setActiveIndex} />

      <form
        id={`member-panel-${activeIndex}`}
        role="tabpanel"
        aria-label={`Fields for ${activeMember.alias}`}
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          setStep(7)
        }}
      >
        {FIELDS.map((field) => (
          <div key={field.key} className="flex flex-col gap-1">
            <label
              htmlFor={`field-${field.key}`}
              className="text-xs font-semibold text-slate-600 uppercase tracking-wide"
            >
              {field.label}
              {field.required && <span className="text-red-500 ml-0.5">*</span>}
            </label>
            <input
              id={`field-${field.key}`}
              type={field.type ?? 'text'}
              value={activeMember.fields[field.key] ?? ''}
              onChange={(e) => handleChange(field.key, e.target.value)}
              required={field.required}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        ))}

        <button
          type="submit"
          className="mt-2 w-full rounded-xl bg-blue-600 px-6 py-3 text-base font-semibold text-white hover:bg-blue-700 transition-colors"
        >
          Save &amp; Continue
        </button>
      </form>
    </div>
  )
}
