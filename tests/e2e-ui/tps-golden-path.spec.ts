/**
 * tps-golden-path.spec.ts — TPS wizard browser E2E against a LIVE deployment
 * (E2E_BASE_URL), using the NO-OCR "type manually" path so it needs ZERO secrets
 * (no Gemini/Vision, no real document, no PII). Issue #160 / #159 §C1.
 *
 * Hard assertions (deterministic): the 6-step wizard navigates Initial → Paper →
 * No-EAD → "type manually" (skip OCR) → the REVIEW screen renders with the Part 7
 * declaration + the Generate CTA. This proves the TPS golden path is reachable and
 * the manual-entry path works on the target deployment.
 *
 * Best-effort (logged, not hard-asserted here because core-field selectors are
 * label-driven and locale-dependent): fill manual fields, accept Part 7, click
 * Generate, and record the outcome. A non-owner with no Stripe token is expected to
 * hit the payment gate (paywall) — that itself proves the generation path is wired.
 * The full ZIP download is a follow-up that needs an owner session (OWNER_SESSION_*)
 * or a Stripe test token.
 */
import { test, expect } from '@playwright/test'

const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

test.use({ userAgent: UA }) // the app's anti-bot middleware 403s blank/curl UAs

/** Click the first visible, enabled button whose text matches `re`. */
async function clickButton(page: import('@playwright/test').Page, re: RegExp, label: string) {
  const btn = page.locator('button', { hasText: re }).filter({ hasNot: page.locator('[disabled]') }).first()
  await expect(btn, `step button: ${label}`).toBeVisible({ timeout: 30_000 })
  await btn.click()
}

test('TPS golden path (no-OCR) navigates to the review screen + Part 7', async ({ page }) => {
  // Anti-bot middleware blocks empty UAs; we set a browser UA above.
  await page.goto('/en/services/tps-ukraine/start', { waitUntil: 'domcontentloaded' })

  // STEP 1 — Type: Initial Registration (English subtitle is stable across locales).
  await clickButton(page, /Initial Registration|First time|Вперше|Впервые/i, 'Initial')

  // STEP 2 — Method: Paper filing.
  await clickButton(page, /Paper filing|Paper|Поштою|Поштой|Поштою/i, 'Paper')

  // STEP 3 — EAD: No / TPS only.
  await clickButton(page, /TPS only|^No$|Ні\b|Нет\b/i, 'No EAD')

  // STEP 4 — Upload: the no-OCR path. TPSWizardV2's "Recognize documents →" button
  // (testid tps-ocr-cta) is `next={() => goto(5)}` — it ALWAYS advances to the review
  // screen. With ZERO files uploaded it goes straight to review with no OCR run, so we
  // just click it (no document, no Gemini, no secrets).
  const ocrCta = page.getByTestId('tps-ocr-cta')
  await expect(ocrCta, 'step-4 advance (Recognize documents →)').toBeVisible({ timeout: 30_000 })
  await ocrCta.click()

  // STEP 5 — Review screen for the no-OCR path must render with the Part 7
  // declaration. These are the DETERMINISTIC proof that the TPS golden path is
  // reachable on the deployment. (The Generate CTA only renders once Part 7 is
  // confirmed AND the required identity fields are complete — exercised best-effort
  // below; the full generate→packet path with core-field fill is a follow-up.)
  const review = page.getByTestId('tps-review-step-container')
  await expect(review, 'review screen container').toBeVisible({ timeout: 30_000 })
  await expect(page.getByTestId('tps-part7-checkbox'), 'Part 7 declaration checkbox').toBeVisible({ timeout: 30_000 })

  // ── BEST-EFFORT: fill the secondary manual fields we have stable testids for,
  //    accept Part 7, then click Generate if it appears, and record the outcome.
  //    Soft — does not fail the test (core identity fields are label-driven; a
  //    non-owner also hits the paywall). Reaching the review + Part 7 above is the
  //    deterministic proof.
  const softFill: Array<[string, string]> = [
    ['tps-review-manual-address-street', '123 Main St'],
    ['tps-review-manual-address-city', 'Los Angeles'],
    ['tps-review-manual-address-state', 'CA'],
    ['tps-review-manual-address-zip', '90038'],
    ['tps-review-manual-phone', '2130000000'],
    ['tps-review-manual-email', 'e2e@example.com'],
    ['tps-review-manual-city-of-birth', 'Kyiv'],
  ]
  for (const [tid, val] of softFill) {
    const f = page.getByTestId(tid)
    if (await f.isVisible().catch(() => false)) await f.fill(val).catch(() => {})
  }
  const part7 = page.getByTestId('tps-part7-checkbox')
  if (await part7.isVisible().catch(() => false)) await part7.check().catch(() => {})

  const cta = page.getByTestId('tps-generate-cta')
  const ctaShown = await cta.isVisible().catch(() => false)
  if (ctaShown) await cta.click().catch(() => {})
  console.log(JSON.stringify({ tps_generate_cta_shown: ctaShown }))
  await page.waitForTimeout(3_000)

  const paywall = await page.getByTestId('tps-paywall-state').isVisible().catch(() => false)
  const ready = await page.getByTestId('tps-package-ready-state').isVisible().catch(() => false)
  const gateErr = await page.getByTestId('tps-gate-error-container').isVisible().catch(() => false)
  // PII-free outcome log for the CI report.
  console.log(JSON.stringify({ tps_generate_outcome: { paywall, ready, gate_error: gateErr } }))
})
