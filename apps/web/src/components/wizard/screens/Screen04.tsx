'use client'

import { useState, useRef } from 'react'
import { useWizard } from '@/contexts/WizardContext'
import { MemberTabs } from '@/components/wizard/MemberTabs'

type DocSlot = {
  key: string
  label: string
  desc: string
  required: boolean
}

const DOC_SLOTS: DocSlot[] = [
  {
    key: 'passport',
    label: 'Passport — photo page',
    desc: 'Photo page with your name, date of birth, and passport number.',
    required: true,
  },
  {
    key: 'i94',
    label: 'I-94 Arrival/Departure Record',
    desc: 'Print from i94.cbp.dhs.gov or use your paper copy.',
    required: true,
  },
  {
    key: 'parole_notice',
    label: 'Previous Parole Notice',
    desc: 'USCIS approval notice for your current parole period.',
    required: false,
  },
  {
    key: 'photo',
    label: 'Recent Passport-Style Photo',
    desc: '2×2 inch, white background, taken within 6 months.',
    required: false,
  },
]

export function Screen04() {
  const { state, setMember } = useWizard()
  const { members } = state
  const [activeIndex, setActiveIndex] = useState(0)

  const activeMember = members[activeIndex]
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  function handleUpload(docKey: string) {
    if (!activeMember) return
    inputRefs.current[docKey]?.click()
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
    <div className="space-y-4">
      <div>
        <h1 className="text-[22px] font-bold leading-tight mb-2" style={{ color: 'var(--text-1)' }}>
          Upload documents
        </h1>
        <p className="text-[15px]" style={{ color: 'var(--text-2)' }}>
          Take a photo — we auto-extract the data. Documents are separate for each family member.
        </p>
      </div>

      <MemberTabs activeIndex={activeIndex} onChange={setActiveIndex} />

      {/* Quality tip */}
      <button
        type="button"
        className="inline-flex items-center gap-1.5 rounded-full text-[12px] font-medium px-2.5 py-1.5"
        style={{ background: 'var(--info-bg)', border: '1px solid var(--info-border)', color: 'var(--info-text)' }}
      >
        💡 What photo quality is needed?
      </button>

      <div
        id={`member-panel-${activeIndex}`}
        role="tabpanel"
        aria-label={`Documents for ${activeMember.alias}`}
        className="space-y-2.5"
      >
        {DOC_SLOTS.map((slot) => {
          const doc = activeMember.docs[slot.key]
          const isDone = doc?.status === 'done'

          return (
            <div
              key={slot.key}
              className="rounded-[12px] p-3.5"
              style={{
                background: 'var(--surface)',
                border: isDone ? '1px solid var(--success-border)' : '1px solid var(--border)',
              }}
            >
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <p className="text-[14px] font-semibold" style={{ color: 'var(--text-1)' }}>
                  {slot.label}
                  {slot.required && (
                    <span className="ml-1.5 text-[11px] font-bold" style={{ color: 'var(--error-text)' }}>required</span>
                  )}
                </p>
                {isDone && (
                  <span
                    className="text-[12px] font-bold px-2 py-0.5 rounded-[6px] flex-shrink-0"
                    style={{ background: 'var(--success-bg)', color: 'var(--success-text)' }}
                  >
                    ✓ Uploaded
                  </span>
                )}
              </div>
              <p className="text-[13px] mb-2.5" style={{ color: 'var(--text-3)' }}>
                {slot.desc}
              </p>
              {!isDone && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleUpload(slot.key)}
                    className="flex-1 rounded-[8px] text-[14px] font-semibold transition-all active:scale-95"
                    style={{
                      background: 'var(--primary)',
                      color: '#fff',
                      border: 'none',
                      padding: '11px 14px',
                      minHeight: '44px',
                    }}
                  >
                    📷 Take Photo / Upload
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpload(slot.key)}
                    className="rounded-[8px] text-[14px] font-semibold transition-all active:scale-95"
                    style={{
                      background: 'var(--surface)',
                      border: '1.5px solid var(--border-strong)',
                      color: 'var(--text-1)',
                      padding: '11px 14px',
                      minHeight: '44px',
                    }}
                  >
                    📂 File
                  </button>
                </div>
              )}
              <input
                ref={(el) => { inputRefs.current[slot.key] = el }}
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
