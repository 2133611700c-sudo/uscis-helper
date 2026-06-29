/**
 * piiGuard.test.ts — make the PII guard part of the test suite, not just CI.
 *
 * Enforces, on every `pnpm --filter web test`, that:
 *   (1) the detector actually FIRES (positive+negative self-test) — a guard that cannot
 *       detect is worse than none; and
 *   (2) NO real owner-PII token is present in any tracked file (the fictional-data rule).
 *
 * The guard lives at the repo root (scripts/check-no-pii.mjs) and computes its own REPO
 * from its file location, so it works regardless of vitest's cwd.
 */
import { describe, it, expect, vi } from 'vitest'

vi.setConfig({ testTimeout: 120_000 })

const guardUrl = new URL('../../../../../scripts/check-no-pii.mjs', import.meta.url).href
const { selfTest, scanRepo } = (await import(guardUrl)) as {
  selfTest: () => { ok: boolean; detail: unknown }
  scanRepo: () => { files: number; hits: Array<{ file: string; line: number; hint: string }> }
}

describe('PII guard', () => {
  it('detector fires — positive + negative + apostrophe-normalization self-test', () => {
    const r = selfTest()
    expect(r.ok, JSON.stringify(r.detail)).toBe(true)
  })

  it('no real owner-PII token in any tracked file (fictional data only)', () => {
    const { files, hits } = scanRepo()
    expect(files).toBeGreaterThan(100) // sanity: it actually scanned the tree
    // Redacted reporting: show file:line + category, never the value.
    expect(hits.map((h) => `${h.file}:${h.line} [${h.hint}]`)).toEqual([])
  })
})
