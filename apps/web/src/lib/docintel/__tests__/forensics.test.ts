import { describe, it, expect } from 'vitest'
import { isForensicEnabled, hashShort, sha256Hex, safeDigest, type ForensicRecord } from '../forensics'

describe('forensics logger', () => {
  it('is OFF by default; only FORENSIC_LOG_ENABLED=1 turns it on', () => {
    expect(isForensicEnabled({} as NodeJS.ProcessEnv)).toBe(false)
    expect(isForensicEnabled({ FORENSIC_LOG_ENABLED: '0' } as unknown as NodeJS.ProcessEnv)).toBe(false)
    expect(isForensicEnabled({ FORENSIC_LOG_ENABLED: 'true' } as unknown as NodeJS.ProcessEnv)).toBe(false)
    expect(isForensicEnabled({ FORENSIC_LOG_ENABLED: '1' } as unknown as NodeJS.ProcessEnv)).toBe(true)
  })

  it('hashShort is stable, 12-hex, and NEVER returns the raw input (non-reversible)', () => {
    const v = 'Куроп’ятник'
    const h = hashShort(v)
    expect(h).toBe(hashShort(v))           // stable
    expect(h).toMatch(/^[0-9a-f]{12}$/)    // 12 hex
    expect(h).not.toContain('Куроп')       // never leaks the value
    expect(hashShort(null)).toBeNull()
    expect(hashShort(undefined)).toBeNull()
  })

  it('sha256Hex is a stable 64-hex digest', () => {
    expect(sha256Hex('abc')).toBe(sha256Hex(Buffer.from('abc')))
    expect(sha256Hex('abc')).toMatch(/^[0-9a-f]{64}$/)
  })

  it('safeDigest (console copy) contains NO raw PII values — only hashes + names', () => {
    const rec: ForensicRecord = {
      run_id: 'vx-test-p1',
      timestamp: '2026-06-27T00:00:00.000Z',
      doc_type_id: 'ua_birth_certificate',
      source_sha256: sha256Hex('photo-bytes'),
      source_dimensions: { width: 2304, height: 3072 },
      exif_orientation: 6,
      preprocess: { rotation_applied: null, output_dimensions: { width: 2304, height: 3072 } },
      orientation_applied_cw: 0,
      reader: {
        provider: 'gemini', requested_model: 'gemini-2.5-pro', actual_model: 'gemini-2.5-pro',
        fallback_used: false, temperature: 0, attempts: [{ n: 1, model: 'gemini-2.5-pro', selected: true, ms: 1234 }],
        status: 'ok', error: null, ms: 1234,
      },
      fields: [
        { field: 'family_name', raw_value: 'СЕКРЕТ_ФАМИЛИЯ', language_route: 'ru', normalizers: ['kmu55'], final_value: 'SECRET_SURNAME', review_required: true },
      ],
    }
    const digest = JSON.stringify(safeDigest(rec))
    // The raw + final values must NOT appear anywhere in the console digest.
    expect(digest).not.toContain('СЕКРЕТ_ФАМИЛИЯ')
    expect(digest).not.toContain('SECRET_SURNAME')
    // But the field NAME, hashes, model, dims, orientation MUST be present (forensic value).
    expect(digest).toContain('family_name')
    expect(digest).toContain(hashShort('СЕКРЕТ_ФАМИЛИЯ')!)
    expect(digest).toContain('gemini-2.5-pro')
  })
})
