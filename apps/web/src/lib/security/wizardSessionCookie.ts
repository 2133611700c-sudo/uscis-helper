/**
 * wizardSessionCookie — read the STABLE per-person wizard session id from the httpOnly
 * `wizard_anon_id` cookie (set by /api/wizard/session, 30-day UUID). This is the only id
 * shared across ALL of one person's document uploads in a wizard session, so it is the
 * grouping key for cross-document reconciliation (crossDocSession). Mirrors the validated
 * `ownerCookie()` reader in the wizard session route.
 */
import type { NextRequest } from 'next/server'
import { isUUID } from './validation'

/** The cookie name set by /api/wizard/session (OWNER_COOKIE). */
export const WIZARD_ANON_COOKIE = 'wizard_anon_id'

/** Stable wizard session id (validated UUID) or null when absent/invalid. */
export function getWizardAnonId(req: NextRequest): string | null {
  const v = req.cookies.get(WIZARD_ANON_COOKIE)?.value
  return v && isUUID(v) ? v : null
}
