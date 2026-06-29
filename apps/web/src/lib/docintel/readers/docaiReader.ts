/**
 * docaiReader — DISABLED stub (Step A roster).
 *
 * Google Document AI is OFF by default (DOCAI_ENABLED unset). While disabled,
 * read() short-circuits to unavailableResult() and makes NO network call. When
 * re-enabled later, this is where the live Document AI client is wired.
 */
import type { Reader } from './Reader'
import { unavailableResult } from './Reader'
import type { ReaderResult } from './ReaderResult'

const FAMILY = 'document_ai' as const

const ENABLED = process.env.DOCAI_ENABLED === '1'

export const docaiReader: Reader = {
  family: FAMILY,
  enabled: ENABLED,
  async read(_image: Buffer, _mimeType: string, _opts?: Record<string, unknown>): Promise<ReaderResult> {
    if (!this.enabled) {
      return unavailableResult(FAMILY, 'document_ai disabled (DOCAI_ENABLED unset)')
    }
    // Live Document AI client goes here once enabled.
    return unavailableResult(FAMILY, 'document_ai not implemented')
  },
}
