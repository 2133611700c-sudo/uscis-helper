/**
 * reviewGate.ts — single source of truth for the Translation Review Gate.
 *
 * Legal boundary (8 CFR §103.2(b)(3)): a certified English translation may only
 * be rendered/delivered after a human has reviewed the machine draft and signed
 * the certification. Messenginfo does NOT certify — the user self-certifies.
 *
 * This guard closes the runtime hole where /api/translation/generate-pdf rendered
 * a certified PDF from raw machine fields with only a payment check — no review,
 * no signature, no signer identity. A machine-only POST must NOT yield certified
 * output.
 *
 * HARD block (renders are refused) — both required:
 *   1. signerName present, AND
 *   2. the user confirmed the draft: reviewConfirmed === true OR a completed
 *      signature certification act (signedAt + a real signature).
 *
 * SOFT warning (render proceeds, defect surfaced) — currently signerAddress:
 *   The live TranslateWizard does not yet collect the signer address (it sends an
 *   empty string), so blocking on it would break the production download. A USCIS
 *   certification SHOULD carry the translator's address, so its absence is
 *   reported as a non-blocking warning and tracked as a follow-up (wire an address
 *   field into the wizard, then promote this to a hard requirement).
 *
 * The legitimate wizard already sends signedAt + signatureMethod + name, so the
 * hard block does not break the live flow; it only refuses machine-only / unsigned
 * / nameless requests.
 */

export type SignatureMethod = 'drawn_on_screen' | 'manual_wet_signature'

export interface ReviewGateInput {
  /** Explicit confirmation from the TranslationReviewGate checkbox. */
  reviewConfirmed?: boolean | null
  signerName?: string | null
  signerAddress?: string | null
  /** ISO timestamp recorded when the user signed the certification. */
  signedAt?: string | null
  signatureMethod?: SignatureMethod | string | null
  /** Data URL of a drawn signature (required when method === 'drawn_on_screen'). */
  signatureDataUrl?: string | null
}

export type ReviewGateReason =
  | 'signer_name_required'
  | 'review_not_confirmed'

/** Non-blocking compliance gaps surfaced to the caller/owner. */
export type ReviewGateWarning = 'signer_address_missing'

export type ReviewGateResult =
  | { ok: true; warnings: ReviewGateWarning[] }
  | { ok: false; gate: 'review'; reason: ReviewGateReason; detail: string }

const DETAIL: Record<ReviewGateReason, string> = {
  signer_name_required:
    'Signer name is required before the translation certification can be rendered.',
  review_not_confirmed:
    'Translation review was not confirmed. The user must review the draft and sign the certification before render.',
}

/** True when the payload carries a completed signature certification act. */
export function isSignatureComplete(input: ReviewGateInput): boolean {
  if (!input.signedAt || !String(input.signedAt).trim()) return false
  if (input.signatureMethod === 'manual_wet_signature') return true
  if (input.signatureMethod === 'drawn_on_screen') {
    return !!input.signatureDataUrl && String(input.signatureDataUrl).trim().length > 0
  }
  return false
}

/**
 * Hard gate. Returns { ok: true, warnings } only when a human has confirmed the
 * review (explicit checkbox OR completed signature) AND a signer name is present.
 * Missing signer address is a non-blocking warning, not a refusal (see file head).
 * Never throws — callers branch on .ok and return 403 on failure.
 */
export function assertReviewGate(input: ReviewGateInput): ReviewGateResult {
  const name = (input.signerName ?? '').trim()
  if (!name) {
    return { ok: false, gate: 'review', reason: 'signer_name_required', detail: DETAIL.signer_name_required }
  }

  const confirmed = input.reviewConfirmed === true || isSignatureComplete(input)
  if (!confirmed) {
    return { ok: false, gate: 'review', reason: 'review_not_confirmed', detail: DETAIL.review_not_confirmed }
  }

  const warnings: ReviewGateWarning[] = []
  if (!(input.signerAddress ?? '').trim()) warnings.push('signer_address_missing')
  return { ok: true, warnings }
}
