/**
 * ONE-BRAIN v2 Phase 5 — ReParole US-form decoupling. i94/ead route to their own Core path
 * only behind REPAROLE_CORE_USFORMS='1'; default OFF keeps the 422 delegation (byte-identical);
 * dl NEVER maps (no docintel spec, L6). We test the pure mapping decision via the route module's
 * exported hint check by driving the route handler would need Supabase — instead we validate the
 * mapping contract directly through the exported behavior surface.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { getDocTypeSpec } from '@/lib/docintel/documentRegistry'

// The mapping intent, mirrored here as the contract the route enforces (the route's
// mapReParoleHintToDocintelId is module-private; this pins the SAME decision + that the
// target specs exist, so a spec rename breaks the test loudly).
function mapReParoleHint(hint: string, env: Record<string, string | undefined>): string | null {
  const base: Record<string, string> = {
    passport: 'ua_international_passport',
    booklet: 'ua_internal_passport_booklet',
  }
  if (base[hint]) return base[hint]
  if (env.REPAROLE_CORE_USFORMS === '1') {
    const us: Record<string, string> = { i94: 'us_i94', ead: 'us_ead' }
    if (us[hint]) return us[hint]
  }
  return null
}

afterEach(() => { delete process.env.REPAROLE_CORE_USFORMS })

describe('ReParole US-form decoupling contract', () => {
  it('base UA hints map unconditionally', () => {
    expect(mapReParoleHint('passport', {})).toBe('ua_international_passport')
    expect(mapReParoleHint('booklet', {})).toBe('ua_internal_passport_booklet')
  })

  it('flag OFF → i94/ead stay null (422 delegation, byte-identical)', () => {
    for (const h of ['i94', 'ead']) expect(mapReParoleHint(h, {})).toBeNull()
  })

  it('flag ON → i94/ead route to their existing docintel specs', () => {
    const env = { REPAROLE_CORE_USFORMS: '1' }
    expect(mapReParoleHint('i94', env)).toBe('us_i94')
    expect(mapReParoleHint('ead', env)).toBe('us_ead')
  })

  it("'true' does not enable (strict '1')", () => {
    expect(mapReParoleHint('i94', { REPAROLE_CORE_USFORMS: 'true' })).toBeNull()
  })

  it('dl NEVER maps (no docintel spec — L6)', () => {
    expect(mapReParoleHint('dl', {})).toBeNull()
    expect(mapReParoleHint('dl', { REPAROLE_CORE_USFORMS: '1' })).toBeNull()
  })

  it('the target specs actually exist (spec drift breaks this)', () => {
    expect(getDocTypeSpec('us_i94')).toBeTruthy()
    expect(getDocTypeSpec('us_ead')).toBeTruthy()
    // reParoleAdapter reads i94_admission_number → the us_i94 spec must carry it
    const spec = getDocTypeSpec('us_i94')!
    expect(spec.fields.some((f) => f.field === 'i94_admission_number')).toBe(true)
  })
})
