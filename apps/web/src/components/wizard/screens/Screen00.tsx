'use client'

import { useWizard } from '@/contexts/WizardContext'

export function Screen00() {
  const { state, setStep } = useWizard()
  const isReturning = Boolean(state.sessionId) && state.step > 0

  return (
    <div className="space-y-4">

      {/* Welcome-back card (returning users) */}
      {isReturning && (
        <div
          className="rounded-[12px] p-4"
          style={{
            background: 'var(--info-bg)',
            border: '1.5px solid var(--info-border)',
          }}
        >
          <h3 className="text-[16px] font-semibold mb-1.5" style={{ color: 'var(--info-text)' }}>
            Welcome back!
          </h3>
          <p className="text-[13px] mb-3" style={{ color: 'var(--info-text)' }}>
            You have an unfinished application. Continue where you left off?
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep(state.step)}
              className="flex-1 rounded-[8px] text-[14px] font-semibold transition-all active:scale-95"
              style={{
                background: 'var(--primary)',
                color: '#fff',
                border: 'none',
                padding: '10px',
                minHeight: '44px',
              }}
            >
              Continue (Step {state.step + 1})
            </button>
            <button
              type="button"
              onClick={() => setStep(1)}
              className="rounded-[8px] text-[13px] font-medium transition-all active:scale-95"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border-strong)',
                color: 'var(--text-1)',
                padding: '10px 14px',
                minHeight: '44px',
              }}
            >
              Start over
            </button>
          </div>
        </div>
      )}

      {/* Badges */}
      <div className="flex gap-2 flex-wrap">
        <span
          className="text-[12px] font-semibold px-2.5 py-1 rounded-full"
          style={{ background: 'var(--info-bg)', color: 'var(--info-text)' }}
        >
          Form I-131
        </span>
        <span
          className="text-[12px] font-semibold px-2.5 py-1 rounded-full"
          style={{ background: 'var(--surface-2)', color: 'var(--text-2)', border: '1px solid var(--border)' }}
        >
          Edition 02/27/26
        </span>
        <span
          className="text-[12px] font-semibold px-2.5 py-1 rounded-full"
          style={{ background: 'var(--success-bg)', color: 'var(--success-text)' }}
        >
          Source: USCIS
        </span>
      </div>

      {/* Title */}
      <div>
        <h1 className="text-[22px] font-bold leading-tight mb-2" style={{ color: 'var(--text-1)' }}>
          Re-Parole for{' '}
          <span style={{ color: 'var(--primary)' }}>U4U</span>
        </h1>
        <p className="text-[15px] leading-relaxed" style={{ color: 'var(--text-2)' }}>
          Upload your passport and I-94 — we extract the data, fill Form I-131, and
          prepare a complete document packet for download.
        </p>
      </div>

      {/* Fee block */}
      <div
        className="rounded-[12px] p-3.5"
        style={{
          background: 'var(--surface)',
          border: '2px solid var(--primary)',
        }}
      >
        <p
          className="text-[11px] font-semibold uppercase tracking-wide mb-2"
          style={{ color: 'var(--text-3)', letterSpacing: '0.6px' }}
        >
          Our Service Fee
        </p>
        <div className="flex items-baseline justify-between">
          <strong className="text-[14px]" style={{ color: 'var(--text-1)' }}>
            Document Packet Preparation
          </strong>
          <span className="text-[17px] font-bold" style={{ color: 'var(--text-1)', fontVariantNumeric: 'tabular-nums' }}>
            from $15
          </span>
        </div>
        <p className="text-[11px] mt-2" style={{ color: 'var(--text-3)' }}>
          USCIS filing fees paid separately — details at the end of the process.
        </p>
      </div>

      {/* What you get */}
      <div
        className="rounded-[12px] p-3.5"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <p
          className="text-[11px] font-semibold uppercase tracking-wide mb-3"
          style={{ color: 'var(--text-3)', letterSpacing: '0.6px' }}
        >
          What you get
        </p>
        {[
          'Completed I-131 (editable DOCX + PDF)',
          'Ready-to-submit document packet for USCIS',
          'Document checklist',
          'Copy-Next-Field mode for filing from one device',
          'All documents — download or receive via email',
        ].map((item) => (
          <div key={item} className="flex gap-2.5 py-1.5 text-[14px]" style={{ color: 'var(--text-1)' }}>
            <span className="font-bold w-[18px] flex-shrink-0" style={{ color: 'var(--success)' }}>✓</span>
            <span>{item}</span>
          </div>
        ))}
      </div>

      {/* Disclaimer */}
      <div
        className="rounded-[12px] p-3.5 text-[13px] leading-relaxed"
        style={{ background: 'var(--surface-2)', color: 'var(--text-2)', border: '1px solid var(--border)' }}
      >
        <strong style={{ color: 'var(--text-1)' }}>Messenginfo</strong> prepares documents for self-filing.
        All information is for guidance only. You file yourself at my.uscis.gov or by mail.
      </div>

      {/* Citation */}
      <p className="text-[11px]" style={{ color: 'var(--text-3)', paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
        <a href="https://www.uscis.gov/i-131" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', fontWeight: 600 }}>
          USCIS · Form I-131
        </a>
        {' · '}
        <a href="https://www.uscis.gov/forms/forms-updates" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', fontWeight: 600 }}>
          Forms Updates
        </a>
        <br />
        Edition 02/27/26 · accepted from April 1, 2026
      </p>

      {/* Receipt number check */}
      <div
        className="rounded-[12px] p-3.5"
        style={{ background: 'var(--info-bg)', border: '1px solid var(--info-border)' }}
      >
        <p className="text-[14px] font-semibold mb-1.5" style={{ color: 'var(--info-text)' }}>
          Already have a Receipt Number?
        </p>
        <p className="text-[13px] mb-3" style={{ color: 'var(--info-text)' }}>
          If you have a pending USCIS case — check its status first.
        </p>
        <a
          href="https://egov.uscis.gov/casestatus/landing.do"
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full text-center rounded-[8px] text-[14px] font-semibold no-underline transition-all active:scale-95 mb-2"
          style={{
            background: 'var(--primary)',
            color: '#fff',
            padding: '11px',
            minHeight: '44px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          Check status on USCIS ↗
        </a>
        <p className="text-[11px] mt-2" style={{ color: 'var(--text-3)' }}>
          Receipt number — 13 chars: 3 letters (IOE/WAC/LIN/SRC/NBC/MSC) + 10 digits. Found in your USCIS notice. Opens the official USCIS site — we don't store your number.
        </p>
      </div>

      {/* CTA */}
      <button
        type="button"
        onClick={() => setStep(1)}
        className="w-full rounded-[10px] text-[15px] font-bold transition-all active:scale-[0.98]"
        style={{
          background: 'var(--btn-action)',
          color: 'var(--btn-action-text)',
          border: 'none',
          padding: '14px',
          minHeight: '52px',
        }}
      >
        Start →
      </button>
    </div>
  )
}
