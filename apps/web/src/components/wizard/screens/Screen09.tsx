'use client'

import { useWizard } from '@/contexts/WizardContext'

export function Screen09() {
  const { state, setStep } = useWizard()
  const { members, filingMethod, packageSize, packagePrice } = state

  return (
    <div className="max-w-lg mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Preview your application packet</h1>
        <p className="mt-2 text-sm text-slate-500">
          Review everything before proceeding to payment.
        </p>
      </div>

      {/* Summary cards */}
      <div className="space-y-3">
        {members.map((member, i) => (
          <div
            key={member.id}
            className="rounded-xl border border-slate-200 bg-slate-50 p-4"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  {member.alias || `Person ${i + 1}`}
                </p>
                {member.fields['dob'] && (
                  <p className="text-xs text-slate-500 mt-0.5">DOB: {member.fields['dob']}</p>
                )}
                {member.fields['lastName'] && (
                  <p className="text-xs text-slate-500">
                    {member.fields['firstName']} {member.fields['lastName']}
                  </p>
                )}
              </div>
              <span className="text-xs text-slate-400 capitalize">
                {filingMethod ?? 'method not set'}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Summary line */}
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
        <p className="text-sm font-semibold text-blue-900">
          {packageSize} applicant{packageSize !== 1 ? 's' : ''} · ${packagePrice} service fee ·{' '}
          {filingMethod === 'mail' ? 'Mail filing' : filingMethod === 'online' ? 'Online filing' : 'Filing method not selected'}
        </p>
      </div>

      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setStep(10)}
          className="w-full rounded-xl bg-blue-600 px-6 py-3 text-base font-semibold text-white hover:bg-blue-700 transition-colors"
        >
          Looks good — proceed to payment →
        </button>
        <button
          type="button"
          onClick={() => setStep(7)}
          className="w-full rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
        >
          ← Go back and edit
        </button>
      </div>
    </div>
  )
}
