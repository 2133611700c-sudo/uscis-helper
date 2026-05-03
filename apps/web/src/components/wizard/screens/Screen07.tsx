'use client'

import { useState } from 'react'
import { useWizard } from '@/contexts/WizardContext'

export function Screen07() {
  const { setStep } = useWizard()

  const [address, setAddress] = useState({ street: '', city: '', state: '', zip: '' })
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [prevFiled, setPrevFiled] = useState<'yes' | 'no' | null>(null)
  const [removalProceedings, setRemovalProceedings] = useState<'yes' | 'no' | null>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStep(8)
  }

  return (
    <div className="max-w-lg mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Additional information</h1>
        <p className="mt-2 text-sm text-slate-500">
          This information will be used in your application packet.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Address */}
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold text-slate-700">Current US address</legend>
          <input
            type="text"
            placeholder="Street address"
            value={address.street}
            onChange={(e) => setAddress((a) => ({ ...a, street: e.target.value }))}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="grid grid-cols-3 gap-2">
            <input
              type="text"
              placeholder="City"
              value={address.city}
              onChange={(e) => setAddress((a) => ({ ...a, city: e.target.value }))}
              className="col-span-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="text"
              placeholder="State"
              value={address.state}
              maxLength={2}
              onChange={(e) => setAddress((a) => ({ ...a, state: e.target.value.toUpperCase() }))}
              className="col-span-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="text"
              placeholder="ZIP"
              value={address.zip}
              onChange={(e) => setAddress((a) => ({ ...a, zip: e.target.value }))}
              className="col-span-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </fieldset>

        {/* Phone */}
        <div className="flex flex-col gap-1">
          <label htmlFor="phone" className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
            Phone number
          </label>
          <input
            id="phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+1 (555) 000-0000"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Email */}
        <div className="flex flex-col gap-1">
          <label htmlFor="email" className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
            Email (for packet delivery)
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Previously filed */}
        <div className="space-y-2">
          <p className="text-sm font-semibold text-slate-700">
            Have you previously filed for re-parole?
          </p>
          <div className="flex gap-3">
            {(['yes', 'no'] as const).map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => setPrevFiled(val)}
                className={[
                  'flex-1 rounded-lg border-2 py-2 text-sm font-medium capitalize transition-colors',
                  prevFiled === val
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-slate-200 text-slate-600 hover:border-slate-300',
                ].join(' ')}
              >
                {val}
              </button>
            ))}
          </div>
        </div>

        {/* Removal proceedings */}
        <div className="space-y-2">
          <p className="text-sm font-semibold text-slate-700">
            Are you currently in removal proceedings?
          </p>
          <div className="flex gap-3">
            {(['yes', 'no'] as const).map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => setRemovalProceedings(val)}
                className={[
                  'flex-1 rounded-lg border-2 py-2 text-sm font-medium capitalize transition-colors',
                  removalProceedings === val
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-slate-200 text-slate-600 hover:border-slate-300',
                ].join(' ')}
              >
                {val}
              </button>
            ))}
          </div>
          {removalProceedings === 'yes' && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3">
              <p className="text-sm text-red-800 font-medium">
                Please consult an immigration attorney before filing.
              </p>
            </div>
          )}
        </div>

        <button
          type="submit"
          className="w-full rounded-xl bg-blue-600 px-6 py-3 text-base font-semibold text-white hover:bg-blue-700 transition-colors"
        >
          Continue →
        </button>
      </form>
    </div>
  )
}
