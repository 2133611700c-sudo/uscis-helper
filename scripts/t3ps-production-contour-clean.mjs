#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from '@playwright/test'

const OUT = path.resolve('docs/reports/evidence/t3ps-final-release/browser-run-clean')
const SHOTS = path.join(OUT, 'screenshots')
const DLOAD = path.join(OUT, 'downloaded_zip')
fs.mkdirSync(SHOTS, { recursive: true })
fs.mkdirSync(DLOAD, { recursive: true })

const base = 'https://messenginfo.com'
const startUrl = `${base}/ru/services/tps-ukraine/start`
const fixture = path.resolve('test-fixtures/synthetic-passport.jpg')

const consoleLogs = []
const networkLogs = []
const failedRequests = []
let ocrStatus = null
let generateStatus = null
let generateMissing = null
let downloadedFile = null

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  locale: 'ru-RU',
  acceptDownloads: true,
})
const page = await context.newPage()

page.on('console', (m) => consoleLogs.push({ type: m.type(), text: m.text() }))
page.on('response', async (r) => {
  const row = { url: r.url(), method: r.request().method(), status: r.status() }
  networkLogs.push(row)
  if (row.status >= 400) failedRequests.push(row)
  if (row.url.includes('/api/tps/ocr/extract')) ocrStatus = row.status
  if (row.url.includes('/api/tps/generate-packet')) {
    generateStatus = row.status
    if (row.status >= 400) {
      try {
        const b = await r.json()
        if (Array.isArray(b?.missing)) generateMissing = b.missing
      } catch {}
    }
  }
})

async function shot(name) {
  await page.screenshot({ path: path.join(SHOTS, name), fullPage: true })
}

async function clickText(txtList) {
  for (const t of txtList) {
    const btn = page.locator('button', { hasText: t })
    const n = await btn.count()
    for (let i = 0; i < n; i++) {
      const b = btn.nth(i)
      if (await b.isVisible() && await b.isEnabled()) {
        await b.scrollIntoViewIfNeeded()
        await b.click()
        return true
      }
    }
  }
  return false
}

try {
  await page.goto(startUrl, { waitUntil: 'networkidle', timeout: 90000 })
  await page.evaluate(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
  await page.reload({ waitUntil: 'networkidle' })
  await shot('01_start.png')

  await clickText(['Подаю впервые', 'Подаю вперше', 'First filing'])
  await shot('02_path_selected.png')

  await page.locator('[data-testid="tps-ocr-cta"]').click()
  await page.waitForTimeout(700)
  await shot('03_ocr_open.png')

  const passportInput = page.locator('[data-testid="upload-slot-passport"] input[type="file"]')
  if (await passportInput.count()) {
    await passportInput.setInputFiles(fixture)
    await page.waitForTimeout(3500)
  }
  await shot('04_passport_uploaded.png')

  await clickText(['Дальше', 'Далі', 'Next'])
  await page.waitForTimeout(1000)
  await shot('05_upload_next.png')

  const reviewNext = page.locator('[data-testid="review-next"]')
  if (await reviewNext.count() && await reviewNext.first().isEnabled()) {
    await reviewNext.first().click()
  }
  await page.waitForTimeout(800)
  await shot('06_review_next.png')

  // Wizard steps: 1->6 with explicit next clicks.
  for (let i = 0; i < 5; i++) {
    const ok = await clickText(['Дальше', 'Далі', 'Next'])
    if (!ok) break
    await page.waitForTimeout(600)
  }
  await shot('07_step6_screen.png')

  await clickText(['PDF-пакет', 'PDF packet', 'paquete PDF'])
  await page.waitForTimeout(800)

  // Fill key required fields (stable test IDs first, then label fallback).
  const byTestId = [
    ['field-us-address-street', '123 MAIN ST'],
    ['field-us-address-city', 'LOS ANGELES'],
    ['field-us-address-state', 'CA'],
    ['field-us-address-zip', '90001'],
    ['field-last-entry-date', '2024-01-15'],
    ['field-daytime-phone', '2135551212'],
    ['field-email', 'test@example.com'],
  ]
  for (const [id, val] of byTestId) {
    const inp = page.locator(`[data-testid="${id}"]`).first()
    if (await inp.count()) await inp.fill(val)
  }

  await clickText(['Не одружений', 'Никогда не состоял', 'Single'])
  await clickText(['Не женат', 'Single (never married)'])
  const maritalBtn = page.locator('[data-testid="field-marital-status-single"]').first()
  if (await maritalBtn.count() && await maritalBtn.isEnabled()) await maritalBtn.click()

  // part7 confirmation + attestation + generate
  const part7Confirm = page.locator('[data-testid="part7-confirm-checkbox"]')
  if (await part7Confirm.count()) await part7Confirm.check()
  const att = page.locator('[data-testid="tps-attestation-checkbox"]')
  if (await att.count()) await att.check()
  await shot('08_before_generate.png')

  const dlPromise = page.waitForEvent('download', { timeout: 20000 }).catch(() => null)
  const gen = page.locator('[data-testid="generate-btn"]')
  if (await gen.count() && await gen.first().isEnabled()) await gen.first().click()
  await page.waitForTimeout(6000)
  const dl = await dlPromise
  if (dl) {
    const fp = path.join(DLOAD, dl.suggestedFilename())
    await dl.saveAs(fp)
    downloadedFile = fp
  }
  await shot('09_after_generate.png')
} finally {
  await context.close()
  await browser.close()
}

const summary = {
  started_utc: new Date().toISOString(),
  url: startUrl,
  ocr_status: ocrStatus,
  generate_status: generateStatus,
  generate_missing: generateMissing,
  downloaded_file: downloadedFile,
  failed_requests_count: failedRequests.length,
}
fs.writeFileSync(path.join(OUT, 'console.json'), JSON.stringify(consoleLogs, null, 2))
fs.writeFileSync(path.join(OUT, 'network.json'), JSON.stringify(networkLogs, null, 2))
fs.writeFileSync(path.join(OUT, 'failed_requests.json'), JSON.stringify(failedRequests, null, 2))
fs.writeFileSync(path.join(OUT, 'browser_summary.json'), JSON.stringify(summary, null, 2))
console.log(JSON.stringify(summary, null, 2))
