/**
 * tps-golden-path.spec.ts — TPS wizard browser E2E against a LIVE deployment
 * (E2E_BASE_URL), using the NO-OCR path so it needs ZERO secrets (no Gemini/Vision,
 * no real document, no PII). Issue #160 / #159 §C1.
 *
 * Test 1 (deterministic): navigate Initial → Paper → No-EAD → "Recognize documents →"
 *   (tps-ocr-cta, which advances to review regardless of uploads) → assert the REVIEW
 *   screen + the Part 7 declaration render. Proves the golden path is reachable.
 *
 * Test 2 (full path to the payment gate): the same, then fill the core identity fields
 *   (each "Edit" opens a native window.prompt(), handled via page.on('dialog')) + the
 *   manual fields + Part 7, then click Generate and assert the PAYWALL appears — a
 *   non-owner with no Stripe token must be gated. This proves the whole TPS golden path
 *   engages the payment gate. The actual ZIP download needs an owner session
 *   (OWNER_SESSION_SECRET) or a Stripe test token — a separate, owner-gated follow-up.
 */
import { test, expect, type Page } from '@playwright/test'

const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

test.use({ userAgent: UA }) // the app's anti-bot middleware 403s blank/curl UAs

/** Click the first visible, enabled button whose text matches `re`. */
async function clickButton(page: Page, re: RegExp, label: string) {
  const btn = page.locator('button', { hasText: re }).filter({ hasNot: page.locator('[disabled]') }).first()
  await expect(btn, `step button: ${label}`).toBeVisible({ timeout: 30_000 })
  await btn.click()
}

/** Navigate the wizard to the review screen via the no-OCR path. */
async function navigateToReview(page: Page) {
  await page.goto('/en/services/tps-ukraine/start', { waitUntil: 'domcontentloaded' })
  await clickButton(page, /Initial Registration|First time|Вперше|Впервые/i, 'Initial')
  await clickButton(page, /Paper filing|Paper|Поштою/i, 'Paper')
  await clickButton(page, /TPS only|^No$|Ні\b|Нет\b/i, 'No EAD')
  // "Recognize documents →" (tps-ocr-cta) is next={() => goto(5)} — advances to review
  // regardless of uploads, so with zero files it reaches review with no OCR.
  const ocrCta = page.getByTestId('tps-ocr-cta')
  await expect(ocrCta, 'step-4 advance (Recognize documents →)').toBeVisible({ timeout: 30_000 })
  await ocrCta.click()
  await expect(page.getByTestId('tps-review-step-container'), 'review container').toBeVisible({ timeout: 30_000 })
}

/** Edit an OCR-row field: its "Edit" button opens a native prompt() — accept it. */
async function editOcrField(page: Page, key: string, value: string) {
  const btn = page.getByTestId(`tps-ocr-edit-${key}`)
  if (!(await btn.isVisible().catch(() => false))) return
  page.once('dialog', (d) => d.accept(value).catch(() => {}))
  await btn.click()
  await page.waitForTimeout(150)
}

test('TPS golden path (no-OCR) navigates to the review screen + Part 7', async ({ page }) => {
  await navigateToReview(page)
  await expect(page.getByTestId('tps-part7-checkbox'), 'Part 7 declaration checkbox').toBeVisible({ timeout: 30_000 })
})

test('TPS golden path (no-OCR) fill → generate → payment gate (non-owner)', async ({ page }) => {
  await navigateToReview(page)

  // Core identity fields (OCR rows; each "Edit" is a native prompt). Latin values +
  // ISO dates satisfy the Latin-firewall + minimal-completeness gate.
  const ocr: Array<[string, string]> = [
    ['family_name', 'Shevchenko'],
    ['given_name', 'Taras'],
    ['dob', '1990-01-15'],
    ['sex', 'M'],
    ['passport_number', 'FA123456'],
    ['passport_expiration_date', '2030-12-31'],
    ['country_of_nationality', 'Ukraine'],
    ['i94_admission_number', '12345678901'],
    ['last_entry_date', '2024-06-01'],
    ['status_at_last_entry', 'Parole'],
  ]
  for (const [k, v] of ocr) await editOcrField(page, k, v)

  // Secondary manual fields (direct inputs).
  const manual: Array<[string, string]> = [
    ['tps-review-manual-address-street', '123 Main St'],
    ['tps-review-manual-address-city', 'Los Angeles'],
    ['tps-review-manual-address-state', 'CA'],
    ['tps-review-manual-address-zip', '90038'],
    ['tps-review-manual-phone', '2130000000'],
    ['tps-review-manual-email', 'e2e@example.com'],
    ['tps-review-manual-city-of-birth', 'Kyiv'],
    ['tps-review-manual-province-of-birth', 'Kyiv Oblast'],
    ['tps-review-manual-place-of-last-entry', 'New York, NY'],
  ]
  for (const [tid, val] of manual) {
    const f = page.getByTestId(tid)
    if (await f.isVisible().catch(() => false)) await f.fill(val).catch(() => {})
  }

  await page.getByTestId('tps-part7-checkbox').check()

  // With identity complete + Part 7 confirmed, the Generate CTA renders.
  const cta = page.getByTestId('tps-generate-cta')
  await expect(cta, 'generate CTA after completing the form').toBeVisible({ timeout: 30_000 })
  await cta.click()

  // Non-owner, no Stripe token → the payment gate must engage (no free packet).
  await expect(page.getByTestId('tps-paywall-state'), 'payment gate (paywall)').toBeVisible({ timeout: 30_000 })
  // Hard proof there is NO free bypass: the package-ready state must NOT appear.
  await expect(page.getByTestId('tps-package-ready-state')).toHaveCount(0)
  console.log(JSON.stringify({ tps_full_path: 'reached_paywall_no_free_bypass' }))
})
