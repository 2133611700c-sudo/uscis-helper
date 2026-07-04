/**
 * ONE-BRAIN v2 Phase 7 — recognizeDocument retry-on-empty (single-door replacement for the
 * translation route's separate "0 fields → second readDocument" legacy-fallback plane).
 * Byte-identical when the flag is OFF or the option is absent (exactly one read pass).
 * FICTIONAL data only.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { recognizeDocument } from '../recognizeDocument'

afterEach(() => { delete process.env.RECOGNIZE_RETRY_ON_EMPTY })

const okRead = (fields: Array<{ field: string; value: string }>) => ({
  ok: true,
  status: 'ok',
  ms: 1,
  model: 'mock',
  fields: fields.map((f) => ({
    field: f.field, kind: 'text', raw_cyrillic: null, value: f.value,
    confidence: 0.9, review_required: false, source: 'vision', provider: 'mock',
  })),
})
const emptyRead = () => ({ ok: true, status: 'ok', ms: 1, model: 'mock', fields: [] })

function stubReader(sequence: Array<ReturnType<typeof okRead> | ReturnType<typeof emptyRead>>) {
  let call = 0
  // one call per page; sequence is consumed per invocation
  return vi.fn(async () => sequence[Math.min(call++, sequence.length - 1)] as never)
}

const baseInput = (reader: ReturnType<typeof stubReader>, retry = true) => ({
  pages: [{ buffer: Buffer.from('x'), mime: 'image/jpeg' }],
  docTypeId: 'ua_international_passport',
  product: 'translation' as const,
  reader: reader as never,
  ...(retry ? { retryOnEmpty: { readOpts: { timeoutMs: 25_000 } } } : {}),
})

describe('recognizeDocument retry-on-empty', () => {
  it('flag OFF → exactly ONE read pass even with retryOnEmpty set (byte-identical)', async () => {
    const reader = stubReader([emptyRead()])
    await recognizeDocument(baseInput(reader))
    expect(reader).toHaveBeenCalledTimes(1)
  })

  it('flag ON + first pass empty → SECOND pass runs with the retry opts', async () => {
    process.env.RECOGNIZE_RETRY_ON_EMPTY = '1'
    const reader = stubReader([emptyRead(), okRead([{ field: 'family_name', value: 'Testenko' }])])
    const out = await recognizeDocument(baseInput(reader))
    expect(reader).toHaveBeenCalledTimes(2)
    // second call carried the retry opts (4th positional arg = readOpts)
    const secondCallArgs = reader.mock.calls[1] as unknown as unknown[]
    expect(secondCallArgs[3]).toMatchObject({ timeoutMs: 25_000 })
    expect(out.candidateCount).toBe(1)
  })

  it('flag ON but first pass NON-empty → no retry (single pass)', async () => {
    process.env.RECOGNIZE_RETRY_ON_EMPTY = '1'
    const reader = stubReader([okRead([{ field: 'family_name', value: 'Testenko' }])])
    await recognizeDocument(baseInput(reader))
    expect(reader).toHaveBeenCalledTimes(1)
  })

  it('flag ON, retryOnEmpty ABSENT → no retry (single pass)', async () => {
    process.env.RECOGNIZE_RETRY_ON_EMPTY = '1'
    const reader = stubReader([emptyRead()])
    await recognizeDocument(baseInput(reader, false))
    expect(reader).toHaveBeenCalledTimes(1)
  })

  it("'true' does NOT enable (strict '1')", async () => {
    process.env.RECOGNIZE_RETRY_ON_EMPTY = 'true'
    const reader = stubReader([emptyRead()])
    await recognizeDocument(baseInput(reader))
    expect(reader).toHaveBeenCalledTimes(1)
  })
})
