'use client'

import { useState, useRef } from 'react'
import { useWizard } from '@/contexts/WizardContext'
import { MemberTabs } from '@/components/wizard/MemberTabs'

type DocSlot = {
  key: string
  label: string
}

const DOC_SLOTS: DocSlot[] = [
  { key: 'passport', label: 'Passport photo page' },
  { key: 'i94', label: 'I-94 record' },
  { key: 'parole_notice', label: 'Previous parole notice' },
  { key: 'photo', label: 'Recent photo (passport-style)' },
]

export function Screen04() {
  const { state, setMember } = useWizard()
  const { members } = state
  const [activeIndex, setActiveIndex] = useState(0)

  const activeMember = members[activeIndex]

  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  function handleUpload(docKey: string) {
    if (!activeMember) return
    const input = inputRefs.current[docKey]
    if (!input) return
    input.click()
  }

  function handleFileChange(docKey: string) {
    if (!activeMember) return
    setMember(activeMember.id, {
      docs: {
        ...activeMember.docs,
        [docKey]: { storageKey: `mock:${docKey}`, status: 'done' },
      },
    })
  }

  if (!activeMember) return null

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Upload your documents</h1>
        <p className="mt-2 text-sm text-slate-500">
          Documents are processed securely. We do not share your files.
        </p>
      </div>

      <MemberTabs activeIndex={activeIndex} onChange={setActiveIndex} />

      <div
        id={`member-panel-${activeIndex}`}
        role="tabpanel"
        aria-label={`Documents for ${activeMember.alias}`}
        className="space-y-3"
      >
        {DOC_SLOTS.map((slot) => {
          const doc = activeMember.docs[slot.key]
          const isDone = doc?.status === 'done'

          return (
            <div
              key={slot.key}
              className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4"
            >
              <span className="text-sm font-medium text-slate-700">{slot.label}</span>

              {isDone ? (
                <span className="text-sm font-semibold text-green-600">Uploaded ✓</span>
              ) : (
                <button
                  type="button"
                  onClick={() => handleUpload(slot.key)}
                  className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-colors"
                >
                  Upload
                </button>
              )}

              {/* Hidden file input */}
              <input
                ref={(el) => {
                  inputRefs.current[slot.key] = el
                }}
                type="file"
                accept="image/*,.pdf"
                className="sr-only"
                aria-label={`Upload ${slot.label}`}
                onChange={() => handleFileChange(slot.key)}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
