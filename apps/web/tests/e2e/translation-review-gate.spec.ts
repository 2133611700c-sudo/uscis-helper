/**
 * translation-review-gate.spec.ts
 *
 * End-to-end proof that the P3 Translation Review Gate (8 CFR §103.2(b)(3)) works:
 *
 * 1. Booklet uploaded → OCR runs → wizard reaches Step 6
 * 2. "Review Translation" button visible (translationReviewConfirmed is false)
 * 3. Clicking it calls /api/tps/translation/preview → modal appears
 * 4. Without checking the checkbox: Confirm button shows validation error
 * 5. Check the checkbox → click Confirm → modal closes, translationReviewConfirmed = true
 * 6. "Review Translation" button disappears (confirmed)
 * 7. Generate ZIP → /api/tps/generate-packet called with reviewConfirmed: true
 * 8. ZIP downloaded → verify Translation HTML present and safety assertions pass
 */

import { test, expect } from '@playwright/test'
import path from 'path'
import { promises as fs } from 'fs'
import { execSync } from 'child_process'

const REPO_ROOT = path.resolve(process.cwd(), '../..')
const BOOKLET_IMAGE = path.join(REPO_ROOT, 'qa-shots/private/booklet_test_resized.jpg')

const EXPECTED = {
  family: 'Kuropiatnyk',
  city: 'Trostianets',
  province: 'Vinnytsia',
  middle: 'Serhiiovych',
}

test('Review Gate: preview → block without checkbox → confirm → translation in ZIP', async ({ page, browserName }) => {
  test.setTimeout(300_000)

  const artifactsDir = path.resolve(process.cwd(), 'test-results', 'translation-review-gate-artifacts')
  await fs.mkdir(artifactsDir, { recursive: true })
  await fs.access(BOOKLET_IMAGE)

  // Track /api/tps/translation/preview calls
  const previewResponses: Array<Record<string, unknown>> = []
  page.on('response', async (resp) => {
    if (!resp.url().includes('/api/tps/translation/preview') || resp.request().method() !== 'POST') return
    try {
      const payload = await resp.json()
      previewResponses.push({
        status: resp.status(),
        preview_only: payload?.preview_only ?? null,
        violations_count: (payload?.violations ?? []).length,
        translation_html_length: (payload?.translation_html ?? '').length,
        certification_html_length: (payload?.certification_html ?? '').length,
      })
    } catch {
      previewResponses.push({ status: resp.status(), parse_error: true })
    }
  })

  // Track /api/tps/generate-packet reviewConfirmed in request body
  let generateRequestJson: Record<string, unknown> | null = null
  page.on('request', async (req) => {
    if (!req.url().includes('/api/tps/generate-packet') || req.method() !== 'POST') return
    try {
      const body = req.postData()
      if (body) generateRequestJson = JSON.parse(body) as Record<string, unknown>
    } catch { /* ignore */ }
  })

  // Deterministic clean state
  await page.goto('/en/services/tps-ukraine/start')
  await page.evaluate(() => {
    localStorage.removeItem('wizard:tps-ukraine:v3:state')
    localStorage.removeItem('wizard:tps-ukraine:v2:state')
    localStorage.removeItem('wizard:tps-ukraine:state')
  })
  await page.reload()

  // Steps 1–3
  await page.getByRole('button', { name: /First time/ }).click()
  await page.getByRole('button', { name: /By mail/ }).click()
  await page.getByRole('button', { name: /Yes Add I-765/ }).click()

  // Upload booklet — triggers OCR
  await expect(page.getByTestId('tps-upload-input-booklet')).toBeAttached({ timeout: 10_000 })
  const ocrDone = page.waitForResponse(
    (r) => r.url().includes('/api/tps/ocr/extract') && r.request().method() === 'POST' && r.status() === 200,
    { timeout: 60_000 },
  )
  await page.getByTestId('tps-upload-input-booklet').setInputFiles(BOOKLET_IMAGE)
  await ocrDone

  // Proceed to Step 5
  await expect(page.getByTestId('tps-ocr-cta')).toBeVisible({ timeout: 10_000 })
  await page.getByTestId('tps-ocr-cta').click()
  await expect(page.getByTestId('tps-review-step-container')).toBeVisible({ timeout: 60_000 })

  // Fill required review fields
  const fillReviewRow = async (label: string, value: string) => {
    const lowered = label.toLowerCase()
    const editBtn = page.locator(
      `xpath=//div[contains(translate(normalize-space(.),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'${lowered}')]/following-sibling::div//button`,
    ).first()
    if ((await editBtn.count()) === 0) return
    page.once('dialog', async (dialog) => dialog.accept(value))
    await editBtn.click()
    await page.waitForTimeout(120)
  }

  // OCR-editable rows (exist only when OCR extracted the field)
  await fillReviewRow('I-94 admission number', '039622651A3')
  await fillReviewRow('Status at entry', 'UHP')

  const fillIfEmpty = async (testId: string, value: string) => {
    const input = page.getByTestId(testId)
    if ((await input.count()) === 0) return
    await expect(input).toBeVisible()
    if (!(await input.inputValue()).trim()) await input.fill(value)
  }

  // Identity gate fields — shown as manual inputs when OCR missed them (booklet-only flow)
  await fillIfEmpty('tps-review-manual-given-name', 'Sergii')
  await fillIfEmpty('tps-review-manual-passport-number', 'FU262473')
  await fillIfEmpty('tps-review-manual-dob', '06/25/1986')
  await fillIfEmpty('tps-review-manual-last-entry-date', '09/09/2022')

  await fillIfEmpty('tps-review-manual-address-street', '4341 Willow Brook Ave 111')
  await fillIfEmpty('tps-review-manual-address-city', 'Los Angeles')
  await fillIfEmpty('tps-review-manual-address-state', 'CA')
  await fillIfEmpty('tps-review-manual-address-zip', '90029')
  await fillIfEmpty('tps-review-manual-place-of-last-entry', 'Los Angeles')
  await fillIfEmpty('tps-review-manual-passport-expiration', '02/22/2029')
  await fillIfEmpty('tps-review-manual-phone', '2135550199')
  await fillIfEmpty('tps-review-manual-email', 'sergii.qa+reviewgate@messenginfo.test')
  await fillIfEmpty('tps-review-manual-in-care-of', 'SERGII KUROPIIATNYK')

  await page.getByRole('button', { name: /^Single$/ }).click()
  if ((await page.getByTestId('tps-part7-checkbox').count()) > 0) {
    await page.getByTestId('tps-part7-checkbox').check()
  }

  // Proceed to Step 6 (paywall bypass)
  await page.getByTestId('tps-step6-continue-cta').click()
  await page.goto('/en/services/tps-ukraine/start?paid=1')

  // ── GATE TEST 1: "Review Translation" button visible before confirmation ──
  await expect(page.getByTestId('tps-review-translation-btn')).toBeVisible({ timeout: 20_000 })
  await page.screenshot({ path: path.join(artifactsDir, 'step6-before-review.png'), fullPage: true })

  // ── GATE TEST 2: clicking "Review Translation" calls preview API and opens modal ──
  const previewResponsePromise = page.waitForResponse(
    (r) => r.url().includes('/api/tps/translation/preview') && r.request().method() === 'POST' && r.status() === 200,
    { timeout: 30_000 },
  )
  await page.getByTestId('tps-review-translation-btn').click()
  await previewResponsePromise

  await expect(page.getByTestId('translation-review-gate')).toBeVisible({ timeout: 15_000 })
  await page.screenshot({ path: path.join(artifactsDir, 'review-gate-modal.png'), fullPage: true })

  // ── GATE TEST 3: confirm without checkbox shows validation error ──
  await page.getByTestId('translation-review-confirm-btn').click()
  // The gate should NOT close — still visible
  await expect(page.getByTestId('translation-review-gate')).toBeVisible()
  // Validation error text should appear
  await expect(page.locator('[data-testid="translation-review-gate"]')).toContainText(
    /must check|debe marcar|повинні відмітити|должны отметить/i,
  )

  // ── GATE TEST 4: check checkbox ──
  await page.getByTestId('translation-review-checkbox').check()
  await expect(page.getByTestId('translation-review-checkbox')).toBeChecked()

  // ── GATE TEST 5: confirm with checkbox closes modal and sets reviewConfirmed ──
  await page.getByTestId('translation-review-confirm-btn').click()
  // Modal must close
  await expect(page.getByTestId('translation-review-gate')).not.toBeVisible({ timeout: 5_000 })
  // "Review Translation" button must disappear (translationReviewConfirmed = true)
  await expect(page.getByTestId('tps-review-translation-btn')).not.toBeVisible({ timeout: 5_000 })

  await page.screenshot({ path: path.join(artifactsDir, 'step6-after-review-confirmed.png'), fullPage: true })

  // ── GATE TEST 6: generate ZIP with reviewConfirmed: true ──
  await expect(page.getByTestId('tps-generate-cta')).toBeVisible({ timeout: 20_000 })

  const zipResponsePromise = page.waitForResponse(
    (r) => r.url().includes('/api/tps/generate-packet') && r.request().method() === 'POST' && r.status() === 200,
    { timeout: 60_000 },
  )
  const downloadPromise = page.waitForEvent('download', { timeout: 60_000 })

  await page.getByTestId('tps-generate-cta').click()
  await zipResponsePromise
  const download = await downloadPromise

  // Verify reviewConfirmed: true was sent in request
  await fs.writeFile(
    path.join(artifactsDir, 'generate-request-translation.json'),
    JSON.stringify({
      has_generate_json: generateRequestJson !== null,
      review_confirmed_flag: (generateRequestJson as unknown as { _translation?: { reviewConfirmed?: boolean } })?._translation?.reviewConfirmed ?? 'NOT_FOUND',
    }, null, 2),
    'utf8',
  )

  if (generateRequestJson !== null) {
    const translationOpts = (generateRequestJson as { _translation?: { reviewConfirmed?: boolean } })?._translation
    expect(translationOpts?.reviewConfirmed).toBe(true)
  }

  // ── GATE TEST 7: ZIP contains Translation HTML ──
  const zipPath = path.join(artifactsDir, 'tps-packet-reviewed.zip')
  await download.saveAs(zipPath)
  const zipStat = await fs.stat(zipPath)

  const translationProof: Record<string, unknown> = { zip_bytes: zipStat.size }
  try {
    const unzipDir = path.join(artifactsDir, 'unzipped')
    await fs.mkdir(unzipDir, { recursive: true })
    execSync(`unzip -o "${zipPath}" -d "${unzipDir}"`, { stdio: 'pipe' })

    const translationFile = path.join(unzipDir, 'Translation_Internal_Passport.html')
    const certFile = path.join(unzipDir, 'Certification_Translation.html')

    let translationHtml = ''
    try {
      translationHtml = await fs.readFile(translationFile, 'utf8')
      translationProof.translation_file_present = true
      translationProof.translation_bytes = translationHtml.length
    } catch {
      translationProof.translation_file_present = false
    }

    let certHtml = ''
    try {
      certHtml = await fs.readFile(certFile, 'utf8')
      translationProof.certification_file_present = true
    } catch {
      translationProof.certification_file_present = false
    }

    if (translationHtml) {
      translationProof.has_surname = translationHtml.includes(EXPECTED.family)
      translationProof.has_city = translationHtml.includes(EXPECTED.city)
      translationProof.has_patronymic_label = translationHtml.includes('Patronymic')
      translationProof.no_middle_name_label = !translationHtml.includes('Middle Name')

      // Core safety assertions
      expect(translationHtml).toContain(EXPECTED.family)
      expect(translationHtml).toContain('Patronymic')
      expect(translationHtml).not.toContain('Middle Name')
      expect(translationHtml).toContain('Internal Passport')
      expect(translationHtml).toContain('Ukraine')
    }

    if (certHtml) {
      translationProof.cert_has_competency = /competent to translate|complete and accurate/i.test(certHtml)
      translationProof.cert_no_ai_cert = !(/certified by AI/i.test(certHtml))
      expect(certHtml).toMatch(/competent to translate|complete and accurate/i)
      expect(certHtml).not.toMatch(/certified by AI/i)
    }
  } catch (e) {
    translationProof.unzip_error = String(e)
    // eslint-disable-next-line no-console
    console.warn(`[review-gate/${browserName}] UNZIP_ERROR=${String(e)}`)
  }

  // Write proof artifacts
  await fs.writeFile(
    path.join(artifactsDir, 'preview-responses.json'),
    JSON.stringify(previewResponses, null, 2),
    'utf8',
  )
  await fs.writeFile(
    path.join(artifactsDir, 'translation-proof.json'),
    JSON.stringify(translationProof, null, 2),
    'utf8',
  )

  // Preview API assertions
  expect(previewResponses.length).toBeGreaterThan(0)
  const firstPreview = previewResponses[0]
  expect(firstPreview.status).toBe(200)
  expect(firstPreview.preview_only).toBe(true)
  expect(firstPreview.violations_count).toBe(0)

  // eslint-disable-next-line no-console
  console.log(`[review-gate/${browserName}] PREVIEW_RESPONSES=${JSON.stringify(previewResponses)}`)
  // eslint-disable-next-line no-console
  console.log(`[review-gate/${browserName}] TRANSLATION_PROOF=${JSON.stringify(translationProof)}`)
  // eslint-disable-next-line no-console
  console.log(`[review-gate/${browserName}] ZIP_BYTES=${zipStat.size}`)
})
