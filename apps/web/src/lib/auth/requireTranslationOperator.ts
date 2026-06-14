/**
 * requireTranslationOperator — independent authorization for translation operator
 * Server Actions.
 *
 * WHY independent: Next.js middleware guards /admin PAGE navigations, but a Server
 * Action is a POST to the same origin that does NOT re-run the page's render-time
 * guard. Relying on page visibility alone would let a forged action invocation
 * mutate an order. This helper re-checks the SAME admin credential
 * (admin_session cookie === ADMIN_SECRET) that middleware uses, INSIDE every
 * action, so authorization is enforced at the mutation boundary.
 *
 * Returns a PII-free operator actor {id, email?} on success, or throws a typed
 * OperatorAuthError (status 401 unauthenticated / 403 not-an-operator). The actor
 * id is the value persisted to the append-only event/override audit chain — it is
 * intentionally opaque ('operator:admin'), never a raw email.
 *
 * PII: the actor id is opaque. We never log the cookie value or any email.
 */

import { cookies } from 'next/headers'

const ADMIN_COOKIE = 'admin_session'

export interface OperatorActor {
  /** PII-free actor id for audit (e.g. 'operator:admin'). */
  id: string
  /** Optional operator email — NEVER logged, only for UI display. */
  email?: string
}

export class OperatorAuthError extends Error {
  readonly status: 401 | 403
  constructor(status: 401 | 403, message: string) {
    super(message)
    this.name = 'OperatorAuthError'
    this.status = status
  }
}

/**
 * Authenticate the current request as a translation operator. MUST be the first
 * call in every operator Server Action.
 *
 * Throws OperatorAuthError(403) when no admin secret is configured (fail closed),
 * OperatorAuthError(401) when the admin_session cookie is missing or wrong.
 */
export async function requireTranslationOperator(): Promise<OperatorActor> {
  const secret = process.env.ADMIN_SECRET
  if (!secret) {
    // Fail closed: an unconfigured secret must never authorize.
    throw new OperatorAuthError(403, 'operator_auth_not_configured')
  }

  // cookies() is async in Next 15 typings; await is safe across 14/15.
  const cookieStore = await cookies()
  const session = cookieStore.get(ADMIN_COOKIE)?.value

  if (!session || session !== secret) {
    throw new OperatorAuthError(401, 'operator_unauthorized')
  }

  return { id: 'operator:admin' }
}
