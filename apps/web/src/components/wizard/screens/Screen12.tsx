'use client'

import { useState } from 'react'
import { useWizard } from '@/contexts/WizardContext'

export function Screen12() {
  const { setTransferEmail, setStep } = useWizard()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)

  function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!email) return
    setTransferEmail(email)
    setSent(true)
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Get your packet by email</h1>
        <p className="mt-2 text-sm text-slate-500">
          Enter your email address and we will send the packet when the feature is available.
        </p>
      </div>

      {sent ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-green-200 bg-green-50 p-5 text-center">
            <p className="text-2xl mb-2">All done! ✅</p>
            <p className="text-sm text-green-800">
              Email will be sent to <strong>{email}</strong> when configured.
            </p>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSend} className="space-y-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="transfer-email" className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
              Email address
            </label>
            <input
              id="transfer-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-xl bg-blue-600 px-6 py-3 text-base font-semibold text-white hover:bg-blue-700 transition-colors"
          >
            Send to my email →
          </button>

          <p className="text-xs text-center text-slate-400">
            Email will be sent when configured.
          </p>

          <button
            type="button"
            onClick={() => setStep(11)}
            className="w-full rounded-xl border border-slate-300 bg-white px-6 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            I&apos;ll download it myself
          </button>
        </form>
      )}
    </div>
  )
}
