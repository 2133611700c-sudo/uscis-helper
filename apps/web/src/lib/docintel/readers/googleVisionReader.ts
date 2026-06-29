/**
 * googleVisionReader — DISABLED stub (Step A roster).
 *
 * Google Cloud Vision is currently OFF: the project's billing returns 403, so
 * the reader is gated behind GOOGLE_VISION_ENABLED + a credentials path. While
 * disabled, read() short-circuits to unavailableResult() and makes NO network
 * call. When re-enabled later, this is where the live Vision client is wired.
 */
import type { Reader } from './Reader'
import { unavailableResult } from './Reader'
import type { ReaderResult } from './ReaderResult'

const FAMILY = 'google_vision' as const

const ENABLED =
  process.env.GOOGLE_VISION_ENABLED === '1' && !!process.env.GOOGLE_APPLICATION_CREDENTIALS

export const googleVisionReader: Reader = {
  family: FAMILY,
  enabled: ENABLED,
  async read(_image: Buffer, _mimeType: string, _opts?: Record<string, unknown>): Promise<ReaderResult> {
    if (!this.enabled) {
      return unavailableResult(FAMILY, 'google_vision disabled (billing 403)')
    }
    // Live Google Vision client goes here once billing is restored.
    return unavailableResult(FAMILY, 'google_vision not implemented')
  },
}
