/**
 * Reader stubs — disabled-by-default roster (Step A).
 *
 * Each non-Gemini reader is OFF at default env and MUST fail closed:
 *  - enabled === false
 *  - read() -> status:'unavailable', abstained:true, fields:[]
 *  - NO network call (global.fetch is a throwing spy; assert it was not called).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { unavailableResult } from '../Reader'
import type { Reader } from '../Reader'
import { googleVisionReader } from '../googleVisionReader'
import { docaiReader } from '../docaiReader'
import { htrReader } from '../htrReader'

const realFetch = global.fetch

const fetchSpy = vi.fn(() => {
  throw new Error('stub reader made a network call')
})

beforeEach(() => {
  // Any fetch from a disabled stub throws -> test fails loudly.
  global.fetch = fetchSpy as unknown as typeof fetch
  fetchSpy.mockClear()
})

afterEach(() => {
  global.fetch = realFetch
})

const stubs: Array<[string, Reader]> = [
  ['googleVisionReader', googleVisionReader],
  ['docaiReader', docaiReader],
  ['htrReader', htrReader],
]

describe('Reader stubs — disabled by default, fail closed, no network', () => {
  for (const [name, reader] of stubs) {
    it(`${name} is disabled at default env`, () => {
      expect(reader.enabled).toBe(false)
    })

    it(`${name}.read() returns unavailable + abstained + no fields, no network`, async () => {
      const result = await reader.read(Buffer.from([0x00, 0x01]), 'image/png')
      expect(result.readerFamily).toBe(reader.family)
      expect(result.status).toBe('unavailable')
      expect(result.abstained).toBe(true)
      expect(result.fields).toEqual([])
      expect(result.ms).toBe(0)
      expect(typeof result.error).toBe('string')
      expect(fetchSpy).not.toHaveBeenCalled()
    })
  }

  it('unavailableResult helper has the canonical shape', () => {
    const r = unavailableResult('document_ai', 'because')
    expect(r).toMatchObject({
      readerFamily: 'document_ai',
      model: null,
      status: 'unavailable',
      fields: [],
      abstained: true,
      ms: 0,
      error: 'because',
    })
  })
})
