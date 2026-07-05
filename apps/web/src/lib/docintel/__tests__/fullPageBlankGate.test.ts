import sharp from 'sharp'
import { describe, it, expect, vi } from 'vitest'
import { readDocument } from '../documentFieldReader'

async function blankPage(): Promise<Buffer> {
  return sharp({ create: { width: 1600, height: 2200, channels: 3, background: '#ffffff' } }).png().toBuffer()
}

describe('readDocument — full-page blank gate', () => {
  it('blank full-page input fails closed before provider invocation', async () => {
    const provider = {
      name: 'stub',
      readFields: vi.fn(async () => {
        throw new Error('provider should not be called on blank pages')
      }),
    }

    const res = await readDocument(await blankPage(), 'image/png', 'ua_birth_certificate', {
      provider,
    })

    expect(provider.readFields).not.toHaveBeenCalled()
    expect(res.ok).toBe(false)
    expect(res.status).toBe('blank_crop_or_low_ink')
    expect(res.provider_error?.error_code).toBe('OCR_EMPTY_OR_LOW_INK')
    expect(res.fields).toHaveLength(0)
  })
})
