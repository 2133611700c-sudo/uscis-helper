/**
 * I-765 eligibility category — selected by PRODUCT RULES from a confirmed
 * immigration basis, NEVER guessed by AI (ADR-011; EAD contract). Unknown
 * basis → null (caller flags review; no output without a real category).
 */
export type EligibilityBasis = 'tps' | 'parole_u4u' | 'asylum_pending' | 'adjustment_pending'
export interface EadCategory { code: string; label: string }

const RULES: Record<EligibilityBasis, EadCategory> = {
  tps:               { code: '(a)(12) / (c)(19)', label: 'Temporary Protected Status (granted / pending)' },
  parole_u4u:        { code: '(c)(11)', label: 'Paroled into the U.S. (Uniting for Ukraine)' },
  asylum_pending:    { code: '(c)(8)',  label: 'Pending asylum application' },
  adjustment_pending:{ code: '(c)(9)',  label: 'Pending adjustment of status (I-485)' },
}

/** Returns the category for a CONFIRMED basis, or null if basis is unknown/absent. */
export function eligibilityCategory(basis: string | undefined | null): EadCategory | null {
  if (!basis) return null
  return RULES[basis as EligibilityBasis] ?? null
}
