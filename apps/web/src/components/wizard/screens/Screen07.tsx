'use client'

import { useState } from 'react'
import { useWizard } from '@/contexts/WizardContext'

export function Screen07() {
  const { state, setMember, setStep } = useWizard()
  const member = state.members[0]

  const [explanation, setExplanation] = useState(
    member?.manualAnswers?.['explanation'] ?? ''
  )
  const [evidenceLater, setEvidenceLater] = useState(
    member?.manualAnswers?.['evidenceLater'] === 'true'
  )
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([])
  const [error, setError] = useState('')

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    setEvidenceFiles((prev) => [...prev, ...files])
  }

  function removeFile(idx: number) {
    setEvidenceFiles((prev) => prev.filter((_, i) => i !== idx))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const hasExplanation = explanation.trim().length > 0
    const hasEvidence = evidenceFiles.length > 0

    if (!hasExplanation && !hasEvidence && !evidenceLater) {
      setError(
        'Please provide an explanation, attach supporting documents, or check "I will attach evidence later".'
      )
      return
    }

    // Save into manualAnswers for the primary member
    if (member) {
      setMember(member.id, {
        manualAnswers: {
          ...member.manualAnswers,
          explanation: explanation.trim(),
          evidenceLater: String(evidenceLater),
          evidenceFileCount: String(evidenceFiles.length),
        },
      })
    }

    setStep(8)
  }

  return (
    <div className="max-w-lg mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Supporting statement &amp; evidence</h1>
        <p className="mt-2 text-sm text-slate-500">
          Explain why you qualify for re-parole and attach any supporting documents.
          You need at least one of the three options below.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Explanation textarea */}
        <div className="space-y-1">
          <label
            htmlFor="explanation"
            className="text-sm font-semibold text-slate-700"
          >
            Written explanation
            <span className="ml-1 font-normal text-slate-400 text-xs">(optional if you attach documents)</span>
          </label>
          <textarea
            id="explanation"
            rows={5}
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            placeholder="Briefly explain your situation and why you are requesting re-parole. For example: current parole expiration date, ties to Ukraine, humanitarian circumstances."
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
          />
          <p className="text-xs text-slate-400">
            This text will be included in your preparation checklist. Do not include passport numbers,
            I-94 numbers, Social Security numbers, passwords, or financial account numbers.
          </p>
        </div>

        {/* Evidence upload */}
        <div className="space-y-2">
          <p className="text-sm font-semibold text-slate-700">
            Supporting documents
            <span className="ml-1 font-normal text-slate-400 text-xs">(optional if you provide a written explanation)</span>
          </p>
          <p className="text-xs text-slate-500">
            Examples: copy of current I-94, previous parole approval notice, proof of Ukrainian citizenship.
          </p>
          <label
            htmlFor="evidence-upload"
            className="flex cursor-pointer items-center gap-3 rounded-lg border-2 border-dashed border-slate-300 px-4 py-3 text-sm text-slate-500 hover:border-blue-400 hover:text-blue-600 transition-colors"
          >
            <span>+ Attach files (PDF, JPG, PNG)</span>
            <input
              id="evidence-upload"
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png"
              className="sr-only"
              onChange={handleFileChange}
            />
          </label>

          {evidenceFiles.length > 0 && (
            <ul className="space-y-1">
              {evidenceFiles.map((f, idx) => (
                <li
                  key={idx}
                  className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700 border border-slate-200"
                >
                  <span className="truncate max-w-[240px]">{f.name}</span>
                  <button
                    type="button"
                    onClick={() => removeFile(idx)}
                    className="ml-2 text-slate-400 hover:text-red-500 transition-colors"
                    aria-label="Remove file"
                  >
                    &#x2715;
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Evidence later checkbox */}
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={evidenceLater}
            onChange={(e) => setEvidenceLater(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-slate-700">
            I will gather supporting documents and attach them directly to my USCIS submission.
          </span>
        </label>

        {/* Validation error */}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <button
          type="submit"
          className="w-full rounded-xl bg-blue-600 px-6 py-3 text-base font-semibold text-white hover:bg-blue-700 transition-colors"
        >
          Continue &#8594;
        </button>
      </form>
    </div>
  )
}
