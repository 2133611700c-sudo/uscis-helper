/**
 * wizard-smoke.spec.ts — END-TO-END UI smoke of the translation wizard against the
 * LIVE deployment, with SYNTHETIC fixtures only (no PII).
 *
 * Catches the bug class that API-level probes cannot: wizard CONFIG bypassing the
 * working API (the autoread flag that silently skipped extraction; the label
 * whitelist that silently dropped extracted fields). Cost of not having this:
 * 5+ debugging sessions (OPS_INCIDENT_LOG 2026-06-11).
 */
import { test, expect } from '@playwright/test'
import path from 'path'

const FIXTURES = path.join(__dirname, '..', '..', 'test-fixtures')

const CASES = [
  { tile: /Свидетельство о рождении/, file: 'synthetic-birth-cert.jpg', minRows: 5 },
  { tile: /Военный билет/,            file: 'synthetic-military-id.jpg', minRows: 3 },
] as const

for (const c of CASES) {
  test(`wizard end-to-end: ${c.file} → review table with real rows`, async ({ page }) => {
    await page.goto('/ru/services/translate-document/start')
    // welcome → doc-type screen (welcome has a single primary CTA)
    const start = page.locator('button.tw-btn-primary').first()
    if (await start.isVisible().catch(() => false)) await start.click()

    // pick the doc type tile
    await page.locator('button.tw-doc-tile', { hasText: c.tile }).click()
    await page.locator('button.tw-btn-primary:not([disabled])').first().click()

    // upload the synthetic fixture
    await page.locator('input[type="file"]').first().setInputFiles(path.join(FIXTURES, c.file))
    // continue → processing (extraction runs live)
    await page.locator('button.tw-btn-primary:not([disabled])').first().click()

    // review screen: must NOT fall to the manual notice; must show real rows
    const manualNotice = page.getByText(/переведём документ вручную|will translate manually/i)
    const reviewRows = page.locator('.tw-cert-row, [class*="cert"] tr, table tr').filter({ hasText: /./ })

    await expect(manualNotice).toBeHidden({ timeout: 200_000 })
    // at least minRows rows render with content (labels from the registry, values or raw cyrillic)
    await expect
      .poll(async () => reviewRows.count(), { timeout: 200_000 })
      .toBeGreaterThanOrEqual(c.minRows)

    // no row may render a dash where extraction succeeded for synthetic printed docs
    const dashes = await page.getByText(/^—$/).count()
    expect(dashes, 'review table must not be all-dashes for a synthetic printed doc').toBeLessThan(3)
  })
}
