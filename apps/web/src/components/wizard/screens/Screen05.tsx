'use client'

import { useState, useEffect } from 'react'
import { useWizard } from '@/contexts/WizardContext'
import { MemberTabs } from '@/components/wizard/MemberTabs'

export function Screen05() {
  const { state, setStep } = useWizard()
  const { members } = state
  const [activeIndex, setActiveIndex] = useState(0)
  const [analyzing, setAnalyzing] = useState(false)

  const activeMember = members[activeIndex]

  const hasUploadedDocs =
    activeMember != null &&
    Object.values(activeMember.docs).some((d) => d.status === 'done')

  useEffect(() => {
    if (!hasUploadedDocs) {
      setAnalyzing(false)
      return
    }
    setAnalyzing(true)
    const timer = setTimeout(() => setAnalyzing(false), 2000)
    return () => clearTimeout(timer)
  }, [activeIndex, hasUploadedDocs])

  if (!activeMember) return null

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[22px] font-bold leading-tight mb-2" style={{ color: 'var(--text-1)' }}>
          Reviewing your documents
        </h1>
        <p className="text-[15px]" style={{ color: 'var(--text-2)' }}>
          Checking uploaded files for each applicant.
        </p>
      </div>

      <MemberTabs activeIndex={activeIndex} onChange={setActiveIndex} />

      <div
        id={`member-panel-${activeIndex}`}
        role="tabpanel"
        aria-label={`Review for ${activeMember.alias}`}
        className="space-y-3"
      >
        {/* Spinner while analyzing */}
        {analyzing && (
          <div
            className="rounded-[12px] p-6 text-center"
            style={{ background: 'var(--info-bg)', border: '1px solid var(--info-border)' }}
          >
            <div
              className="w-[32px] h-[32px] rounded-full mx-auto mb-3 animate-spin"
              style={{
                border: '3px solid var(--info-border)',
                borderTopColor: 'var(--primary)',
              }}
              aria-label="Analyzing"
            />
            <p className="text-[14px] font-medium" style={{ color: 'var(--info-text)' }}>
              Analyzing… ⏳
            </p>
            <p className="text-[12px] mt-1" style={{ color: 'var(--text-3)' }}>
              Extracting data from your documents
            </p>
          </div>
        )}

        {/* No uploads */}
        {!analyzing && !hasUploadedDocs && (
          <>
            <div
              className="rounded-[12px] p-4"
              style={{
                background: 'var(--warning-bg)',
                border: '1px solid var(--warning-border)',
              }}
            >
              <div className="flex items-start gap-2.5">
                <span className="text-[20px] flex-shrink-0">📄</span>
                <div>
                  <p className="text-[14px] font-semibold mb-1" style={{ color: 'var(--warning-text)' }}>
                    No documents uploaded for {activeMember.alias}
                  </p>
                  <p className="text-[13px] leading-relaxed" style={{ color: 'var(--warning-text)' }}>
                    That&apos;s fine — you&apos;ll fill in the details directly on Form I-131.
                    Skip ahead and we&apos;ll guide you through every required field.
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setStep(6)}
              className="w-full rounded-[10px] text-[15px] font-bold transition-all active:scale-[0.98]"
              style={{
                background: 'var(--btn-action)',
                color: 'var(--btn-action-text)',
                border: 'none',
                padding: '14px',
                minHeight: '52px',
              }}
            >
              Continue — fill in details manually →
            </button>
          </>
        )}

        {/* Uploads done */}
        {!analyzing && hasUploadedDocs && (
          <>
            <div
              className="rounded-[12px] p-4"
              style={{ background: 'var(--success-bg)', border: '1px solid var(--success-border)' }}
            >
              <p
                className="text-[11px] font-semibold uppercase tracking-wide mb-3"
                style={{ color: 'var(--success-text)', letterSpacing: '0.6px' }}
              >
                ✓ All documents recognized
              </p>
              <p className="text-[13px] mb-3 leading-relaxed" style={{ color: 'var(--success-text)' }}>
                We extracted data from your documents. Now you&apos;ll verify each field.
              </p>
              {Object.entries(activeMember.docs)
                .filter(([, d]) => d.status === 'done')
                .map(([docKey]) => (
                  <div
                    key={docKey}
                    className="flex items-center justify-between text-[13px] py-1"
                  >
                    <span className="capitalize" style={{ color: 'var(--text-2)' }}>
                      {docKey.replace(/_/g, ' ')}
                    </span>
                    <span className="font-bold text-[12px]" style={{ color: 'var(--success-text)' }}>
                      ✓ Uploaded
                    </span>
                  </div>
                ))}
              <p className="mt-2 text-[12px]" style={{ color: 'var(--text-3)' }}>
                Automated field extraction available in a future update.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setStep(6)}
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
          </>
        )}
      </div>
    </div>
  )
}
