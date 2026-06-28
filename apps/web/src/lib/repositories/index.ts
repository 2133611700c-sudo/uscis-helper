/**
 * Repository resolver — domain code calls getRepositories(); it NEVER imports a
 * Supabase client directly. Defaults to in-memory. A Supabase-backed bundle is
 * returned ONLY when explicitly opted in AND the owner has wired the adapter —
 * until then the stub throws (fail-closed). Supabase is OFF by default.
 */
import type { RepositoryBundle } from './types'
import { createInMemoryRepositories } from './inMemory'
import { createSupabaseRepositoriesStub } from './supabaseAdapter.stub'

export * from './types'
export { createInMemoryRepositories, __seedManualReviewCase, __seedDocument, __seedOrder, __getCertificationAuditRows } from './inMemory'
export { createSupabaseRepositoriesStub } from './supabaseAdapter.stub'

export type RepositoryDriver = 'in_memory' | 'supabase'

export function resolveRepositoryDriver(env: Record<string, string | undefined> = process.env): RepositoryDriver {
  // Supabase is opt-in ONLY and not auto-enabled. The stub throws until wired.
  return env.REPOSITORY_DRIVER === 'supabase' ? 'supabase' : 'in_memory'
}

let memoSingleton: RepositoryBundle | null = null

/**
 * Get the active repository bundle. In-memory is a process singleton (so a request
 * sees prior writes within the same process — used by the mocked local flow/tests).
 * Supabase path returns the stub (throws) until the owner wires the real adapter.
 */
export function getRepositories(env: Record<string, string | undefined> = process.env): RepositoryBundle {
  if (resolveRepositoryDriver(env) === 'supabase') return createSupabaseRepositoriesStub()
  if (!memoSingleton) memoSingleton = createInMemoryRepositories()
  return memoSingleton
}

/** Test helper: reset the in-memory singleton for isolation. */
export function __resetInMemoryRepositories(): void { memoSingleton = null }

/**
 * Structural adapter that lets the client-agnostic `persistCertification` lib
 * (which expects an `{ from(table).insert(row) }` shape) write through the
 * repository bundle instead of a Supabase client. Known tables route to the
 * CertificationAuditRepository; an unknown table is reported as an error (never
 * silently dropped). A thrown repo error (e.g. Supabase-not-connected) surfaces
 * as `{ error }` so the caller fails closed.
 */
export function repositoryInsertableClient(bundle: RepositoryBundle = getRepositories()) {
  return {
    from(table: string) {
      return {
        async insert(row: unknown): Promise<{ error: { code?: string; message?: string } | null }> {
          try {
            if (table === 'translation_orders') await bundle.certificationAudit.appendOrderRow(row)
            else if (table === 'translation_certification_audit') await bundle.certificationAudit.appendCertificationAudit(row)
            else return { error: { code: 'UNKNOWN_TABLE', message: table } }
            return { error: null }
          } catch (e) {
            return { error: { message: e instanceof Error ? e.message : String(e) } }
          }
        },
      }
    },
  }
}
