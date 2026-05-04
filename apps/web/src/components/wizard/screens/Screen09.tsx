'use client'

import { useWizard } from '@/contexts/WizardContext'

const PACKET_FILES = [
  { icon: '📄', name: 'Form I-131 (editable DOCX)', size: '~120 KB' },
  { icon: '📋', name: 'Form I-131 (PDF)', size: '~95 KB' },
  { icon: '✅', name: 'Document checklist', size: '~40 KB' },
  { icon: '📝', name: 'Field-by-field USCIS transfer guide', size: '~60 KB' },
]

export function Screen09() {
  const { state, setStep } = useWizard()
  const { members, filingMethod, packageSize, packagePrice } = state

  const filingLabel =
    filingMethod === 'mail'
      ? 'Mail to USCIS lockbox'
      : filingMethod === 'online'
        ? 'Online via myUSCIS'
        : 'Filing method not selected'

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[22px] font-bold leading-tight mb-2" style={{ color: 'var(--text-1)' }}>
          Review your packet
        </h1>
        <p className="text-[15px]" style={{ color: 'var(--text-2)' }}>
          Free preview — see what's in your packet. Download after payment.
        </p>
      </div>

      {/* Member summary */}
      <div className="space-y-2">
        {members.map((member, i) => (
          <div
            key={member.id}
            className="rounded-[12px] p-3.5 flex items-center justify-between"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <div>
              <p className="text-[14px] font-semibold" style={{ color: 'var(--text-1)' }}>
                {member.alias || `Person ${i + 1}`}
              </p>
              <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-3)' }}>
                Packet {i + 1} · I-131 Re-Parole U4U
              </p>
            </div>
            <span
              className="text-[11px] font-bold px-2.5 py-1 rounded-full"
              style={{ background: 'var(--success-bg)', color: 'var(--success-text)' }}
            >
              Ready
            </span>
          </div>
        ))}
      </div>

      {/* 📋 Free preview — what's in the packet */}
      <div>
        <p
          className="text-[11px] font-semibold uppercase tracking-wide mb-2"
          style={{ color: 'var(--text-3)', letterSpacing: '0.6px' }}
        >
          📋 Free Preview — What you get
        </p>
        <div
          className="rounded-[12px] overflow-hidden"
          style={{ border: '1px solid var(--border)' }}
        >
          {PACKET_FILES.map((file, idx) => (
            <div
              key={file.name}
              className="flex items-center gap-3 px-3.5 py-3"
              style={{
                borderBottom: idx < PACKET_FILES.length - 1 ? '1px solid var(--border)' : undefined,
              }}
            >
              <span className="text-[18px] flex-shrink-0">{file.icon}</span>
              <span className="flex-1 text-[14px]" style={{ color: 'var(--text-1)' }}>
                {file.name}
              </span>
              <span className="text-[11px]" style={{ color: 'var(--text-3)' }}>
                {file.size}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Cost summary */}
      <div
        className="rounded-[12px] p-3.5"
        style={{ background: 'var(--info-bg)', border: '1px solid var(--info-border)' }}
      >
        <p className="text-[14px] font-semibold" style={{ color: 'var(--info-text)' }}>
          {packageSize} applicant{packageSize !== 1 ? 's' : ''} · ${packagePrice} service fee · {filingLabel}
        </p>
        <p className="text-[12px] mt-1" style={{ color: 'var(--info-text)' }}>
          USCIS filing fees are paid separately and directly to USCIS. Verify current amounts at uscis.gov/feecalculator.
        </p>
      </div>

      <button
        type="button"
        onClick={() => setStep(10)}
        className="w-full rounded-[10px] text-[15px] font-bold transition-all active:scale-[0.98]"
        style={{
          background: 'var(--btn-action)',
          color: 'var(--btn-action-text)',
          border: 'none',
          padding: '14px',
          minHeight: '52px',
        }}
      >
        Looks good — confirm &amp; pay →
      </button>
    </div>
  )
}
