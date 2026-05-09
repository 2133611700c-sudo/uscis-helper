'use client'

/**
 * EvidenceReviewPage — full client component
 *
 * Loads review state from /api/translation/[sessionId]/review-state
 * and renders the complete review workflow.
 *
 * Sections (in order):
 *   1. ReviewProgress  — how many fields confirmed, can-certify indicator
 *   2. EvidenceFieldCards — one card per extracted field
 *   3. CertificationForm — signer details + typed signature
 *   4. PaymentGateStatus — payment confirmation status
 *   5. FinalDownloadPanel — render + download PDF button
 */

import { useState, useEffect, useCallback } from 'react'

// ── Types ────────────────────────────────────────────────────────────────────

interface ReviewField {
  id: string
  field: string
  source_label: string | null
  source_zone: string | null
  raw_value: string | null
  normalized_value: string | null
  language_layer: string
  confidence: number
  review_required: boolean
  confirmed: boolean
  confirmed_at: string | null
  // Phase 1 evidence provenance — null for pre-Phase-1 rows
  evidence_type: 'full_image' | 'zone_fallback' | null
  bbox_status: 'exact' | 'approximate' | 'missing' | null
  is_critical: boolean
}

interface ReviewGates {
  can_certify: boolean
  can_render: boolean
  unconfirmed_critical: string[]
  missing_critical: string[]
}

interface ReviewProgress {
  total: number
  confirmed: number
  critical_total: number
  critical_confirmed: number
  percent: number
}

interface CertificationRecord {
  signer_full_name: string
  signer_address?: string
  signer_phone?: string
  signer_email?: string
  signature_typed_name: string
  certification_version: string
  signed_at: string
}

interface ReviewState {
  session: {
    session_id: string
    status: string
    doc_type: string
    scope_title: string
    payment_confirmed: boolean
  }
  fields: ReviewField[]
  document_image_url: string | null
  certification_record: CertificationRecord | null
  review_progress: ReviewProgress
  gates: ReviewGates
}

// ── Field label humaniser ────────────────────────────────────────────────────

const FIELD_LABELS: Record<string, string> = {
  surname: 'Last Name',
  given_names: 'First and Middle Names',
  date_of_birth: 'Date of Birth',
  place_of_birth: 'Place of Birth',
  series: 'Passport Series',
  number: 'Passport Number',
  issued_by: 'Issued By (Authority)',
  date_of_issue: 'Date of Issue',
  date_of_expiry: 'Date of Expiry',
  nationality: 'Nationality',
  sex: 'Sex / Gender',
  record_number: 'Record Number',
  tax_number: 'Tax ID Number',
  full_name: 'Full Name',
  father_name: 'Father\'s Name',
  mother_name: 'Mother\'s Name',
  registration_number: 'Registration Number',
  issue_date: 'Issue Date',
  issuing_authority: 'Issuing Authority',
}

function humanField(field: string): string {
  return FIELD_LABELS[field] ?? field.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

// ── Colour tokens ────────────────────────────────────────────────────────────

const C = {
  blue:    '#2563eb',
  green:   '#16a34a',
  amber:   '#d97706',
  red:     '#dc2626',
  gray:    '#6b7280',
  bgCard:  '#ffffff',
  bgPage:  '#f9fafb',
  border:  '#e5e7eb',
  text1:   '#111827',
  text2:   '#374151',
  text3:   '#6b7280',
}

// ── Confidence label helpers ─────────────────────────────────────────────────

/**
 * Plain-language confidence label shown to the translator on each field card.
 * Mirrors USCIS-safe language — no "high accuracy" claims.
 */
function confidenceLabel(conf: number): { text: string; color: string; bg: string } {
  if (conf >= 0.85) return { text: 'Looks clear',          color: '#15803d', bg: '#dcfce7' }
  if (conf >= 0.70) return { text: 'Please check carefully', color: '#92400e', bg: '#fef3c7' }
  return               { text: 'Needs review',            color: '#991b1b', bg: '#fee2e2' }
}

/**
 * Small badge showing OCR evidence provenance.
 * Only shown when evidence_type is known (Phase-1 extractions only).
 */
function EvidenceBadge({
  evidenceType,
  bboxStatus,
}: {
  evidenceType: ReviewField['evidence_type']
  bboxStatus: ReviewField['bbox_status']
}) {
  if (!evidenceType) return null
  const isVision = evidenceType === 'full_image'
  const bboxLabel =
    bboxStatus === 'exact'       ? '📍 exact position' :
    bboxStatus === 'approximate' ? '📍 approx position' :
                                   '📍 no position'

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      fontSize: '11px',
      fontWeight: 600,
      color: isVision ? '#1d4ed8' : '#6b7280',
      background: isVision ? '#eff6ff' : '#f3f4f6',
      border: `1px solid ${isVision ? '#bfdbfe' : '#e5e7eb'}`,
      padding: '2px 7px',
      borderRadius: '20px',
    }}>
      {isVision ? '🔍 Vision scan' : '📝 OCR text'} · {bboxLabel}
    </span>
  )
}

// ── Sub-components ───────────────────────────────────────────────────────────

/** Progress bar at top of page */
function ReviewProgress({ progress, gates }: { progress: ReviewProgress; gates: ReviewGates }) {
  const pct = progress.percent
  return (
    <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: '16px', padding: '20px 24px', marginBottom: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <span style={{ fontSize: '18px', fontWeight: 700, color: C.text1 }}>
          Review progress
        </span>
        <span style={{ fontSize: '18px', fontWeight: 700, color: pct === 100 ? C.green : C.amber }}>
          {progress.confirmed} / {progress.total} confirmed
        </span>
      </div>

      {/* Progress bar */}
      <div style={{ height: '12px', background: '#e5e7eb', borderRadius: '6px', overflow: 'hidden', marginBottom: '12px' }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: pct === 100 ? C.green : C.blue,
          borderRadius: '6px',
          transition: 'width 0.4s ease',
        }} />
      </div>

      {/* Critical fields status */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '10px 14px',
        borderRadius: '10px',
        background: gates.can_certify ? '#f0fdf4' : '#fefce8',
        border: `1px solid ${gates.can_certify ? '#86efac' : '#fde68a'}`,
      }}>
        <span style={{ fontSize: '20px' }}>{gates.can_certify ? '✅' : '⏳'}</span>
        <div>
          <p style={{ fontSize: '16px', fontWeight: 600, color: gates.can_certify ? C.green : C.amber, margin: 0 }}>
            {gates.can_certify
              ? 'All required fields confirmed — ready to sign'
              : `${progress.critical_confirmed} of ${progress.critical_total} required fields confirmed`}
          </p>
          {!gates.can_certify && gates.unconfirmed_critical.length > 0 && (
            <p style={{ fontSize: '14px', color: C.amber, margin: '2px 0 0' }}>
              Still needed: {gates.unconfirmed_critical.map(humanField).join(', ')}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

/** Document image viewer */
function SourceCropViewer({ imageUrl }: { imageUrl: string | null }) {
  const [expanded, setExpanded] = useState(false)
  if (!imageUrl) return null
  return (
    <div style={{ marginBottom: '16px' }}>
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 18px',
          background: C.bgCard,
          border: `1px solid ${C.border}`,
          borderRadius: expanded ? '16px 16px 0 0' : '16px',
          cursor: 'pointer',
          fontSize: '18px',
          fontWeight: 600,
          color: C.text1,
        }}
      >
        <span>📄 View your document</span>
        <span style={{ fontSize: '20px', color: C.gray }}>{expanded ? '▲' : '▼'}</span>
      </button>
      {expanded && (
        <div style={{
          border: `1px solid ${C.border}`,
          borderTop: 'none',
          borderRadius: '0 0 16px 16px',
          overflow: 'hidden',
          background: '#f3f4f6',
          textAlign: 'center',
          padding: '12px',
        }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt="Your uploaded document"
            style={{ maxWidth: '100%', maxHeight: '600px', objectFit: 'contain', borderRadius: '8px' }}
          />
          <p style={{ fontSize: '14px', color: C.gray, marginTop: '8px' }}>
            Use this image to verify the translation is correct
          </p>
        </div>
      )}
    </div>
  )
}

/** Correction modal */
function CorrectFieldModal({
  field,
  currentValue,
  sessionId,
  onSaved,
  onCancel,
}: {
  field: ReviewField
  currentValue: string
  sessionId: string
  onSaved: (field: string, newValue: string) => void
  onCancel: () => void
}) {
  const [value, setValue] = useState(currentValue)
  const [reason, setReason] = useState('ocr_error')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    if (!value.trim()) { setError('Please enter a value'); return }
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/translation/${sessionId}/correct-field`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field: field.field, new_value: value.trim(), reason }),
      })
      const json = await res.json()
      if (!json.ok) { setError(json.error ?? 'Save failed'); setSaving(false); return }
      onSaved(field.field, value.trim())
    } catch {
      setError('Connection error — please try again')
      setSaving(false)
    }
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '16px',
    }}>
      <div style={{
        background: '#fff',
        borderRadius: '20px',
        padding: '28px 24px',
        width: '100%',
        maxWidth: '480px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
      }}>
        <h2 style={{ fontSize: '20px', fontWeight: 700, color: C.text1, marginBottom: '6px' }}>
          Correct: {humanField(field.field)}
        </h2>
        <p style={{ fontSize: '15px', color: C.text3, marginBottom: '20px' }}>
          Original document says: <strong style={{ color: C.text2 }}>{field.raw_value ?? '—'}</strong>
        </p>

        <label style={{ display: 'block', fontSize: '16px', fontWeight: 600, color: C.text1, marginBottom: '6px' }}>
          Corrected English value
        </label>
        <input
          type="text"
          value={value}
          onChange={e => setValue(e.target.value)}
          style={{
            width: '100%',
            padding: '14px 16px',
            fontSize: '18px',
            border: `2px solid ${C.border}`,
            borderRadius: '10px',
            outline: 'none',
            color: C.text1,
            marginBottom: '16px',
            boxSizing: 'border-box',
          }}
          autoFocus
        />

        <label style={{ display: 'block', fontSize: '16px', fontWeight: 600, color: C.text1, marginBottom: '6px' }}>
          Reason for correction
        </label>
        <select
          value={reason}
          onChange={e => setReason(e.target.value)}
          style={{
            width: '100%',
            padding: '14px 16px',
            fontSize: '16px',
            border: `2px solid ${C.border}`,
            borderRadius: '10px',
            color: C.text1,
            marginBottom: '20px',
            background: '#fff',
            boxSizing: 'border-box',
          }}
        >
          <option value="ocr_error">Scanning error (wrong character read)</option>
          <option value="controlling_spelling">Official spelling from another ID document</option>
          <option value="one_document_exception">Name appears differently in this specific document</option>
          <option value="manual">Other correction</option>
        </select>

        {error && (
          <p style={{ fontSize: '15px', color: C.red, marginBottom: '12px' }}>{error}</p>
        )}

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              flex: 1,
              padding: '14px',
              fontSize: '17px',
              fontWeight: 600,
              border: `2px solid ${C.border}`,
              borderRadius: '10px',
              background: 'transparent',
              color: C.text2,
              cursor: 'pointer',
              minHeight: '44px',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            style={{
              flex: 2,
              padding: '14px',
              fontSize: '17px',
              fontWeight: 700,
              border: 'none',
              borderRadius: '10px',
              background: saving ? '#93c5fd' : C.blue,
              color: '#fff',
              cursor: saving ? 'wait' : 'pointer',
              minHeight: '44px',
            }}
          >
            {saving ? 'Saving…' : 'Save correction'}
          </button>
        </div>
      </div>
    </div>
  )
}

/** Single field card */
function EvidenceFieldCard({
  field,
  sessionId,
  onConfirmed,
  onCorrected,
}: {
  field: ReviewField
  sessionId: string
  onConfirmed: (fieldName: string) => void
  onCorrected: (fieldName: string, newValue: string) => void
}) {
  const [confirming, setConfirming] = useState(false)
  const [showCorrect, setShowCorrect] = useState(false)

  async function handleConfirm() {
    setConfirming(true)
    try {
      const res = await fetch(`/api/translation/${sessionId}/confirm-field`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field: field.field }),
      })
      const json = await res.json()
      if (json.ok) onConfirmed(field.field)
    } finally {
      setConfirming(false)
    }
  }

  const borderColor = field.confirmed
    ? '#86efac'
    : field.is_critical && field.review_required
    ? '#fca5a5'
    : field.is_critical
    ? '#fde68a'
    : C.border

  const bgColor = field.confirmed
    ? '#f0fdf4'
    : field.is_critical && field.review_required
    ? '#fff5f5'
    : '#fff'

  return (
    <>
      <div style={{
        background: bgColor,
        border: `2px solid ${borderColor}`,
        borderRadius: '14px',
        padding: '18px 20px',
        marginBottom: '12px',
      }}>
        {/* Field header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px', gap: '12px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '17px', fontWeight: 700, color: C.text1 }}>
                {humanField(field.field)}
              </span>
              {field.is_critical && !field.confirmed && (
                <span style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  color: '#b45309',
                  background: '#fef3c7',
                  padding: '2px 8px',
                  borderRadius: '20px',
                }}>
                  REQUIRED
                </span>
              )}
              {field.confirmed && (
                <span style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  color: C.green,
                  background: '#dcfce7',
                  padding: '2px 8px',
                  borderRadius: '20px',
                }}>
                  ✓ CONFIRMED
                </span>
              )}
              {/* Plain-language confidence label */}
              {!field.confirmed && (() => {
                const lbl = confidenceLabel(field.confidence)
                return (
                  <span style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: lbl.color,
                    background: lbl.bg,
                    padding: '2px 8px',
                    borderRadius: '20px',
                  }}>
                    {lbl.text}
                  </span>
                )
              })()}
            </div>
            {/* Evidence provenance badge */}
            <EvidenceBadge evidenceType={field.evidence_type} bboxStatus={field.bbox_status} />

            {/* Translation value — large, readable */}
            <p style={{ fontSize: '20px', fontWeight: 600, color: C.text1, margin: '0 0 6px', wordBreak: 'break-word' }}>
              {field.normalized_value ?? <span style={{ color: C.text3, fontStyle: 'italic' }}>Not found</span>}
            </p>

            {/* Source document value */}
            {field.raw_value && field.raw_value !== field.normalized_value && (
              <p style={{ fontSize: '14px', color: C.text3, margin: 0 }}>
                In document: <span style={{ fontStyle: 'italic' }}>{field.raw_value}</span>
              </p>
            )}

            {field.review_required && !field.confirmed && (
              <p style={{ fontSize: '14px', color: C.red, marginTop: '6px', fontWeight: 600 }}>
                ⚠ Please double-check this value — it may have been scanned incorrectly
              </p>
            )}
          </div>
        </div>

        {/* Action buttons */}
        {!field.confirmed && (
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={() => setShowCorrect(true)}
              style={{
                flex: 1,
                padding: '12px 16px',
                fontSize: '16px',
                fontWeight: 600,
                border: `2px solid ${C.border}`,
                borderRadius: '10px',
                background: 'transparent',
                color: C.text2,
                cursor: 'pointer',
                minHeight: '44px',
              }}
            >
              ✏ Fix this value
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={confirming}
              style={{
                flex: 2,
                padding: '12px 16px',
                fontSize: '16px',
                fontWeight: 700,
                border: 'none',
                borderRadius: '10px',
                background: confirming ? '#86efac' : C.green,
                color: '#fff',
                cursor: confirming ? 'wait' : 'pointer',
                minHeight: '44px',
              }}
            >
              {confirming ? 'Confirming…' : '✓ Looks correct'}
            </button>
          </div>
        )}

        {field.confirmed && (
          <button
            type="button"
            onClick={() => setShowCorrect(true)}
            style={{
              padding: '10px 16px',
              fontSize: '14px',
              fontWeight: 600,
              border: `1px solid ${C.border}`,
              borderRadius: '10px',
              background: 'transparent',
              color: C.gray,
              cursor: 'pointer',
              minHeight: '44px',
            }}
          >
            Change this value
          </button>
        )}
      </div>

      {showCorrect && (
        <CorrectFieldModal
          field={field}
          currentValue={field.normalized_value ?? ''}
          sessionId={sessionId}
          onSaved={(f, v) => { setShowCorrect(false); onCorrected(f, v) }}
          onCancel={() => setShowCorrect(false)}
        />
      )}
    </>
  )
}

/** Certification form — shown after all critical fields confirmed */
function CertificationForm({
  sessionId,
  existingCert,
  onCertified,
}: {
  sessionId: string
  existingCert: CertificationRecord | null
  onCertified: (cert: CertificationRecord) => void
}) {
  const [name, setName] = useState(existingCert?.signer_full_name ?? '')
  const [signature, setSignature] = useState(existingCert?.signature_typed_name ?? '')
  const [address, setAddress] = useState(existingCert?.signer_address ?? '')
  const [phone, setPhone] = useState(existingCert?.signer_phone ?? '')
  const [email, setEmail] = useState(existingCert?.signer_email ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const alreadySigned = Boolean(existingCert)

  async function handleSign() {
    if (!name.trim()) { setError('Please enter your full name'); return }
    if (!signature.trim()) { setError('Please type your name as signature'); return }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/translation/certify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          signer_name: name.trim(),
          signature_typed_name: signature.trim(),
          signer_address: address.trim() || undefined,
          signer_phone: phone.trim() || undefined,
          signer_email: email.trim() || undefined,
          source_language: 'Ukrainian',
        }),
      })
      const json = await res.json()
      if (!json.ok) {
        setError(json.error ?? 'Certification failed')
        if (json.unconfirmed_critical) {
          setError(`Cannot sign yet. Please confirm these fields first: ${(json.unconfirmed_critical as string[]).map(f => FIELD_LABELS[f] ?? f).join(', ')}`)
        }
        setSaving(false)
        return
      }
      onCertified({ signer_full_name: name.trim(), signature_typed_name: signature.trim(), certification_version: 'self_cert_8cfr_v1', signed_at: new Date().toISOString() })
    } catch {
      setError('Connection error — please try again')
      setSaving(false)
    }
  }

  return (
    <div style={{ background: C.bgCard, border: `2px solid ${alreadySigned ? '#86efac' : C.border}`, borderRadius: '16px', padding: '24px', marginTop: '24px' }}>
      <h2 style={{ fontSize: '20px', fontWeight: 700, color: C.text1, marginBottom: '6px' }}>
        {alreadySigned ? '✅ Translation signed' : '✍ Sign the translation'}
      </h2>
      <p style={{ fontSize: '16px', color: C.text3, marginBottom: '20px', lineHeight: 1.6 }}>
        {alreadySigned
          ? `Signed by ${existingCert!.signer_full_name} on ${new Date(existingCert!.signed_at).toLocaleDateString()}.`
          : 'By signing, you confirm that this translation is accurate and complete (8 CFR §103.2(b)(3)).'}
      </p>

      {!alreadySigned && (
        <>
          <div style={{ display: 'grid', gap: '16px', marginBottom: '20px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '16px', fontWeight: 600, color: C.text1, marginBottom: '6px' }}>
                Your full name <span style={{ color: C.red }}>*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Jane Smith"
                style={{ width: '100%', padding: '14px 16px', fontSize: '18px', border: `2px solid ${C.border}`, borderRadius: '10px', color: C.text1, boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '16px', fontWeight: 600, color: C.text1, marginBottom: '6px' }}>
                Type your name as signature <span style={{ color: C.red }}>*</span>
              </label>
              <input
                type="text"
                value={signature}
                onChange={e => setSignature(e.target.value)}
                placeholder="Type your name exactly"
                style={{ width: '100%', padding: '14px 16px', fontSize: '18px', border: `2px solid ${C.border}`, borderRadius: '10px', color: C.text1, boxSizing: 'border-box', fontStyle: 'italic' }}
              />
              <p style={{ fontSize: '13px', color: C.gray, marginTop: '4px' }}>This acts as your electronic signature</p>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '16px', fontWeight: 600, color: C.text1, marginBottom: '6px' }}>
                Address (optional — recommended for USCIS)
              </label>
              <input
                type="text"
                value={address}
                onChange={e => setAddress(e.target.value)}
                placeholder="City, State"
                style={{ width: '100%', padding: '14px 16px', fontSize: '16px', border: `2px solid ${C.border}`, borderRadius: '10px', color: C.text1, boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '15px', fontWeight: 600, color: C.text1, marginBottom: '6px' }}>
                  Phone (optional)
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="(555) 000-0000"
                  style={{ width: '100%', padding: '12px 14px', fontSize: '16px', border: `2px solid ${C.border}`, borderRadius: '10px', color: C.text1, boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '15px', fontWeight: 600, color: C.text1, marginBottom: '6px' }}>
                  Email (optional)
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@email.com"
                  style={{ width: '100%', padding: '12px 14px', fontSize: '16px', border: `2px solid ${C.border}`, borderRadius: '10px', color: C.text1, boxSizing: 'border-box' }}
                />
              </div>
            </div>
          </div>

          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px' }}>
              <p style={{ fontSize: '15px', color: C.red, margin: 0 }}>{error}</p>
            </div>
          )}

          <button
            type="button"
            onClick={handleSign}
            disabled={saving}
            style={{
              width: '100%',
              padding: '16px',
              fontSize: '18px',
              fontWeight: 700,
              border: 'none',
              borderRadius: '12px',
              background: saving ? '#93c5fd' : C.blue,
              color: '#fff',
              cursor: saving ? 'wait' : 'pointer',
              minHeight: '54px',
            }}
          >
            {saving ? 'Signing…' : 'Sign the translation'}
          </button>

          <p style={{ fontSize: '13px', color: C.gray, textAlign: 'center', marginTop: '12px', lineHeight: 1.5 }}>
            By signing, you certify competency to translate Ukrainian to English
            and that this translation is accurate (8 CFR §103.2(b)(3)).
            Messenginfo is not a law firm.
          </p>
        </>
      )}
    </div>
  )
}

/** Payment gate status panel */
function PaymentGateStatus({
  sessionId,
  paymentConfirmed,
  locale,
}: {
  sessionId: string
  paymentConfirmed: boolean
  locale: string
}) {
  if (paymentConfirmed) {
    return (
      <div style={{
        background: '#f0fdf4',
        border: '2px solid #86efac',
        borderRadius: '16px',
        padding: '20px 24px',
        marginTop: '20px',
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
      }}>
        <span style={{ fontSize: '32px' }}>✅</span>
        <div>
          <p style={{ fontSize: '18px', fontWeight: 700, color: C.green, margin: 0 }}>Payment confirmed</p>
          <p style={{ fontSize: '15px', color: '#15803d', margin: '2px 0 0' }}>Your translation is paid for and ready to download.</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      background: '#fffbeb',
      border: '2px solid #fde68a',
      borderRadius: '16px',
      padding: '20px 24px',
      marginTop: '20px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '14px' }}>
        <span style={{ fontSize: '32px' }}>💳</span>
        <div>
          <p style={{ fontSize: '18px', fontWeight: 700, color: '#92400e', margin: 0 }}>Payment required</p>
          <p style={{ fontSize: '15px', color: '#b45309', margin: '2px 0 0' }}>Complete payment to download your signed PDF translation.</p>
        </div>
      </div>
      <a
        href={`/${locale}/services/translate-document/start`}
        style={{
          display: 'block',
          width: '100%',
          textAlign: 'center',
          padding: '15px',
          fontSize: '17px',
          fontWeight: 700,
          background: '#f59e0b',
          color: '#fff',
          textDecoration: 'none',
          borderRadius: '12px',
          minHeight: '44px',
          boxSizing: 'border-box',
        }}
      >
        Pay and download — from $9.99
      </a>
    </div>
  )
}

/** Final download panel — shown when all gates pass */
function FinalDownloadPanel({ sessionId }: { sessionId: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleDownload() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/translation/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId }),
      })

      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        setError(json.error ?? `Error ${res.status} — please try again`)
        setLoading(false)
        return
      }

      // Stream PDF download
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `translation-${sessionId.slice(0, 8)}.pdf`
      document.body.appendChild(a)
      a.click()
      setTimeout(() => { URL.revokeObjectURL(url); document.body.removeChild(a) }, 2000)
    } catch {
      setError('Download failed — please try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      background: '#f0fdf4',
      border: '2px solid #86efac',
      borderRadius: '16px',
      padding: '24px',
      marginTop: '20px',
      textAlign: 'center',
    }}>
      <p style={{ fontSize: '36px', margin: '0 0 12px' }}>🎉</p>
      <h2 style={{ fontSize: '22px', fontWeight: 800, color: C.text1, marginBottom: '8px' }}>
        Your translation is ready!
      </h2>
      <p style={{ fontSize: '17px', color: C.text2, marginBottom: '20px', lineHeight: 1.6 }}>
        All fields reviewed, translation signed, payment confirmed.
        Click below to download your official USCIS-ready PDF.
      </p>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px' }}>
          <p style={{ fontSize: '15px', color: C.red, margin: 0 }}>{error}</p>
        </div>
      )}

      <button
        type="button"
        onClick={handleDownload}
        disabled={loading}
        style={{
          width: '100%',
          padding: '18px',
          fontSize: '20px',
          fontWeight: 800,
          border: 'none',
          borderRadius: '14px',
          background: loading ? '#86efac' : C.green,
          color: '#fff',
          cursor: loading ? 'wait' : 'pointer',
          minHeight: '60px',
          marginBottom: '14px',
        }}
      >
        {loading ? 'Generating PDF…' : '⬇ Download Translation PDF'}
      </button>

      <p style={{ fontSize: '13px', color: C.gray, lineHeight: 1.5 }}>
        PDF includes: official translation + translator signature + source audit trail.
        Keep a printed copy with your USCIS application.
      </p>
    </div>
  )
}

// ── Main EvidenceReviewPage ───────────────────────────────────────────────────

export function EvidenceReviewPage({
  sessionId,
  locale,
}: {
  sessionId: string
  locale: string
}) {
  const [state, setState] = useState<ReviewState | null>(null)
  const [loadError, setLoadError] = useState('')

  const loadState = useCallback(async () => {
    try {
      const res = await fetch(`/api/translation/${sessionId}/review-state`)
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setLoadError(j.error ?? `Error ${res.status}`)
        return
      }
      const json = await res.json()
      setState(json)
    } catch {
      setLoadError('Could not load your translation. Please refresh the page.')
    }
  }, [sessionId])

  useEffect(() => { loadState() }, [loadState])

  function handleFieldConfirmed(fieldName: string) {
    setState(prev => {
      if (!prev) return prev
      const fields = prev.fields.map(f =>
        f.field === fieldName ? { ...f, confirmed: true, confirmed_at: new Date().toISOString() } : f
      )
      const confirmedCount = fields.filter(f => f.confirmed).length
      const criticalConfirmed = fields.filter(f => f.is_critical && f.confirmed).length
      const criticalTotal = fields.filter(f => f.is_critical).length
      const unconfirmedCritical = fields.filter(f => f.is_critical && !f.confirmed).map(f => f.field)
      return {
        ...prev,
        fields,
        review_progress: {
          ...prev.review_progress,
          confirmed: confirmedCount,
          critical_confirmed: criticalConfirmed,
          percent: prev.review_progress.total > 0
            ? Math.round((confirmedCount / prev.review_progress.total) * 100)
            : 0,
        },
        gates: {
          ...prev.gates,
          can_certify: criticalTotal > 0 && criticalConfirmed === criticalTotal,
          unconfirmed_critical: unconfirmedCritical,
        },
      }
    })
  }

  function handleFieldCorrected(fieldName: string, newValue: string) {
    setState(prev => {
      if (!prev) return prev
      const fields = prev.fields.map(f =>
        f.field === fieldName
          ? { ...f, normalized_value: newValue, confirmed: true, confirmed_at: new Date().toISOString(), review_required: false }
          : f
      )
      const confirmedCount = fields.filter(f => f.confirmed).length
      const criticalConfirmed = fields.filter(f => f.is_critical && f.confirmed).length
      const criticalTotal = fields.filter(f => f.is_critical).length
      const unconfirmedCritical = fields.filter(f => f.is_critical && !f.confirmed).map(f => f.field)
      return {
        ...prev,
        fields,
        review_progress: {
          ...prev.review_progress,
          confirmed: confirmedCount,
          critical_confirmed: criticalConfirmed,
          percent: prev.review_progress.total > 0
            ? Math.round((confirmedCount / prev.review_progress.total) * 100)
            : 0,
        },
        gates: {
          ...prev.gates,
          can_certify: criticalTotal > 0 && criticalConfirmed === criticalTotal,
          unconfirmed_critical: unconfirmedCritical,
        },
      }
    })
  }

  function handleCertified(cert: CertificationRecord) {
    setState(prev => {
      if (!prev) return prev
      return {
        ...prev,
        certification_record: cert,
        session: { ...prev.session, status: 'certified' },
        gates: {
          ...prev.gates,
          can_render: prev.session.payment_confirmed,
        },
      }
    })
  }

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (!state && !loadError) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bgPage }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '48px', height: '48px', border: '4px solid #e5e7eb', borderTopColor: C.blue, borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <p style={{ fontSize: '18px', color: C.gray }}>Loading your translation…</p>
        </div>
      </div>
    )
  }

  // ── Error ───────────────────────────────────────────────────────────────────
  if (loadError) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', background: C.bgPage }}>
        <div style={{ background: '#fff', border: '1px solid #fca5a5', borderRadius: '16px', padding: '32px', maxWidth: '480px', textAlign: 'center' }}>
          <p style={{ fontSize: '40px', marginBottom: '12px' }}>⚠</p>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: C.text1, marginBottom: '8px' }}>Could not load translation</h2>
          <p style={{ fontSize: '16px', color: C.text3, marginBottom: '20px' }}>{loadError}</p>
          <button
            type="button"
            onClick={loadState}
            style={{ padding: '14px 28px', fontSize: '17px', fontWeight: 700, border: 'none', borderRadius: '10px', background: C.blue, color: '#fff', cursor: 'pointer', minHeight: '44px' }}
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  const { session, fields, document_image_url, certification_record, review_progress, gates } = state!

  // Separate critical from non-critical fields, unconfirmed first
  const criticalFields = fields.filter(f => f.is_critical).sort((a, b) => Number(a.confirmed) - Number(b.confirmed))
  const otherFields = fields.filter(f => !f.is_critical).sort((a, b) => Number(a.confirmed) - Number(b.confirmed))

  return (
    <main style={{ minHeight: '100dvh', background: C.bgPage, padding: '16px' }}>
      <div style={{ maxWidth: '640px', margin: '0 auto' }}>

        {/* Page header */}
        <div style={{ marginBottom: '20px' }}>
          <a
            href={`/${locale}/services/translate-document`}
            style={{ fontSize: '15px', color: C.blue, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px', marginBottom: '12px' }}
          >
            ← Back
          </a>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: C.text1, margin: '0 0 6px' }}>
            Review Your Translation
          </h1>
          <p style={{ fontSize: '17px', color: C.text3, margin: 0, lineHeight: 1.5 }}>
            {session.scope_title || 'Ukrainian Passport Translation'}
          </p>
        </div>

        {/* Progress */}
        <ReviewProgress progress={review_progress} gates={gates} />

        {/* Document image */}
        <SourceCropViewer imageUrl={document_image_url} />

        {/* Critical fields section */}
        {criticalFields.length > 0 && (
          <div style={{ marginBottom: '8px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: C.text1, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '14px', fontWeight: 700, color: '#b45309', background: '#fef3c7', padding: '3px 10px', borderRadius: '20px' }}>REQUIRED</span>
              Fields needed for USCIS
            </h2>
            {criticalFields.map(f => (
              <EvidenceFieldCard
                key={f.field}
                field={f}
                sessionId={sessionId}
                onConfirmed={handleFieldConfirmed}
                onCorrected={handleFieldCorrected}
              />
            ))}
          </div>
        )}

        {/* Other fields */}
        {otherFields.length > 0 && (
          <div style={{ marginTop: '20px', marginBottom: '8px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: C.text1, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '14px', fontWeight: 700, color: C.gray, background: '#f3f4f6', padding: '3px 10px', borderRadius: '20px' }}>ADDITIONAL</span>
              Other translated fields
            </h2>
            {otherFields.map(f => (
              <EvidenceFieldCard
                key={f.field}
                field={f}
                sessionId={sessionId}
                onConfirmed={handleFieldConfirmed}
                onCorrected={handleFieldCorrected}
              />
            ))}
          </div>
        )}

        {/* Empty state */}
        {fields.length === 0 && (
          <div style={{ background: '#fff', border: `2px dashed ${C.border}`, borderRadius: '16px', padding: '40px', textAlign: 'center', marginBottom: '24px' }}>
            <p style={{ fontSize: '40px', margin: '0 0 12px' }}>📄</p>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: C.text1, marginBottom: '8px' }}>No fields extracted yet</h2>
            <p style={{ fontSize: '16px', color: C.text3, marginBottom: '20px', lineHeight: 1.6 }}>
              Upload your document and run extraction first.
            </p>
            <a
              href={`/${locale}/services/translate-document/start`}
              style={{ display: 'inline-block', padding: '14px 28px', fontSize: '17px', fontWeight: 700, background: C.blue, color: '#fff', textDecoration: 'none', borderRadius: '12px', minHeight: '44px' }}
            >
              Upload document
            </a>
          </div>
        )}

        {/* Certification form — gated on can_certify or already signed */}
        {(gates.can_certify || Boolean(certification_record)) && (
          <CertificationForm
            sessionId={sessionId}
            existingCert={certification_record}
            onCertified={handleCertified}
          />
        )}

        {/* Pre-certification hint — shown while critical fields still pending */}
        {!gates.can_certify && !certification_record && fields.length > 0 && (
          <div style={{
            background: '#fffbeb',
            border: '1px solid #fde68a',
            borderRadius: '12px',
            padding: '16px 20px',
            marginTop: '24px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
          }}>
            <span style={{ fontSize: '22px', flexShrink: 0 }}>🔒</span>
            <div>
              <p style={{ fontSize: '16px', fontWeight: 700, color: '#92400e', margin: '0 0 4px' }}>
                Signature locked — confirm all required fields first
              </p>
              <p style={{ fontSize: '14px', color: '#b45309', margin: 0 }}>
                {gates.unconfirmed_critical.length > 0
                  ? `Still needed: ${gates.unconfirmed_critical.map(humanField).join(', ')}`
                  : 'Confirm the required fields above to unlock signing.'}
              </p>
            </div>
          </div>
        )}

        {/* Payment gate */}
        <PaymentGateStatus
          sessionId={sessionId}
          paymentConfirmed={Boolean(session.payment_confirmed)}
          locale={locale}
        />

        {/* Final download — only when all gates pass */}
        {gates.can_render && (
          <FinalDownloadPanel sessionId={sessionId} />
        )}

        {/* Bottom padding for mobile */}
        <div style={{ height: '40px' }} />
      </div>
    </main>
  )
}
