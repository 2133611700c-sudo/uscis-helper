/**
 * tests/e2e/translation-live-review.spec.ts — LIVE Translation wizard E2E (audit item 5).
 *
 * Drives the REAL TranslateWizard against a REAL server and a REAL document upload —
 * no page.route mocks. Proves the product path a user actually walks:
 *   /services/translate-document/start → upload → "Recognize document" → review screen
 * and asserts the review screen practices HONEST UNCERTAINTY: fields render AND
 * review-required state is visible (never silently confirmed).
 *
 * PII-SAFE BY CONSTRUCTION: the document path comes ONLY from E2E_TRANSLATION_DOC
 * (gitignored env); without it the test SKIPS. No document data is asserted by value —
 * only structural truths (field rows exist, review state shown). COST: one real OCR call
 * per run on the target — do not loop.
 *
 * Run (against a locally running server):
 *   PLAYWRIGHT_BASE_URL=http://localhost:3333 \
 *   E2E_TRANSLATION_DOC=/abs/path/to/doc.jpg \
 *   pnpm --filter web exec playwright test translation-live-review --project=chromium
 */
import { test, expect } from '@playwright/test'
import path from 'path'
import { promises as fs } from 'fs'

const DOC = process.env.E2E_TRANSLATION_DOC

test('translation wizard: real upload → recognize → review shows fields + honest review state', async ({ page }) => {
  test.skip(!DOC, 'E2E_TRANSLATION_DOC not set — live doc E2E skipped (PII-safe default)')
  test.setTimeout(300_000)
  const artifactsDir = path.resolve(process.cwd(), 'test-results', 'translation-live-artifacts')
  await fs.mkdir(artifactsDir, { recursive: true })

  await page.goto('/en/services/translate-document/start', { waitUntil: 'networkidle' })

  // Step 1 — intro: "Start translation →". Retry the click until step 2 renders
  // (first click can race React hydration on a dev server).
  const startBtn = page.getByRole('button', { name: /Start translation|Начать перевод/i })
  const step2Heading = page.getByText(/Which document|Какой документ/i).first()
  for (let i = 0; i < 5; i++) {
    if (await step2Heading.isVisible().catch(() => false)) break
    await startBtn.click().catch(() => {})
    await page.waitForTimeout(1500)
  }
  await expect(step2Heading).toBeVisible({ timeout: 15_000 })

  // Step 2 — document type: pick the first VISIBLE document card (deterministic default).
  const docCard = page.locator('.tw-doc-name:visible').first()
  await docCard.scrollIntoViewIfNeeded()
  await docCard.click()
  const s2next = page.getByRole('button', { name: /→/ }).last()
  if (await s2next.isVisible().catch(() => false)) await s2next.click()
  // Step 3 — upload screen ("Upload your document" heading).
  await expect(page.getByRole('heading', { name: /Upload|Загрузите|Завантаж/i })).toBeVisible({ timeout: 15_000 })

  const fileInput = page.locator('input[type="file"]').first()
  await expect(fileInput).toBeAttached({ timeout: 15_000 })
  await fileInput.setInputFiles(DOC as string)
  await page.screenshot({ path: path.join(artifactsDir, '1-uploaded.png') })

  // Fire recognition (RU/EN CTA variants; the count-suffixed variant matches too).
  const recognize = page.getByRole('button', { name: /Recognize|Распознать/i }).first()
  await expect(recognize).toBeVisible({ timeout: 15_000 })
  await recognize.click()

  // Real OCR: wait for the review screen — field rows appear, or the wizard surfaces the
  // honest unavailable message (provider down => the test records WHICH truth happened).
  const fieldRow = page.locator('input[type="text"], [data-field], td, [class*="field"]')
  const unavailable = page.getByText(/temporarily unavailable|временно недоступ/i)
  await Promise.race([
    fieldRow.first().waitFor({ state: 'visible', timeout: 180_000 }),
    unavailable.first().waitFor({ state: 'visible', timeout: 180_000 }),
  ])
  await page.screenshot({ path: path.join(artifactsDir, '2-after-recognize.png'), fullPage: true })

  if (await unavailable.count()) {
    // Honest-degradation path reached the USER — that is itself a verified product truth,
    // but the field-review assertion below cannot run. Fail with a clear marker so the
    // run is re-done when the provider is healthy (never report this as review-proof).
    throw new Error('HONEST_UNAVAILABLE_SHOWN — provider down during run; rerun for review-screen proof')
  }

  // Review screen truths (structure only, no values). The wizard's review contract
  // (s5): read-only rows with per-field "Edit value" buttons; review-required rows
  // carry the corrected-badge; the screen shows the compare-with-original warning.
  await expect(page.getByRole('heading', { name: /Translation ready|Перевод готов|Переклад готов/i }))
    .toBeVisible({ timeout: 60_000 })
  const editButtons = page.getByRole('button', { name: /Edit value|Edit|✏️/i })
  await expect
    .poll(async () => editButtons.count(), { timeout: 60_000 })
    .toBeGreaterThanOrEqual(3) // a real doc yields several editable field rows
  // Honest uncertainty: the review instruction block is visible to the user.
  await expect(page.getByText(/Review the data|Проверьте данные|If anything is wrong/i).first())
    .toBeVisible({ timeout: 15_000 })
  await page.screenshot({ path: path.join(artifactsDir, '3-review-screen.png'), fullPage: true })
})
