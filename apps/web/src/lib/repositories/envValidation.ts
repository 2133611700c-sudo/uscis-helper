/**
 * Supabase env validation — SHAPE ONLY. No real secret values are committed or read
 * here; this just validates that, IF someone opts into the Supabase driver, the
 * required vars are present and well-formed. It never connects.
 */
export interface SupabaseEnvResult {
  ok: boolean
  missing: string[]
  warnings: string[]
}

const REQUIRED = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'] as const

/** Validate Supabase env shape (only relevant when REPOSITORY_DRIVER=supabase). */
export function validateSupabaseEnv(env: Record<string, string | undefined> = process.env): SupabaseEnvResult {
  const missing: string[] = []
  const warnings: string[] = []
  for (const k of REQUIRED) if (!env[k] || !env[k]!.trim()) missing.push(k)
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  if (url && !/^https:\/\/.+\.supabase\.co\/?$/.test(url)) warnings.push('NEXT_PUBLIC_SUPABASE_URL does not look like a Supabase URL')
  if (env.REPOSITORY_DRIVER === 'supabase' && missing.length === 0) {
    warnings.push('REPOSITORY_DRIVER=supabase but the Supabase adapter is still a stub — see SUPABASE_CONNECTION_PLAN.md')
  }
  return { ok: missing.length === 0, missing, warnings }
}

/** Throw if the Supabase env is incomplete (call only before a real connection). */
export function assertSupabaseEnv(env: Record<string, string | undefined> = process.env): void {
  const r = validateSupabaseEnv(env)
  if (!r.ok) throw new Error(`Supabase env incomplete: missing ${r.missing.join(', ')}. DO NOT RUN WITHOUT OWNER APPROVAL.`)
}
