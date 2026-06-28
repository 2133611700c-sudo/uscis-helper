import { test, expect } from '@playwright/test'

/**
 * Workstream F — RUNNABLE local browser E2E proof: the production server + Chromium
 * + Playwright stack works locally end-to-end. Loads a public (no-DB, no-auth) page.
 */
test('public page renders against the local production server', async ({ page }) => {
  const res = await page.goto('/en/faq', { waitUntil: 'domcontentloaded' })
  expect(res?.status(), 'public page should respond 200').toBeLessThan(400)
  // page actually rendered some content (not an error shell)
  const bodyText = await page.locator('body').innerText()
  expect(bodyText.length).toBeGreaterThan(50)
})

test('home page renders', async ({ page }) => {
  const res = await page.goto('/en', { waitUntil: 'domcontentloaded' })
  expect(res?.status() ?? 200).toBeLessThan(400)
  await expect(page.locator('body')).toBeVisible()
})
