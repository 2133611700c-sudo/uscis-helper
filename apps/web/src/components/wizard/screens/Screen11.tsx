'use client'

import { useState } from 'react'
import { useWizard } from '@/contexts/WizardContext'

const CHECKLIST_MAIL = [
  'Print all pages of I-131 (sign in ink — do not use digital signature)',
  'Write "Ukraine RE-PAROLE" at the top of the form in pen',
  'Attach 2 passport-style photos per applicant (2"x2")',
  'Include copy of previous parole document (I-94 or approval notice)',
  'Include copy of current I-94 (download at i94.cbp.dhs.gov)',
  'Check current mailing address at uscis.gov/i-131-addresses before sending',
  'USCIS filing fee — check current amount at uscis.gov/feecalculator',
]

const CHECKLIST_ONLINE = [
  'Create or log in to your myUSCIS account at my.uscis.gov',
  'Write "Ukraine RE-PAROLE" in the field for additional information',
  'Upload scanned copies of all supporting documents',
  'Include copy of current I-94 (download at i94.cbp.dhs.gov)',
  'USCIS filing fee — check current amount at uscis.gov/feecalculator',
  'Pay USCIS fee online through the myUSCIS portal',
]

const CHECKLIST_UNSURE = [
  'Review both filing options at uscis.gov/i-131',
  'Write "Ukraine RE-PAROLE" at the top of the form (or in additional info field)',
  'Gather supporting documents: I-94, previous parole approval, proof of Ukrainian citizenship',
  'Check USCIS filing fee at uscis.gov/feecalculator',
  'For mail: check current address at uscis.gov/i-131-addresses',
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

    // If we already have a signed URL, open it directly
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
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Your packet is ready!</h1>
        <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-700">
          &#x2705; Payment received
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <button
        type="button"
        onClick={handleDownload}
        disabled={loading}
        className={[
          'w-full rounded-xl px-6 py-4 text-base font-semibold text-white transition-all',
          loading ? 'bg-green-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700',
        ].join(' ')}
      >
        {loading ? 'Preparing your packet…' : downloadUrl && !downloadUrl.startsWith('mock://') ? 'Open packet (ZIP)' : 'Download ZIP packet'}
      </button>

      {/* Filing-aware checklist */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
        <p className="text-sm font-semibold text-slate-700 mb-3">
          Before you file
          {filingMethod === 'online' ? ' (online)' : filingMethod === 'mail' ? ' (by mail)' : ''}
          :
        </p>
        <ul className="space-y-2">
          {checklist.map((item) => (
            <li key={item} className="flex items-start gap-2 text-sm text-slate-600">
              <span className="mt-0.5 shrink-0">&#9744;</span>
              {item}
            </li>
          ))}
        </ul>
      </div>

      {/* USCIS fee reminder — no hardcoded amounts */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm font-semibold text-amber-900 mb-1">USCIS filing fee</p>
        <p className="text-xs text-amber-800">
          The USCIS filing fee for I-131 is paid directly to USCIS and is separate from this service fee.
          Check the current fee at{' '}
          <a
            href="https://www.uscis.gov/feecalculator"
            target="_blank"
            rel="noopener noreferrer"
            className="underline font-medium"
          >
            uscis.gov/feecalculator
          </a>
          .
        </p>
      </div>

      <button
        type="button"
        onClick={() => setStep(12)}
        className="w-full rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
      >
        Also send to my email &#8594;
      </button>
    </div>
  )
}
