'use client'

import { useWizard } from '@/contexts/WizardContext'

export function Screen03() {
  const { state, setPackageSize, setMember } = useWizard()
  const { members, packageSize } = state

  function handleAliasChange(id: string, value: string) {
    setMember(id, { alias: value })
  }

  function handleAddPerson() {
    setPackageSize(packageSize + 1)
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[22px] font-bold leading-tight mb-2" style={{ color: 'var(--text-1)' }}>
          Family members
        </h1>
        <p className="text-[15px]" style={{ color: 'var(--text-2)' }}>
          Give each person a nickname to tell them apart. Real names are not stored.
        </p>
      </div>

      <div className="space-y-2.5">
        {members.map((member, i) => (
          <div
            key={member.id}
            className="rounded-[12px] p-3"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[14px] font-semibold" style={{ color: 'var(--text-1)' }}>
                {i === 0 ? 'Me — Main applicant' : `Member ${i + 1}`}
              </span>
              <span className="text-[12px]" style={{ color: 'var(--text-3)' }}>
                Packet {i + 1}
              </span>
            </div>
            <input
              type="text"
              value={member.alias}
              onChange={(e) => handleAliasChange(member.id, e.target.value)}
              placeholder={i === 0 ? 'e.g. "Me" or nickname' : `Person ${i + 1} nickname`}
              aria-label={`Alias for person ${i + 1}`}
              className="w-full rounded-[8px] text-[16px] transition-all"
              style={{
                background: 'var(--surface-2)',
                color: 'var(--text-1)',
                border: '1px solid var(--border)',
                padding: '11px 12px',
                minHeight: '44px',
                outline: 'none',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--primary)'
                e.currentTarget.style.background = 'var(--surface)'
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)'
                e.currentTarget.style.background = 'var(--surface-2)'
              }}
            />
          </div>
        ))}
      </div>

      {packageSize < 10 ? (
        <button
          type="button"
          onClick={handleAddPerson}
          className="w-full rounded-[12px] py-3 text-[14px] font-medium transition-all"
          style={{
            background: 'var(--surface-2)',
            border: '1.5px dashed var(--border-strong)',
            color: 'var(--text-3)',
          }}
        >
          + Add another person
        </button>
      ) : (
        <p className="text-[13px] text-center" style={{ color: 'var(--text-3)' }}>
          For groups larger than 10, please contact us.
        </p>
      )}

      {/* Info note */}
      <div
        className="rounded-[12px] p-3.5 text-[13px] leading-relaxed"
        style={{ background: 'var(--surface-2)', color: 'var(--text-2)', border: '1px solid var(--border)' }}
      >
        📧 Want to save your progress and continue later?{' '}
        <span style={{ color: 'var(--primary)', fontWeight: 600 }}>
          Enter your email on the next screen.
        </span>
      </div>
    </div>
  )
}
