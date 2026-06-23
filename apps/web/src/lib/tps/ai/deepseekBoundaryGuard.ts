/**
 * deepseekBoundaryGuard — re-instated CHECKABLE enforcement of Constitution L3
 * (DeepSeek = PROSE ONLY; "its claimed final_value is never trusted —
 * deterministically overwritten from source_value") + ADR-018 matrix.
 *
 * History: the original `apps/web/src/lib/documentSafety/deepseekBoundaryGuard.ts`
 * was deleted in the 2026-06 dead-code sweep (commit ce0a208). The Constitution
 * (L3, open deviation: "the DeepSeek boundary guard was deleted — re-instate")
 * and ONE_BRAIN_UNIFICATION_PLAN flag it for U-STAGE 2. This is the re-instated
 * guard, scoped to the DeepSeek TPS extraction layer (documentBrain).
 *
 * INVARIANT (L3): a DeepSeek-produced `final_value` for an identity / date /
 * number field can NEVER be released as-is. The single legal release value is
 * the deterministic overwrite (KMU-55 / WinAnsi-safe / dictionary normalization
 * computed from `source_value`). This guard asserts that the deterministic
 * overwrite actually ran — i.e. the model's CLAIMED final_value did not survive
 * for a critical field when it differs from the deterministic derivation.
 *
 * This is a pure assertion over already-hardened output. It does NOT change the
 * released values; it only refuses to let a non-overwritten model claim escape.
 */

import { hasCyrillic } from '@/lib/tps/transliterate'

/** Fields whose final_value DeepSeek may never author: identity / date / number. */
export const DEEPSEEK_FORBIDDEN_AUTHORITY_FIELDS: ReadonlySet<string> = new Set([
  // identity
  'family_name', 'given_name', 'middle_name', 'sex',
  'country_of_birth', 'country_of_nationality', 'city_of_birth', 'province_of_birth',
  'passport_country_of_issuance', 'place_of_last_entry',
  // dates
  'dob', 'passport_expiration_date', 'last_entry_date', 'i94_admit_until',
  'ead_expiration_date',
  // numbers
  'passport_number', 'i94_admission_number', 'a_number',
  'ead_category_on_card', 'i94_class_of_admission', 'dl_number',
])

export interface BoundaryCheckField {
  /** field key (e.g. 'dob', 'family_name') */
  field: string
  /** what the document literally showed (the deterministic input) */
  source_value: string
  /** the value the model CLAIMED before deterministic overwrite */
  claimed_final_value: string
  /** the value AFTER the deterministic overwrite (the release candidate) */
  hardened_final_value: string
}

export interface BoundaryViolation {
  field: string
  reason: string
}

/**
 * Detect violations of L3 on hardened DeepSeek output. A violation is a critical
 * field where the model's CLAIMED final_value differs from the deterministic
 * derivation yet that claim was released unchanged (the overwrite did not run),
 * OR a critical text field whose released value still carries Cyrillic (KMU-55
 * never ran). Pure; never throws.
 */
export function findBoundaryViolations(fields: BoundaryCheckField[]): BoundaryViolation[] {
  const out: BoundaryViolation[] = []
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ')
  for (const f of fields) {
    if (!DEEPSEEK_FORBIDDEN_AUTHORITY_FIELDS.has(f.field)) continue

    const isNameLike =
      f.field === 'family_name' || f.field === 'given_name' || f.field === 'middle_name'

    // 1) For NON-name critical fields, hardenFinalValues sets the release value
    //    to toWinAnsiSafe(source_value) — a faithful echo of the SOURCE (then a
    //    later deterministic validator may reformat dates/sex/numbers). The
    //    release therefore must trace to SOURCE, never to a model claim that
    //    DIVERGES from source. If the hardened value equals a divergent model
    //    claim instead of the source, the deterministic overwrite did not run.
    //    (Name fields legitimately diverge from source via KMU-55, so check #1
    //    does not apply to them — they are covered by the Cyrillic check below.)
    if (!isNameLike) {
      const claimDivergesFromSource =
        norm(f.claimed_final_value) !== '' && norm(f.claimed_final_value) !== norm(f.source_value)
      const hardenedTracesToSource =
        norm(f.hardened_final_value) === norm(f.source_value)
      const hardenedEqualsDivergentClaim =
        norm(f.hardened_final_value) === norm(f.claimed_final_value)
      if (claimDivergesFromSource && hardenedEqualsDivergentClaim && !hardenedTracesToSource) {
        out.push({
          field: f.field,
          reason: 'DeepSeek claimed_final_value survived unchanged for a critical field (deterministic overwrite did not run)',
        })
      }
    }

    // 2) Name identity fields must never release Cyrillic (KMU-55 must have run).
    if (isNameLike && hasCyrillic(f.hardened_final_value)) {
      out.push({
        field: f.field,
        reason: 'released name still contains Cyrillic — KMU-55 deterministic overwrite missing',
      })
    }
  }
  return out
}

/**
 * Hard assertion for the finalize door. Throws if any DeepSeek-authored critical
 * final_value escaped the deterministic overwrite. Call AFTER hardenFinalValues.
 */
export function assertDeepSeekBoundary(fields: BoundaryCheckField[]): void {
  const v = findBoundaryViolations(fields)
  if (v.length) {
    throw new Error(
      `Constitution L3 violation (DeepSeek boundary): ${v
        .map((x) => `${x.field} — ${x.reason}`)
        .join('; ')}`,
    )
  }
}
