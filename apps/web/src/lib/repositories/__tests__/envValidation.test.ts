import { describe, it, expect } from 'vitest'
import { validateSupabaseEnv, assertSupabaseEnv } from '../envValidation'

describe('Supabase env validation (shape only; no connection)', () => {
  it('reports missing required vars', () => {
    const r = validateSupabaseEnv({})
    expect(r.ok).toBe(false)
    expect(r.missing).toContain('NEXT_PUBLIC_SUPABASE_URL')
    expect(r.missing).toContain('SUPABASE_SERVICE_ROLE_KEY')
  })
  it('ok when all present + well-formed url', () => {
    const r = validateSupabaseEnv({
      NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'svc', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
    })
    expect(r.ok).toBe(true)
  })
  it('warns on malformed url + on opt-in-while-stub', () => {
    const r = validateSupabaseEnv({
      NEXT_PUBLIC_SUPABASE_URL: 'http://nope', SUPABASE_SERVICE_ROLE_KEY: 's', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'a',
      REPOSITORY_DRIVER: 'supabase',
    })
    expect(r.warnings.join(' ')).toMatch(/Supabase URL/)
    expect(r.warnings.join(' ')).toMatch(/stub/)
  })
  it('assert throws when incomplete', () => {
    expect(() => assertSupabaseEnv({})).toThrow(/DO NOT RUN WITHOUT OWNER APPROVAL/)
  })
})
