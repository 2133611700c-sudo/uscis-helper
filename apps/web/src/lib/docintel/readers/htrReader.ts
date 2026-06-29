/**
 * htrReader — DISABLED stub (Step A roster).
 *
 * The handwriting reader is the key-free raxtemur/trocr-base-ru sidecar
 * (ADR-026): on a NATIVE-resolution crop + contrast it reads cursive UA/RU
 * Cyrillic better than the LLMs, but it is OFF by default (no HTR_SIDECAR_URL).
 * While disabled, read() short-circuits to unavailableResult() and makes NO
 * network call.
 *
 * NOTE for when this is enabled later: raxtemur CANNOT abstain — it fabricates
 * on a blank/illegible crop. So its field observations carry abstained:false
 * together with a confidence, and the Decision Engine gates every non-exact
 * read behind mandatory human review downstream. This reader never accepts.
 */
import type { Reader } from './Reader'
import { unavailableResult } from './Reader'
import type { ReaderResult } from './ReaderResult'

const FAMILY = 'htr' as const

const ENABLED = !!(process.env.HTR_SIDECAR_URL || '').trim()

export const htrReader: Reader = {
  family: FAMILY,
  enabled: ENABLED,
  async read(_image: Buffer, _mimeType: string, _opts?: Record<string, unknown>): Promise<ReaderResult> {
    if (!this.enabled) {
      return unavailableResult(FAMILY, 'htr disabled (HTR_SIDECAR_URL unset)')
    }
    // Live raxtemur sidecar call goes here once HTR_SIDECAR_URL is set.
    // Observations will carry abstained:false + confidence (review-gated downstream).
    return unavailableResult(FAMILY, 'htr not implemented')
  },
}
