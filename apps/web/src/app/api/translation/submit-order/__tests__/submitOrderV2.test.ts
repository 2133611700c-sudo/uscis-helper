/**
 * submitOrderV2.test.ts — submit-order V2 contract (Phase 2, Agent 2).
 *
 * Source-level wiring verification (no live Stripe/Supabase). Covers test classes:
 *   1 client field VALUES are ignored for binding (not authoritative)
 *   2 canonical binding path present
 *   3 wrong product → 403
 *   4 wrong session ownership → 403
 *   5 bogus canonical → 404
 *   6 duplicate submit reuses one order (createOrGetOrder idempotency)
 *  18 no applicant field values in logs (PII-free)
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const SRC = fs.readFileSync(path.resolve(__dirname, '..', 'route.ts'), 'utf-8')

describe('submit-order V2 route contract', () => {
  it('test 1: recipient email comes from Stripe, NOT client body', () => {
    // The recipient is derived inside the unified handler from the verified Stripe SESSION only;
    // submit-order passes the server-retrieved session (v.session), never a client email.
    expect(SRC).toMatch(/verifiedSession:\s*reconcileSession/)
    // The body type has no email field — recipient is never read from the client.
    expect(SRC).not.toMatch(/body\.(recipient_email|email)/)
  })

  it('test 1: client field VALUES are not authoritative (comment + binding uses only canonical id)', () => {
    expect(SRC).toMatch(/VALUES are NOT authoritative/)
    // The binding uses verifiedCanonicalId, never body.fields values.
    expect(SRC).toMatch(/canonical_document_id:\s*verifiedCanonicalId/)
  })

  it('closeout: webhook is authority; submit-order is client_reconciliation via shared handler', () => {
    expect(SRC).toMatch(/handleVerifiedPayment\(/)
    expect(SRC).toMatch(/source:\s*'client_reconciliation'/)
    // Passes the server-retrieved Stripe session, not a client-built one.
    expect(SRC).toMatch(/v\.session/)
  })

  it('test 2: canonical binding path — load + verify + bind', () => {
    expect(SRC).toMatch(/loadCanonicalDocumentById\(canonicalId\)/)
    expect(SRC).toMatch(/verifyCanonicalHash\(canonicalId\)/)
    expect(SRC).toMatch(/bindCanonicalDocument\(/)
  })

  it('test 3: wrong product canonical → 403', () => {
    expect(SRC).toMatch(/canonical\.product !== 'translation'[\s\S]*?canonical_wrong_product', 403/)
  })

  it('test 4: session ownership mismatch → 403', () => {
    expect(SRC).toMatch(/documentSessionId !== checkoutId[\s\S]*?canonical_session_mismatch', 403/)
  })

  it('test 5: canonical not found → 404', () => {
    expect(SRC).toMatch(/if \(!canonical\)\s*{\s*return err\('canonical_not_found', 404\)/)
  })

  it('status matrix: 402 unpaid, 422 malformed, 409 conflict, 503 infra', () => {
    expect(SRC).toMatch(/payment_not_confirmed', 402/)
    expect(SRC).toMatch(/missing_checkout_id', 422/)
    expect(SRC).toMatch(/canonical_hash_mismatch', 409/)
    expect(SRC).toMatch(/canonical_binding_conflict', 409/)
    expect(SRC).toMatch(/503/)
  })

  it('test 6: idempotent order reuse via the unified handler (idempotent on checkout_session_id)', () => {
    // Idempotency now lives in handleVerifiedPayment (createOrGetOrder on checkout_session_id).
    expect(SRC).toMatch(/handleVerifiedPayment\(/)
    expect(SRC).toMatch(/orderReused\s*=\s*result\.reused/)
  })

  it('rollout: gated by getCanonicalMode(translation); legacy queue still written', () => {
    expect(SRC).toMatch(/getCanonicalMode\('translation'\)/)
    expect(SRC).toMatch(/mode !== 'off'/)
    // Legacy back-compat path always present.
    expect(SRC).toMatch(/createManualReviewTicket\(/)
  })

  it("enforce mode requires a canonical id", () => {
    expect(SRC).toMatch(/mode === 'enforce' && !canonicalId[\s\S]*?canonical_document_id_required', 422/)
  })

  it('test 18: PII-free logging — no field values in console.info', () => {
    // The log object logs counts/ids/booleans only — never sourceFields values.
    const logBlock = SRC.slice(SRC.indexOf("console.info('[submit-order]'"))
    expect(logBlock).toMatch(/fields:\s*Object\.keys\(sourceFields\)\.length/)
    expect(logBlock).not.toMatch(/sourceFields\[/)
    expect(logBlock).toMatch(/has_email:\s*!!v\.customerEmail/) // boolean, not the email
  })
})
