/**
 * correctFieldOverrideLoop.test.ts — canonical override-loop wiring in the LIVE
 * correction route, now on the in-memory repository (Supabase decoupled).
 *
 * Proves at the ROUTE boundary:
 *   - flag OFF (default) → override helper NEVER called; correction still recorded;
 *     canonical_loop==='off'.
 *   - flag shadow + canonical_document_id present → helper called once; correction
 *     still recorded; canonical_loop==='appended'.
 *   - flag shadow + NO canonical_document_id → helper NOT called (fail-safe);
 *     canonical_loop==='skipped_no_id'.
 *   - raw value preserved through the correction.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Override-loop helper mock (spy) — its e2e behaviour is covered in overrideLoop.test.ts.
const appendSpy = vi.fn(async () => ({ ok: true as const, newVersion: 1, expectedVersion: 0 }))
vi.mock('@/lib/canonical/overrideLoop', () => ({
  appendCorrectionAsCanonicalOverride: (...args: unknown[]) => appendSpy(...(args as [])),
}))

import { POST } from '../correct-field/route'
import { getRepositories, __resetInMemoryRepositories } from '@/lib/repositories'
import type { FieldRecord } from '@/lib/repositories'

const SESSION = '22222222-2222-2222-2222-222222222222'
const CANON = '33333333-3333-3333-3333-333333333333'
const AT = '2026-06-28T00:00:00Z'

function req(body: unknown) {
  return new Request('http://test/correct-field', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }) as unknown as import('next/server').NextRequest
}
const ctx = () => ({ params: Promise.resolve({ sessionId: SESSION }) })

async function seed() {
  __resetInMemoryRepositories()
  const r = getRepositories({})
  await r.documents.createSession({ sessionId: SESSION, docType: 'ua_birth_certificate', status: 'reviewing', createdAt: AT, updatedAt: AT })
  const fields: FieldRecord[] = [
    { sessionId: SESSION, field: 'surname', rawValue: "Солов'як", normalizedValue: 'Old', reviewRequired: true, confirmed: false },
  ]
  await r.review.upsertFields(SESSION, fields)
}

describe('correct-field route — override loop wiring (in-memory repository)', () => {
  const orig = process.env.CANONICAL_OVERRIDE_LOOP
  beforeEach(async () => { appendSpy.mockClear(); await seed() })
  afterEach(() => { if (orig === undefined) delete process.env.CANONICAL_OVERRIDE_LOOP; else process.env.CANONICAL_OVERRIDE_LOOP = orig })

  it('OFF: helper NOT called; correction recorded; raw preserved', async () => {
    delete process.env.CANONICAL_OVERRIDE_LOOP
    const res = await POST(req({ field: 'surname', new_value: 'Kovalenko', canonical_document_id: CANON }), ctx())
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.canonical_loop).toBe('off')
    expect(json.correction_id).toBeTruthy()
    expect(appendSpy).not.toHaveBeenCalled()
    const f = await getRepositories({}).review.getField(SESSION, 'surname')
    expect(f?.normalizedValue).toBe('Kovalenko')
    expect(f?.rawValue).toBe("Солов'як") // raw preserved
    expect(f?.confirmed).toBe(true)
  })

  it('shadow + id → helper called once; canonical_loop appended', async () => {
    process.env.CANONICAL_OVERRIDE_LOOP = 'shadow'
    const res = await POST(req({ field: 'surname', new_value: 'Kovalenko', canonical_document_id: CANON }), ctx())
    const json = await res.json()
    expect(json.canonical_loop).toBe('appended')
    expect(appendSpy).toHaveBeenCalledTimes(1)
    expect(json.correction_id).toBeTruthy()
  })

  it('shadow + NO id → helper NOT called; canonical_loop skipped_no_id', async () => {
    process.env.CANONICAL_OVERRIDE_LOOP = 'shadow'
    const res = await POST(req({ field: 'surname', new_value: 'Kovalenko' }), ctx())
    const json = await res.json()
    expect(json.canonical_loop).toBe('skipped_no_id')
    expect(appendSpy).not.toHaveBeenCalled()
  })

  it('404 for valid-but-unseeded field; 404 for unknown session', async () => {
    // given_names is a valid field name but not seeded for this session → field_not_found.
    expect((await POST(req({ field: 'given_names', new_value: 'Ivan' }), ctx())).status).toBe(404)
    const other = { params: Promise.resolve({ sessionId: '44444444-4444-4444-4444-444444444444' }) }
    expect((await POST(req({ field: 'surname', new_value: 'Kovalenko' }), other)).status).toBe(404)
  })
})
