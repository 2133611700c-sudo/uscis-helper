'use client'

import { useWizard } from '@/contexts/WizardContext'

export function Screen03() {
  const { state, setPackageSize, setMember, setStep } = useWizard()
  const { members, packageSize } = state

  function handleAliasChange(id: string, value: string) {
    setMember(id, { alias: value })
  }

  function handleAddPerson() {
    if (packageSize < 6) {
      setPackageSize(packageSize + 1)
    }
  }

  return (
    <div className="max-w-lg mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Your family members</h1>
        <p className="mt-2 text-sm text-slate-500">
          Give each person a nickname to tell them apart. Real names are not required here.
        </p>
      </div>

      <ul className="space-y-3">
        {members.map((member, i) => (
          <li
            key={member.id}
            className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
              {i + 1}
            </span>
            <input
              type="text"
              value={member.alias}
              onChange={(e) => handleAliasChange(member.id, e.target.value)}
              placeholder={`Person ${i + 1}`}
              aria-label={`Alias for person ${i + 1}`}
              className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </li>
        ))}
      </ul>

      {packageSize < 6 ? (
        <button
          type="button"
          onClick={handleAddPerson}
          className="w-full rounded-xl border-2 border-dashed border-slate-300 py-3 text-sm font-medium text-slate-500 hover:border-blue-400 hover:text-blue-600 transition-colors"
        >
          + Add another person
        </button>
      ) : (
        <p className="text-sm text-slate-500 text-center">
          Need more than 6 people?{' '}
          <a href="/contact" className="text-blue-600 underline hover:no-underline">
            Contact us
          </a>{' '}
          for larger groups.
        </p>
      )}

      <button
        type="button"
        onClick={() => setStep(4)}
        className="w-full rounded-xl bg-blue-600 px-6 py-3 text-base font-semibold text-white hover:bg-blue-700 transition-colors"
      >
        Continue →
      </button>
    </div>
  )
}
