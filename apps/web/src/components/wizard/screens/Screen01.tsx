'use client'

const INFO_CARDS = [
  {
    label: 'Current Edition',
    detail: 'Form I-131 edition 01/20/25 — currently accepted. Download at uscis.gov/i-131.',
    type: 'info' as const,
  },
  {
    label: 'Paper filing: Part 2, Item 1.e',
    detail: 'Select Item 1.e and handwrite "Ukraine RE-PAROLE" at the top of the first page.',
    type: 'neutral' as const,
  },
  {
    label: 'Online filing: Box 10.C',
    detail: 'File at my.uscis.gov — select Box 10.C in the online form.',
    type: 'neutral' as const,
  },
  {
    label: 'Filing window',
    detail: 'Submit up to 180 days before your current parole expires. Processing: 8–21 months.',
    type: 'neutral' as const,
  },
]

export function Screen01() {
  return (
    <div className="space-y-4">

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
          Edition 01/20/25
        </span>
        <span
          className="text-[12px] font-semibold px-2.5 py-1 rounded-full"
          style={{ background: 'var(--success-bg)', color: 'var(--success-text)' }}
        >
          Source: USCIS
        </span>
      </div>

      <div>
        <h1 className="text-[22px] font-bold leading-tight mb-2" style={{ color: 'var(--text-1)' }}>
          About Form I-131
        </h1>
        <p className="text-[15px]" style={{ color: 'var(--text-2)' }}>
          Key facts before you start — edition, filing options, and timeline.
        </p>
      </div>

      {INFO_CARDS.map((card) => (
        <div
          key={card.label}
          className="rounded-[12px] p-3.5"
          style={{
            background: card.type === 'info' ? 'var(--info-bg)' : 'var(--surface)',
            border: `1px solid ${card.type === 'info' ? 'var(--info-border)' : 'var(--border)'}`,
          }}
        >
          <p className="text-[14px] font-semibold mb-1" style={{ color: card.type === 'info' ? 'var(--info-text)' : 'var(--text-1)' }}>
            {card.label}
          </p>
          <p className="text-[13px]" style={{ color: card.type === 'info' ? 'var(--info-text)' : 'var(--text-2)' }}>
            {card.detail}
          </p>
        </div>
      ))}

      {/* Fee reminder */}
      <div
        className="rounded-[12px] p-3.5"
        style={{
          background: 'var(--warning-bg)',
          border: '1px solid var(--warning-border)',
        }}
      >
        <p className="text-[13px]" style={{ color: 'var(--warning-text)' }}>
          <strong>USCIS filing fees (paid directly to USCIS, not to us):</strong>
          {' '}Fees vary — verify current amounts at{' '}
          <a
            href="https://www.uscis.gov/feecalculator"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--warning-text)', fontWeight: 600 }}
          >
            Check current fees ↗
          </a>
        </p>
      </div>

      <a
        href="https://www.uscis.gov/i-131"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-[14px] font-semibold no-underline transition-all"
        style={{ color: 'var(--primary)' }}
      >
        Download I-131 from uscis.gov ↗
      </a>
    </div>
  )
}
