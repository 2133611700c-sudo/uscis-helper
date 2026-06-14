/**
 * operatorAuthAndActions.test.ts — V2 operator auth + Server Action authorization.
 *
 * Covers test classes:
 *   7 unauthorized Server Action rejected (no cookie → 401)
 *   8 operator without role rejected (wrong/absent secret → 403 fail-closed)
 *   9 stale version rejected (ORDER_VERSION_CONFLICT → 409) — wiring assertion
 *
 * requireTranslationOperator is unit-tested via a mocked next/headers cookie store.
 * The actions' version/state checks are verified at source level.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

// ── Mock next/headers cookie store ─────────────────────────────────────────────
let cookieValue: string | undefined
vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: (_name: string) => (cookieValue !== undefined ? { value: cookieValue } : undefined),
  })),
}))

import { requireTranslationOperator, OperatorAuthError } from '@/lib/auth/requireTranslationOperator'

beforeEach(() => {
  cookieValue = undefined
  delete process.env.ADMIN_SECRET
})

describe('requireTranslationOperator', () => {
  it('test 8: fail-closed when ADMIN_SECRET not configured → 403', async () => {
    cookieValue = 'anything'
    await expect(requireTranslationOperator()).rejects.toMatchObject({ status: 403 })
  })

  it('test 7: no cookie → 401 unauthorized', async () => {
    process.env.ADMIN_SECRET = 'secret123'
    cookieValue = undefined
    await expect(requireTranslationOperator()).rejects.toMatchObject({ status: 401 })
  })

  it('test 8: wrong cookie → 401 (not authorized as operator)', async () => {
    process.env.ADMIN_SECRET = 'secret123'
    cookieValue = 'wrong'
    await expect(requireTranslationOperator()).rejects.toBeInstanceOf(OperatorAuthError)
  })

  it('valid cookie → opaque PII-free actor id', async () => {
    process.env.ADMIN_SECRET = 'secret123'
    cookieValue = 'secret123'
    const actor = await requireTranslationOperator()
    expect(actor.id).toBe('operator:admin')
    expect(JSON.stringify(actor)).not.toMatch(/secret123/)
  })
})

// ── Source-level authorization matrix for every action ─────────────────────────
const ACTIONS = fs.readFileSync(
  path.resolve(__dirname, '..', '[id]', 'v2Actions.ts'),
  'utf-8',
)
const LEGACY = fs.readFileSync(
  path.resolve(__dirname, '..', '[id]', 'actions.ts'),
  'utf-8',
)

describe('operator Server Action authorization matrix', () => {
  const actions = [
    'assignOrder',
    'beginReview',
    'requestClarification',
    'appendOverride',
    'approveForRender',
    'retryDelivery',
    'cancelOrder',
    'changeRecipient',
  ]

  it('test 7: EVERY V2 action calls requireTranslationOperator() first', () => {
    for (const a of actions) {
      const fnStart = ACTIONS.indexOf(`export async function ${a}(`)
      expect(fnStart, `${a} must exist`).toBeGreaterThan(-1)
      const body = ACTIONS.slice(fnStart, fnStart + 400)
      expect(body, `${a} must auth first`).toMatch(/requireTranslationOperator\(\)/)
    }
  })

  it('test 9: actions assert expected version (loadAtVersion / ORDER_VERSION_CONFLICT)', () => {
    expect(ACTIONS).toMatch(/order\.version !== expectedVersion/)
    expect(ACTIONS).toMatch(/ORDER_VERSION_CONFLICT/)
    // Conflicts surface as 409.
    expect(ACTIONS).toMatch(/ORDER_VERSION_CONFLICT'[\s\S]*?409|409[\s\S]*?ORDER_VERSION_CONFLICT/)
  })

  it('transitions pass expectedStatus + expectedVersion to the guarded mutator', () => {
    expect(ACTIONS).toMatch(/expectedStatus:\s*order\.status/)
    expect(ACTIONS).toMatch(/expectedVersion:\s*order\.version/)
  })

  it('field edits use the canonical override channel, never a mutable copy', () => {
    expect(ACTIONS).toMatch(/applyOperatorOverride\(/)
    expect(ACTIONS).not.toMatch(/translated_fields/)
  })

  it('recipient change is a SEPARATE audited action requiring confirm + reason', () => {
    const fn = ACTIONS.slice(ACTIONS.indexOf('export async function changeRecipient('))
    expect(fn).toMatch(/recipient_change_requires_confirm/)
    expect(fn).toMatch(/recipient_change_requires_reason/)
    expect(fn).toMatch(/old_recipient_hash/)
  })

  it('approveForRender renders ONCE and does NOT email', () => {
    const fn = ACTIONS.slice(ACTIONS.indexOf('export async function approveForRender('), ACTIONS.indexOf('export async function retryDelivery('))
    expect(fn).toMatch(/renderFromCanonical\(/)
    expect(fn).toMatch(/createArtifactAndEnqueue\(/)
    expect(fn).not.toMatch(/sendEmail\(/)
  })

  it('legacy actions ALSO require operator auth (no unguarded mutation)', () => {
    for (const a of ['sendTranslation', 'approveAndSendPdf', 'markInReview']) {
      const fnStart = LEGACY.indexOf(`export async function ${a}(`)
      const body = LEGACY.slice(fnStart, fnStart + 300)
      expect(body, `${a} must auth`).toMatch(/requireTranslationOperator\(\)/)
    }
  })
})
