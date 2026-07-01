import { test, expect } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Workstream STEP-E — LOCAL mocked browser proof of HONEST source-evidence crops.
 *
 * Drives the LIVE TranslateWizard (production `next start`) to the field-review
 * screen (screen 5) with the `/api/translation/vision-extract` API MOCKED via
 * page.route(...).fulfill(...). No Gemini / no Supabase / no network. It proves the
 * §3.6 HONESTY RULE end-to-end in a real browser against the shipped component:
 *
 *   - approximate (field_template) region  → renders a crop (img + <svg><rect>)
 *   - exact       (ocr_token)      region  → renders a crop (img + <svg><rect>)
 *   - full_image  (model, bbox null)       → renders NO rect (no localization)
 *   - page:2 region while only 1 page up   → renders NO crop (honest page bound)
 *
 * FICTIONAL data only. No real PII. No production file is modified by this spec.
 *
 * RUN (from repo root, or replace the -c path with apps/web/playwright.contract.config.ts):
 *   cd apps/web
 *   npx next build            # if apps/web/.next is missing
 *   npx playwright test -c playwright.contract.config.ts translation-evidence --project=chromium
 */

// Single-page synthetic 1x1 PNG (transparent). FICTIONAL — carries no document data.
const PNG_1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC',
  'base64',
)

// The docTypeId selected in the UI (passport_internal → registryId ua_internal_passport_booklet)
// has auto=true, so selecting it ALWAYS calls vision-extract with NO env flag required.
// Field keys use canonical docintel keys so ukrLabelFor() gives a stable, targetable label.
const MOCK_EXTRACT = {
  ok: true,
  canonical_document_id: 'synthetic-evidence-e2e',
  fields: [
    {
      // (a) approximate — field template area → crop WITH rect, labelled approximate
      field: 'family_name',
      value: 'Testenko',
      raw_cyrillic: 'Тестенко',
      confidence: 0.7,
      kind: 'ocr',
      review_required: true,
      evidence: [
        { fieldKey: 'family_name', bbox: [0.2, 0.22, 0.55, 0.29], page: 1, status: 'approximate', source: 'field_template' },
      ],
    },
    {
      // (b) exact — OCR token box → crop WITH rect
      field: 'given_name',
      value: 'Ivan',
      raw_cyrillic: 'Іван',
      confidence: 0.95,
      kind: 'ocr',
      review_required: false,
      evidence: [
        { fieldKey: 'given_name', bbox: [0.3, 0.4, 0.5, 0.46], page: 1, status: 'exact', source: 'ocr_token' },
      ],
    },
    {
      // (c) full_image — LLM read, no localization → crop renders but NO rect
      field: 'date_of_birth',
      value: '01.01.1990',
      raw_cyrillic: '01.01.1990',
      confidence: 0.8,
      kind: 'model',
      review_required: false,
      evidence: [
        { fieldKey: 'date_of_birth', bbox: null, page: 1, status: 'full_image', source: 'model' },
      ],
    },
    {
      // (d) page:2 region while only 1 page uploaded → NO crop at all (honest page bound)
      field: 'place_of_birth_city',
      value: 'Kyiv',
      raw_cyrillic: 'Київ',
      confidence: 0.9,
      kind: 'ocr',
      review_required: false,
      evidence: [
        { fieldKey: 'place_of_birth_city', bbox: [0.1, 0.6, 0.4, 0.68], page: 2, status: 'exact', source: 'ocr_token' },
      ],
    },
  ],
}

// Ukrainian labels ukrLabelFor() maps these field keys to (translationFieldLabels.ts).
const LABEL = {
  family_name: 'Прізвище',
  given_name: "Ім'я",
  date_of_birth: 'Дата народження',
  place_of_birth_city: 'Місце народження',
} as const

// Locate the review row whose stack contains the given Ukrainian label.
const rowFor = (page: import('@playwright/test').Page, label: string) =>
  page.locator('.tw-trans-row').filter({ has: page.locator('.tw-trans-label', { hasText: label }) })

test('review screen renders honest source-evidence crops from vision-extract (mocked)', async ({ page }) => {
  // Mock the ONLY backend call the wizard makes on this path.
  await page.route('**/api/translation/vision-extract', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_EXTRACT) }))

  await page.goto('/en/services/translate-document/start', { waitUntil: 'domcontentloaded' })

  // Screen 1 → 2 (welcome CTA), select the auto doc type, → 3 (upload).
  await page.getByRole('button', { name: /Start translation/i }).click()
  await page.getByRole('button', { name: /Ukrainian Passport/i }).click()
  await page.getByRole('button', { name: /^Next/i }).click()

  // Upload EXACTLY ONE synthetic page so page:2 evidence is out of range.
  await page.locator('input[type="file"]').first().setInputFiles({
    name: 'fictional-page-1.png', mimeType: 'image/png', buffer: PNG_1x1,
  })
  // The source preview thumbnail must appear before we recognize (previewUrls[0] set).
  await expect(page.locator('.tw-page-grid img').first()).toBeVisible()

  // Recognize → screen 4 (processing) → screen 5 (review). Mock resolves instantly.
  await page.getByRole('button', { name: /Recognize document/i }).click()

  // Reached review: the approximate field's row is present.
  const approxRow = rowFor(page, LABEL.family_name)
  await expect(approxRow).toBeVisible({ timeout: 20_000 })

  // (a) approximate → crop present: an <img> and an <svg><rect>.
  await expect(approxRow.locator('.tw-evidence-crop')).toHaveCount(1)
  await expect(approxRow.locator('.tw-evidence-crop img')).toBeVisible()
  await expect(approxRow.locator('.tw-evidence-crop svg rect')).toHaveCount(1)
  await expect(approxRow.getByText(/Approximate area we read this from/i)).toBeVisible()

  // (b) exact → crop present with rect + "the part we read" label.
  const exactRow = rowFor(page, LABEL.given_name)
  await expect(exactRow.locator('.tw-evidence-crop')).toHaveCount(1)
  await expect(exactRow.locator('.tw-evidence-crop img')).toBeVisible()
  await expect(exactRow.locator('.tw-evidence-crop svg rect')).toHaveCount(1)
  await expect(exactRow.getByText(/The part of your document we read/i)).toBeVisible()

  // (c) full_image → the row exists but NO crop and NO rect (no localization).
  const fullImageRow = rowFor(page, LABEL.date_of_birth)
  await expect(fullImageRow).toBeVisible()
  await expect(fullImageRow.locator('.tw-evidence-crop')).toHaveCount(0)
  await expect(fullImageRow.locator('svg rect')).toHaveCount(0)

  // (d) page:2 while only 1 page uploaded → the row exists but NO crop (honest page bound).
  const outOfRangeRow = rowFor(page, LABEL.place_of_birth_city)
  await expect(outOfRangeRow).toBeVisible()
  await expect(outOfRangeRow.locator('.tw-evidence-crop')).toHaveCount(0)

  // Exactly 2 crops total on the review screen (approximate + exact).
  await expect(page.locator('.tw-evidence-crop')).toHaveCount(2)
  await expect(page.locator('.tw-evidence-crop svg rect')).toHaveCount(2)

  // Screenshot (PII-free: only fictional data + a 1x1 synthetic image).
  const shotDir = join(__dirname, '__screenshots__')
  mkdirSync(shotDir, { recursive: true })
  await page.screenshot({ path: join(shotDir, 'evidence.png'), fullPage: true })
})
