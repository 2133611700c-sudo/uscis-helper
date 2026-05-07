'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { TranslationWizard } from './TranslationWizard'
import { ErrorBoundary } from '@/components/ErrorBoundary'

const WizardFallback = (
  <div
    style={{
      minHeight: '60vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '1rem',
      color: 'var(--text-2, #64748b)',
    }}
  >
    <p style={{ fontWeight: 600 }}>⚠️ The wizard failed to load.</p>
    <button
      onClick={() => window.location.reload()}
      style={{
        padding: '0.5rem 1.25rem',
        background: 'var(--accent, #3b82f6)',
        color: '#fff',
        border: 'none',
        borderRadius: '0.5rem',
        cursor: 'pointer',
        fontWeight: 600,
      }}
    >
      Reload page
    </button>
  </div>
)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function TranslationServiceExperience(_props: any) {
  const params = useParams()
  const locale = (params?.locale as string) ?? 'en'

  const [returnUrl, setReturnUrl] = useState<string | null>(null)
  const [fromSource, setFromSource] = useState<string | null>(null)

  // Read ?from= and ?return= params client-side (SSR-safe)
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search)
    const from = sp.get('from')
    const ret = sp.get('return')
    if (from) setFromSource(from)
    if (ret) setReturnUrl(ret)
  }, [])

  return (
    <ErrorBoundary label="TranslationWizard" fallback={WizardFallback}>
      <TranslationWizard
        locale={locale}
        returnUrl={returnUrl}
        fromSource={fromSource}
      />
    </ErrorBoundary>
  )
}
