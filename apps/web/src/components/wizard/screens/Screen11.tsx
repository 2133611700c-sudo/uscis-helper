'use client'

import { useWizard } from '@/contexts/WizardContext'

const CHECKLIST = [
  'Print all pages of I-131 (sign in ink)',
  'Attach 2 passport photos per applicant',
  'Include copy of previous parole document',
  'Include copy of I-94',
  'Mail to USCIS (check current address at uscis.gov)',
]

export function Screen11() {
  const { setDownloadUrl, setStep } = useWizard()

  function handleDownload() {
    // Mock: create a small text blob and trigger download
    const content = 'Re-Parole U4U Application Packet\n(Mock packet — Stage 2)'
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'reParolePacket.zip'
    a.click()
    URL.revokeObjectURL(url)
    setDownloadUrl('mock://packet.zip')
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Your packet is ready!</h1>
        <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-700">
          ✅ Payment received
        </div>
      </div>

      <button
        type="button"
        onClick={handleDownload}
        className="w-full rounded-xl bg-green-600 px-6 py-4 text-base font-semibold text-white hover:bg-green-700 transition-colors"
      >
        Download ZIP packet
      </button>

      {/* Checklist */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
        <p className="text-sm font-semibold text-slate-700 mb-3">Before you file:</p>
        <ul className="space-y-2">
          {CHECKLIST.map((item) => (
            <li key={item} className="flex items-start gap-2 text-sm text-slate-600">
              <span className="mt-0.5 shrink-0">☐</span>
              {item}
            </li>
          ))}
        </ul>
      </div>

      <button
        type="button"
        onClick={() => setStep(12)}
        className="w-full rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
      >
        Transfer to email →
      </button>
    </div>
  )
}
