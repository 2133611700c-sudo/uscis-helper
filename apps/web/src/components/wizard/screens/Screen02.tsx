'use client'

import { useWizard } from '@/contexts/WizardContext'
import { calcPrice } from '@/contexts/WizardContext'

const PACKAGES = [
  { size: 1, label: 'Just me', sub: '1 packet', highlight: false },
  { size: 2, label: '2 people', save: 'save $5', highlight: false },
  { size: 3, label: '3 people', save: 'save $10', highlight: false },
  { size: 4, label: '4 people · Family Pack', save: 'save $15', highlight: true },
  { size: 5, label: '5 people', save: 'save $20', highlight: false },
  { size: 6, label: '6 people', save: 'save $25', highlight: false },
]

export function Screen02() {
  const { state, setPackageSize, setStep } = useWizard()
  const { packageSize } = state

  function handleMore() {
    setPackageSize(packageSize < 6 ? packageSize + 1 : packageSize + 1)
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[22px] font-bold leading-tight mb-2" style={{ color: 'var(--text-1)' }}>
          Who are you preparing a packet for?
        </h1>
        <p className="text-[15px]" style={{ color: 'var(--text-2)' }}>
          Each person needs a separate I-131 packet — this is a USCIS requirement.
        </p>
      </div>

      {/* Package tiles */}
      <div className="space-y-2">
        {PACKAGES.map((pkg) => {
          const isSelected = packageSize === pkg.size
          return (
            <button
              key={pkg.size}
              type="button"
              onClick={() => setPackageSize(pkg.size)}
              className="w-full flex items-center gap-3 rounded-[12px] text-left transition-all active:scale-[0.99]"
              style={{
                background: isSelected ? 'var(--accent)' : 'var(--surface)',
                border: isSelected
                  ? '2.5px solid var(--primary)'
                  : pkg.highlight
                    ? '1.5px solid var(--primary)'
                    : '1.5px solid var(--border-strong)',
                padding: isSelected ? '13.5px' : '14px',
                minHeight: '64px',
              }}
            >
              {/* Radio */}
              <div
                className="w-[22px] h-[22px] rounded-full flex-shrink-0 flex items-center justify-center"
                style={{
                  border: `2px solid ${isSelected ? 'var(--primary)' : 'var(--border-strong)'}`,
                }}
              >
                {isSelected && (
                  <span
                    className="w-[10px] h-[10px] rounded-full"
                    style={{ background: 'var(--primary)' }}
                  />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold" style={{ color: 'var(--text-1)' }}>
                  {pkg.label}
                </p>
                {pkg.save && (
                  <p className="text-[12px] font-bold mt-0.5" style={{ color: 'var(--success-text)' }}>
                    ✓ {pkg.save}
                  </p>
                )}
                {pkg.sub && (
                  <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-3)' }}>
                    {pkg.sub}
                  </p>
                )}
              </div>

              {/* Price */}
              <span
                className="text-[17px] font-bold flex-shrink-0"
                style={{ color: 'var(--text-1)', fontVariantNumeric: 'tabular-nums' }}
              >
                ${calcPrice(pkg.size)}
              </span>
            </button>
          )
        })}

        {/* 7+ option */}
        {packageSize > 6 && (
          <div
            className="rounded-[12px] p-3.5 flex items-center justify-between"
            style={{ background: 'var(--accent)', border: '2.5px solid var(--primary)' }}
          >
            <div>
              <p className="text-[14px] font-semibold" style={{ color: 'var(--text-1)' }}>
                {packageSize} people
              </p>
              <p className="text-[12px] font-bold" style={{ color: 'var(--success-text)' }}>
                ✓ save ${(packageSize - 1) * 5}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setPackageSize(packageSize - 1)}
                className="w-[32px] h-[32px] rounded-full text-[18px] font-bold flex items-center justify-center"
                style={{ background: 'var(--surface)', border: '1px solid var(--border-strong)', color: 'var(--text-1)' }}
              >
                −
              </button>
              <span className="text-[17px] font-bold" style={{ color: 'var(--text-1)', fontVariantNumeric: 'tabular-nums' }}>
                ${calcPrice(packageSize)}
              </span>
              <button
                type="button"
                onClick={handleMore}
                className="w-[32px] h-[32px] rounded-full text-[18px] font-bold flex items-center justify-center"
                style={{ background: 'var(--surface)', border: '1px solid var(--border-strong)', color: 'var(--text-1)' }}
              >
                +
              </button>
            </div>
          </div>
        )}

        {/* Add more than 6 */}
        {packageSize <= 6 && (
          <button
            type="button"
            onClick={handleMore}
            className="w-full rounded-[12px] text-[13px] font-medium py-3 transition-all"
            style={{
              background: 'var(--surface-2)',
              border: '1px dashed var(--border-strong)',
              color: 'var(--text-3)',
            }}
          >
            + More than 6 people
          </button>
        )}
      </div>

      {/* Help chip */}
      <button
        type="button"
        className="inline-flex items-center gap-1.5 rounded-full text-[12px] font-medium px-2.5 py-1.5 transition-all"
        style={{
          background: 'var(--info-bg)',
          border: '1px solid var(--info-border)',
          color: 'var(--info-text)',
        }}
      >
        <span className="font-bold">?</span>
        Why does each person need a separate packet?
      </button>
    </div>
  )
}
