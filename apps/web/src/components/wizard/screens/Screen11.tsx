'use client'

import { useState } from 'react'
import { useWizard } from '@/contexts/WizardContext'

const CHECKLIST_MAIL = [
  'Print all pages of I-131 (sign in ink — do not use digital signature)',
  'Write "Ukraine RE-PAROLE" at the top of the form in pen',
  'Attach 2 passport-style photos per applicant (2"×2")',
  'Include copy of previous parole document (I-94 or approval notice)',
  'Include copy of current I-94 (download at i94.cbp.dhs.gov)',
  'Check current mailing address at uscis.gov/i-131-addresses',
  'USCIS filing fee — check current amount at uscis.gov/feecalculator',
]

const CHECKLIST_ONLINE = [
  'Create or log in to your myUSCIS account at my.uscis.gov',
  'Write "Ukraine RE-PAROLE" in the additional information field',
  'Upload scanned copies of all supporting documents',
  'Include copy of current I-94 (download at i94.cbp.dhs.gov)',
  'USCIS filing fee — check current amount at uscis.gov/feecalculator before paying',
  'Pay USCIS fee online through the myUSCIS portal',
]

const CHECKLIST_UNSURE = [
  'Review both filing options at uscis.gov/i-131',
  'Write "Ukraine RE-PAROLE" at top of form (or in additional info field)',
  'Gather: I-94, previous parole approval, proof of Ukrainian citizenship',
  'Check USCIS filing fee at uscis.gov/feecalculator',
  'For mail: check address at uscis.gov/i-131-addresses',
  'For online: create a myUSCIS account at my.uscis.gov',
]

export function Screen11() {
  const { state, setDownloadUrl, setStep } = useWizard()
  const { sessionId, filingMethod, downloadUrl } = state
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const checklist =
    filingMethod === 'online'
      ? CHECKLIST_ONLINE
      : filingMethod === 'mail'
        ? CHECKLIST_MAIL
        : CHECKLIST_UNSURE

  async function handleDownload() {
    setError('')

    if (downloadUrl && !downloadUrl.startsWith('mock://')) {
      window.open(downloadUrl, '_blank', 'noopener,noreferrer')
      return
    }

    if (!sessionId) {
      setError('Session not found. Please refresh and try again.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/packet/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId }),
      })
      const data = await res.json() as { ok?: boolean; signed_url?: string; error?: string }
      if (data.ok && data.signed_url) {
        setDownloadUrl(data.signed_url)
        window.open(data.signed_url, '_blank', 'noopener,noreferrer')
      } else {
        setError(data.error ?? 'Packet generation failed. Please try again.')
      }
    } catch {
      setError('Network error. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Success header */}
      <div className="text-center py-4">
        <div
          className="w-[64px] h-[64px] rounded-full flex items-center justify-center text-[32px] mx-auto mb-3"
          style={{ background: 'var(--success-bg)' }}
        >
          ✓
        </div>
        <h1 className="text-[22px] font-bold mb-1" style={{ color: 'var(--text-1)' }}>
          Packet ready
        </h1>
        <p className="text-[15px]" style={{ color: 'var(--text-2)' }}>
          Download now or get a link to your email.
        </p>
      </div>

      {error && (
        <div
          className="rounded-[12px] p-3.5"
          style={{ background: 'var(--error-bg)', border: '1px solid var(--error-border)' }}
        >
          <p className="text-[13px]" style={{ color: 'var(--error-text)' }}>{error}</p>
        </div>
      )}

      {/* Download button */}
      <button
        type="button"
        onClick={handleDownload}
        disabled={loading}
        className="w-full rounded-[10px] text-[16px] font-bold transition-all active:scale-[0.98]"
        style={{
          background: 'var(--success)',
          color: '#fff',
          border: 'none',
          padding: '16px',
          minHeight: '56px',
          opacity: loading ? 0.7 : 1,
          cursor: loading ? 'not-allowed' : 'pointer',
        }}
      >
        {loading ? 'Preparing your packet…' : '📦 Download packet to phone'}
      </button>

      {/* What to do next */}
      <div
        className="rounded-[12px] p-3.5"
        style={{ background: 'var(--info-bg)', border: '1px solid var(--info-border)' }}
      >
        <p className="text-[13px] font-semibold mb-2" style={{ color: 'var(--info-text)' }}>
          💡 What to do with your packet
        </p>
        <p className="text-[13px] leading-relaxed" style={{ color: 'var(--info-text)' }}>
          Open the files from the packet and copy the data into the USCIS form. Use the
          "Data Transfer to USCIS" mode — it shows each field one by one.
        </p>
      </div>

      {/* Filing checklist */}
      <div>
        <p
          className="text-[11px] font-semibold uppercase tracking-wide mb-2"
          style={{ color: 'var(--text-3)', letterSpacing: '0.6px' }}
        >
          📌 Before you file{filingMethod === 'online' ? ' (online)' : filingMethod === 'mail' ? ' (by mail)' : ''}:
        </p>
        <div
          className="rounded-[12px] overflow-hidden"
          style={{ border: '1px solid var(--border)' }}
        >
          {checklist.map((item, idx) => (
            <div
              key={item}
              className="flex items-start gap-2.5 px-3.5 py-3 text-[13px]"
              style={{
                borderBottom: idx < checklist.length - 1 ? '1px solid var(--border)' : undefined,
                color: 'var(--text-1)',
              }}
            >
              <span className="flex-shrink-0 mt-0.5" style={{ color: 'var(--text-3)' }}>□</span>
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* USCIS fees reminder */}
      <div
        className="rounded-[12px] p-3.5"
        style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
      >
        <p className="text-[12px] font-semibold mb-1" style={{ color: 'var(--text-1)' }}>
          📌 USCIS fees (for your reference)
        </p>
        <p className="text-[12px]" style={{ color: 'var(--text-2)' }}>
          This information is for your reference only. Fees are paid directly to USCIS — not to us.
        </p>
        <div className="mt-2 text-[12px] space-y-1" style={{ color: 'var(--text-2)' }}>
          <p>· I-131 filing fee — verify at uscis.gov/feecalculator</p>
          <p>· Parole grant fee (if approved) — verify at uscis.gov/feecalculator</p>
        </div>
        <a
          href="https://www.uscis.gov/feecalculator"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block mt-2 text-[12px] font-semibold"
          style={{ color: 'var(--primary)' }}
        >
          Check current fees on USCIS Fee Calculator ↗
        </a>
      </div>

      {/* Open USCIS */}
      <a
        href="https://my.uscis.gov"
        target="_blank"
        rel="noopener noreferrer"
        className="block w-full text-center rounded-[10px] text-[15px] font-bold no-underline transition-all active:scale-[0.98]"
        style={{
          background: 'var(--primary)',
          color: '#fff',
          padding: '14px',
          minHeight: '52px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        Open my.uscis.gov ↗
      </a>

      <button
        type="button"
        onClick={() => setStep(12)}
        className="w-full rounded-[10px] text-[14px] font-medium transition-all"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border-strong)',
          color: 'var(--text-2)',
          padding: '12px',
          minHeight: '44px',
        }}
      >
        📧 Also send to email →
      </button>
    </div>
  )
}
