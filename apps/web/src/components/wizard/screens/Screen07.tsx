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
      setError('Please provide an explanation, attach documents, or check "I\'ll attach evidence later".')
      return
    }

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
    <div className="space-y-4">
      <div>
        <h1 className="text-[22px] font-bold leading-tight mb-2" style={{ color: 'var(--text-1)' }}>
          Supporting statement &amp; evidence
        </h1>
        <p className="text-[15px]" style={{ color: 'var(--text-2)' }}>
          Explain why you qualify for re-parole. You need at least one of the three options below.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Explanation */}
        <div>
          <label
            htmlFor="explanation"
            className="block text-[13px] font-semibold mb-1.5"
            style={{ color: 'var(--text-1)' }}
          >
            Written explanation
            <span className="ml-1.5 font-normal text-[12px]" style={{ color: 'var(--text-3)' }}>
              (optional if you attach documents)
            </span>
          </label>
          <textarea
            id="explanation"
            rows={5}
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            placeholder="Briefly explain your situation and why you are requesting re-parole. For example: current parole expiration date, ties to Ukraine, humanitarian circumstances."
            className="w-full rounded-[8px] text-[16px] resize-y"
            style={{
              background: 'var(--surface-2)',
              color: 'var(--text-1)',
              border: '1px solid var(--border)',
              padding: '11px 12px',
              minHeight: '100px',
              outline: 'none',
              fontFamily: 'inherit',
            }}
          />
          <p className="text-[11px] mt-1" style={{ color: 'var(--text-3)' }}>
            Do not include passport numbers, I-94 numbers, SSN, passwords, or financial account numbers.
          </p>
        </div>

        {/* Evidence upload */}
        <div>
          <p className="text-[13px] font-semibold mb-1" style={{ color: 'var(--text-1)' }}>
            Supporting documents
            <span className="ml-1.5 font-normal text-[12px]" style={{ color: 'var(--text-3)' }}>
              (optional if you provide a written explanation)
            </span>
          </p>
          <p className="text-[12px] mb-2" style={{ color: 'var(--text-3)' }}>
            Examples: current I-94, previous parole approval notice, proof of Ukrainian citizenship.
          </p>
          <label
            htmlFor="evidence-upload"
            className="flex cursor-pointer items-center gap-3 rounded-[12px] text-[14px] font-medium transition-all"
            style={{
              border: '1.5px dashed var(--border-strong)',
              color: 'var(--text-3)',
              padding: '14px',
              minHeight: '52px',
            }}
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
            <ul className="space-y-1.5 mt-2">
              {evidenceFiles.map((f, idx) => (
                <li
                  key={idx}
                  className="flex items-center justify-between rounded-[8px] px-3 py-2 text-[13px]"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
                >
                  <span className="truncate max-w-[240px]">{f.name}</span>
                  <button
                    type="button"
                    onClick={() => removeFile(idx)}
                    className="ml-2 transition-colors"
                    style={{ color: 'var(--text-3)' }}
                    aria-label="Remove file"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Evidence later */}
        <label
          className="flex items-start gap-3 cursor-pointer rounded-[12px] p-3.5 transition-all"
          style={{
            background: evidenceLater ? 'var(--info-bg)' : 'var(--surface)',
            border: `1px solid ${evidenceLater ? 'var(--info-border)' : 'var(--border)'}`,
          }}
        >
          <div
            className="w-[22px] h-[22px] rounded-[5px] flex-shrink-0 flex items-center justify-center mt-0.5"
            style={{
              border: `2px solid ${evidenceLater ? 'var(--primary)' : 'var(--border-strong)'}`,
              background: evidenceLater ? 'var(--primary)' : 'var(--surface)',
            }}
          >
            {evidenceLater && <span className="text-white font-bold text-[14px]">✓</span>}
          </div>
          <input
            type="checkbox"
            checked={evidenceLater}
            onChange={(e) => setEvidenceLater(e.target.checked)}
            className="sr-only"
          />
          <span className="text-[13px]" style={{ color: 'var(--text-1)' }}>
            I will gather supporting documents and attach them directly to my USCIS submission.
          </span>
        </label>

        {error && (
          <div
            className="rounded-[12px] p-3.5"
            style={{ background: 'var(--error-bg)', border: '1px solid var(--error-border)' }}
          >
            <p className="text-[13px]" style={{ color: 'var(--error-text)' }}>{error}</p>
          </div>
        )}

        <button
          type="submit"
          className="w-full rounded-[10px] text-[15px] font-bold transition-all active:scale-[0.98]"
          style={{
            background: 'var(--btn-action)',
            color: 'var(--btn-action-text)',
            border: 'none',
            padding: '14px',
            minHeight: '52px',
          }}
        >
          Continue →
        </button>
      </form>
    </div>
  )
}
