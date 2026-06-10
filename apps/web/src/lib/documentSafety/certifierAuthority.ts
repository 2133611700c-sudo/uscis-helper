/**
 * certifierAuthority — L0 authorization primitive for `certifier_override`.
 *
 * Implements ADR-021 (RULED v1) + LAW 2#5 (tiered user/certifier authority):
 *   - Q1: a (docType, field) → TIER {1|2|3} matrix (replaces substring guessing).
 *   - Q2: a 6-code reason ENUM + a tier×reason validity MATRIX (ADDITION A).
 *   - Q3: parents/spouses = TIER 2; records carry cross_doc_anchor_id (ADDITION B).
 *   - LAW 2#5: a cross-document anchor (MRZ/EAD) ALWAYS overrides user input on a
 *     critical field; a conflict → BLOCK + escalate, never override.
 *
 * PURE + ADDITIVE: this module decides authority and builds the audit record. It
 * does NOT mutate the live C3 gate or change prod behavior — wiring it into the
 * generate-pdf route (behind a flag) is a separate, measured step. No real PII is
 * ever stored: audit values are sha256-hashed (LAW 5).
 *
 * Sources: ADR-021-delegated-certifier.md, ONE_BRAIN_CYRILLIC_CONSTITUTION.md LAW 2#5.
 */
import { createHash } from 'node:crypto'
import { classifyCriticality } from './applyOcrFieldSafety'

export type FieldTier = 1 | 2 | 3

/** The 6-code reason ENUM (ADR-021 Q2 RULING). `user_confirmed` is the TIER-3 self path. */
export type CertifierReasonCode =
  | 'source_verified'
  | 'source_corroborated_user_value'
  | 'user_clarified'
  | 'dual_witness'
  | 'unreadable_per_source'
  | 'other_with_text'
export type AuthorityInput = CertifierReasonCode | 'user_confirmed'

export type CertifierDecision =
  | 'finalize'          // value released as final
  | 'refused_null'      // documented refusal (unreadable_per_source) → stays null
  | 'block_escalate'    // anchor conflict → never override
  | 'reject_invalid'    // out-of-matrix (code, tier) or missing note

// ── Q1: (docType, field) → TIER matrix ───────────────────────────────────────
// Field keys are the REAL docintel reader keys (documentRegistry), not invented.
// TIER 1 = applicant identity (highest friction). TIER 2 = related-person identity
// + document validity (low friction). Everything else falls to the substring-based
// criticality as a TIER (critical_identity→1, critical_document→2, else→3) so the
// function is TOTAL and never silently under-protects an unmapped field.
const TIER1: Record<string, readonly string[]> = {
  ua_birth_certificate: ['child_family_name', 'child_given_name', 'child_patronymic', 'dob', 'place_of_birth_city'],
  ua_international_passport: ['family_name', 'given_name', 'dob', 'passport_number', 'passport_expiration_date'],
  ua_internal_passport_booklet: ['family_name', 'given_name', 'patronymic', 'dob', 'city_of_birth', 'province_of_birth'],
  ua_marriage_certificate: ['spouse_1_full_name', 'spouse_2_full_name', 'date_of_marriage'],
  ua_divorce_certificate: ['spouse_1_full_name', 'spouse_2_full_name', 'date_of_divorce'],
  ua_military_id: ['family_name', 'given_name', 'patronymic', 'dob'],
  ua_id_card: ['family_name', 'given_name', 'patronymic', 'dob'],
  us_ead: ['family_name', 'given_name', 'a_number', 'ead_validity_from', 'ead_validity_to', 'ead_category'],
  us_i94: ['family_name', 'given_name', 'date_of_birth', 'i94_admission_number'],
  us_i797: ['family_name', 'given_name', 'a_number'],
}
const TIER2: Record<string, readonly string[]> = {
  ua_birth_certificate: ['father_full_name', 'mother_full_name', 'act_record_number', 'date_of_issue', 'issuing_authority'],
  ua_international_passport: [],
  ua_internal_passport_booklet: [],
  ua_marriage_certificate: ['act_record_number', 'date_of_issue', 'issuing_authority'],
  ua_divorce_certificate: ['act_record_number', 'issuing_authority'],
  ua_military_id: ['doc_number', 'issuing_authority'],
  ua_id_card: ['doc_number'],
  us_ead: ['card_number'],
  us_i94: ['i94_class_of_admission'],
  us_i797: ['uscis_number'],
}

/** TIER for a (docType, field). Unmapped → derive a tier from substring criticality (never under-protect). */
export function fieldTier(docType: string | null | undefined, field: string): FieldTier {
  const dt = (docType ?? '').trim()
  const f = (field ?? '').trim()
  if (TIER1[dt]?.includes(f)) return 1
  if (TIER2[dt]?.includes(f)) return 2
  // unmapped (field, docType): fall back to the existing substring criticality,
  // mapped to a tier so we never silently treat an identity field as non-critical.
  const c = classifyCriticality(f)
  if (c === 'critical_identity') return 1
  if (c === 'critical_document') return 2
  return 3
}

// ── Q2 ADDITION A: tier × reason_code validity matrix ─────────────────────────
// true = code permitted for that tier. dual_witness is post-launch only (gated
// separately). user_clarified is TIER-3 only. unreadable_per_source is a refusal,
// valid everywhere but never finalizes.
const REASON_TIER_MATRIX: Record<CertifierReasonCode, Record<FieldTier, boolean>> = {
  source_verified:                { 1: true,  2: true,  3: true },
  source_corroborated_user_value: { 1: true,  2: true,  3: true },
  user_clarified:                 { 1: false, 2: false, 3: true },
  dual_witness:                   { 1: true,  2: true,  3: false }, // post-launch gate applied below
  unreadable_per_source:          { 1: true,  2: true,  3: true },
  other_with_text:                { 1: true,  2: true,  3: true },
}

/** Is this reason code permitted for this tier per the ADDITION A matrix? */
export function isReasonValidForTier(reason: CertifierReasonCode, tier: FieldTier): boolean {
  return REASON_TIER_MATRIX[reason]?.[tier] === true
}

export interface OverrideEvalInput {
  docType: string | null | undefined
  field: string
  /** the value the certifier/user wants to release */
  proposedValue: string | null
  /** the authority basis; `user_confirmed` is the TIER-3 user self-path */
  authority: AuthorityInput
  /** required free-text note for `other_with_text` */
  note?: string | null
  /** a cross-document anchor value (MRZ/EAD) for this field, if one exists */
  anchorValue?: string | null
  /** allow post-launch-only codes (dual_witness). Default false (pre-launch). */
  postLaunchEnabled?: boolean
}

export interface OverrideEvalResult {
  tier: FieldTier
  decision: CertifierDecision
  finalValue: string | null
  reasons: string[]
  flaggedForAuditReview: boolean
}

const norm = (s: string | null | undefined): string => (s ?? '').trim().toLocaleLowerCase('uk').replace(/\s+/g, ' ')

/**
 * Decide whether a proposed value may be finalized, per LAW 2#5 + ADR-021.
 * Never throws; returns a structured decision. Does not mutate anything.
 */
export function evaluateCertifierOverride(input: OverrideEvalInput): OverrideEvalResult {
  const tier = fieldTier(input.docType, input.field)
  const reasons: string[] = []

  // 1) ANCHOR rule (LAW 2#5): a cross-document anchor ALWAYS overrides user input
  //    on a critical (TIER 1/2) field. A conflict blocks — never override.
  if (tier !== 3 && input.anchorValue != null && input.proposedValue != null &&
      norm(input.anchorValue) !== norm(input.proposedValue)) {
    return { tier, decision: 'block_escalate', finalValue: null, reasons: ['anchor_conflict'], flaggedForAuditReview: true }
  }

  // 2) The TIER-3 user self-path: user_confirmed / user_clarified may finalize.
  if (input.authority === 'user_confirmed') {
    if (tier === 3) return { tier, decision: 'finalize', finalValue: input.proposedValue, reasons: ['user_confirmed_t3'], flaggedForAuditReview: false }
    return { tier, decision: 'reject_invalid', finalValue: null, reasons: ['user_confirmed_requires_certifier_override_on_critical'], flaggedForAuditReview: false }
  }

  const reason = input.authority as CertifierReasonCode

  // 3) A documented REFUSAL never finalizes (stays null) — not a finalization code.
  if (reason === 'unreadable_per_source') {
    return { tier, decision: 'refused_null', finalValue: null, reasons: ['unreadable_per_source'], flaggedForAuditReview: false }
  }

  // 4) Matrix validity (ADDITION A): reject out-of-matrix (code, tier) pairs.
  if (!isReasonValidForTier(reason, tier)) {
    return { tier, decision: 'reject_invalid', finalValue: null, reasons: [`reason_${reason}_invalid_for_tier_${tier}`], flaggedForAuditReview: false }
  }

  // 5) Post-launch gate: dual_witness is reserved until the delegated role ships.
  if (reason === 'dual_witness' && !input.postLaunchEnabled) {
    return { tier, decision: 'reject_invalid', finalValue: null, reasons: ['dual_witness_post_launch_only'], flaggedForAuditReview: false }
  }

  // 6) other_with_text requires a written note; it is always flagged for audit review.
  if (reason === 'other_with_text') {
    if (!input.note || !input.note.trim()) {
      return { tier, decision: 'reject_invalid', finalValue: null, reasons: ['other_with_text_requires_note'], flaggedForAuditReview: false }
    }
    reasons.push('other_with_text')
    return { tier, decision: 'finalize', finalValue: input.proposedValue, reasons, flaggedForAuditReview: true }
  }

  // 7) source_verified / source_corroborated_user_value / dual_witness(post-launch) → finalize.
  reasons.push(reason)
  return { tier, decision: 'finalize', finalValue: input.proposedValue, reasons, flaggedForAuditReview: false }
}

// ── Audit hook (ADR-021 schema, LAW 5 no-PII: values are sha256-hashed) ───────
export interface CertifierAuditRecord {
  reason_code: AuthorityInput
  tier: FieldTier
  field_name: string
  document_class: string
  previous_value_hash: string | null
  new_value_hash: string | null
  certifier_id: string
  timestamp_utc: string
  session_id: string
  linked_pdf_doc_id: string | null
  cross_doc_anchor_id: string | null
  decision: CertifierDecision
  immutable_marker: string
}

const sha256 = (s: string): string => createHash('sha256').update(s).digest('hex')
const hashOrNull = (v: string | null | undefined): string | null => (v == null || v === '' ? null : sha256(v))

export interface BuildAuditInput {
  authority: AuthorityInput
  tier: FieldTier
  field: string
  documentClass: string
  previousValue: string | null
  newValue: string | null
  certifierId: string
  timestampUtc: string          // caller stamps (UTC ISO); injected for testability
  sessionId: string
  linkedPdfDocId?: string | null
  crossDocAnchorId?: string | null  // applicant case/person key (ADDITION B); required for TIER 2
  decision: CertifierDecision
}

/** Build the immutable, PII-free audit record for one override decision. */
export function buildCertifierAuditRecord(i: BuildAuditInput): CertifierAuditRecord {
  const base = {
    reason_code: i.authority,
    tier: i.tier,
    field_name: i.field,
    document_class: i.documentClass,
    previous_value_hash: hashOrNull(i.previousValue),
    new_value_hash: hashOrNull(i.newValue),
    certifier_id: i.certifierId,
    timestamp_utc: i.timestampUtc,
    session_id: i.sessionId,
    linked_pdf_doc_id: i.linkedPdfDocId ?? null,
    cross_doc_anchor_id: i.crossDocAnchorId ?? null,
    decision: i.decision,
  }
  // immutable_marker = tamper-evident hash over the record body (no raw PII inside).
  const immutable_marker = sha256(JSON.stringify(base))
  return { ...base, immutable_marker }
}

/**
 * Emit the audit record. Destination is a structured no-PII log line until ADR-019
 * persistence lands (then this writes to the durable table). Never throws.
 */
export function recordCertifierOverride(record: CertifierAuditRecord): void {
  try {
    console.info('[certifier_override]', JSON.stringify(record))
  } catch {
    /* logging must never break the request */
  }
}
