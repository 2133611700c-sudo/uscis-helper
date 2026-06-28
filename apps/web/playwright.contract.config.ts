import { defineConfig, devices } from '@playwright/test'

/**
 * Phase 10 / Workstream F — LOCAL mocked browser E2E for the unified-contract
 * vertical. Boots the PRODUCTION server (next start) via webServer and runs
 * Chromium. No Docker / no Supabase / no staging secrets.
 *
 *   - contract-stack-smoke: loads a public page → proves browser+server+Playwright
 *     work locally end-to-end (RUNNABLE here).
 *   - review-contract: drives the review UI with page.route-mocked API responses
 *     (contract-shaped); self-skips if the review page needs a real session/DB to
 *     reach the client (that part is BLOCKED without Supabase → staging runbook).
 *
 * Run: npx playwright test -c playwright.contract.config.ts --project=chromium
 */
const PORT = Number(process.env.CONTRACT_E2E_PORT || 3100)
export default defineConfig({
  testDir: './tests/e2e-contract',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.CONTRACT_E2E_BASE_URL || `http://127.0.0.1:${PORT}`,
    headless: true,
    trace: 'off',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.CONTRACT_E2E_BASE_URL
    ? undefined
    : {
        command: `npx next start -p ${PORT}`,
        url: `http://127.0.0.1:${PORT}/en/faq`,
        timeout: 120_000,
        reuseExistingServer: true,
      },
})
