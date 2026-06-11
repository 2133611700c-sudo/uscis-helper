/**
 * registryFlagGating.test.ts — Migration Plan step A pin.
 *
 * PASSPORT_SCHEMA_RENDERER_ENABLED is THE registration switch for the 3 staged
 * passport schemas: flag absent/OFF ⇒ byte-identical prod (legacy templates);
 * flag=1 ⇒ hasOfficialSchema flips ⇒ generate-pdf takes the mirror path live.
 * The flag must be read per call (env-stub works without re-import).
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { hasOfficialSchema, getOfficialSchema, officialSchemaDocTypes } from '../registry'

const STAGED = ['ua_internal_passport_booklet', 'ua_international_passport', 'ua_id_card']
const REGISTERED = [
  'ua_birth_certificate', 'ua_marriage_certificate', 'ua_divorce_certificate',
  'ua_death_certificate', 'ua_name_change_certificate', 'ua_military_id',
]

afterEach(() => vi.unstubAllEnvs())

describe('PASSPORT_SCHEMA_RENDERER_ENABLED gating', () => {
  it('flag OFF (absent): staged passport schemas do NOT resolve — prod unchanged', () => {
    vi.stubEnv('PASSPORT_SCHEMA_RENDERER_ENABLED', '')
    for (const d of STAGED) {
      expect(hasOfficialSchema(d), d).toBe(false)
      expect(getOfficialSchema(d)).toBeNull()
    }
    expect(officialSchemaDocTypes()).toEqual(REGISTERED)
  })

  it('flag OFF: any non-"1" value stays OFF (no truthy coercion)', () => {
    for (const v of ['0', 'true', 'on', 'yes']) {
      vi.stubEnv('PASSPORT_SCHEMA_RENDERER_ENABLED', v)
      expect(hasOfficialSchema('ua_internal_passport_booklet'), `value=${v}`).toBe(false)
    }
  })

  it('flag ON: all 3 staged schemas resolve with their own docType', () => {
    vi.stubEnv('PASSPORT_SCHEMA_RENDERER_ENABLED', '1')
    for (const d of STAGED) {
      expect(hasOfficialSchema(d), d).toBe(true)
      expect(getOfficialSchema(d)?.docType).toBe(d)
    }
    expect(officialSchemaDocTypes()).toEqual([...REGISTERED, ...STAGED])
  })

  it('flag ON does not disturb the 6 already-registered schemas', () => {
    vi.stubEnv('PASSPORT_SCHEMA_RENDERER_ENABLED', '1')
    for (const d of REGISTERED) expect(hasOfficialSchema(d), d).toBe(true)
  })
})
