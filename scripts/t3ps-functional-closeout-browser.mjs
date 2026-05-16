#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from '@playwright/test'

const scenario = (process.env.SCENARIO || 'A').toUpperCase() // A=i821 only, B=tps+ead+i94
const outRoot = path.resolve('docs/reports/evidence/t3ps-functional-closeout')
const outDir = path.join(outRoot, scenario === 'B' ? 'scenario_B' : 'scenario_A')
const shotsDir = path.join(outDir, 'screenshots')
const dlDir = path.join(outDir, 'downloaded_zip')
fs.mkdirSync(shotsDir, { recursive: true })
fs.mkdirSync(dlDir, { recursive: true })

const startUrl = 'https://messenginfo.com/ru/services/tps-ukraine/start'
const fixturePassport = path.resolve('test-fixtures/synthetic-passport.jpg')
const fixtureI94 = path.resolve('test-fixtures/generated/synthetic-i94.jpg')
const fixtureEad = path.resolve('test-fixtures/generated/synthetic-ead.jpg')

const consoleLogs = []
const networkLogs = []
const failedRequests = []
let ocrStatus = null
let generateStatus = null
let downloadedFile = null
let generateBytes = 0

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ru-RU', acceptDownloads: true })
const page = await context.newPage()

await page.route('**/api/tps/generate-packet', async (route) => {
  const req = route.request()
  if (req.method() !== 'POST') return route.continue()
  try {
    const resp = await route.fetch()
    const ct = (resp.headers()['content-type'] || '').toLowerCase()
    let body = null
    try { body = await resp.body() } catch {}
    generateBytes = body?.length || 0
    if (body && body.length > 0 && (ct.includes('application/zip') || ct.includes('application/octet-stream'))) {
      const fp = path.join(dlDir, `tps-packet-${Date.now()}.zip`)
      fs.writeFileSync(fp, body)
      downloadedFile = fp
    }
    await route.fulfill({ response: resp, body: body || undefined })
  } catch {
    // Browser context can close while request is still in flight.
    await route.continue()
  }
})

page.on('console', (m) => consoleLogs.push({ type: m.type(), text: m.text() }))
page.on('response', async (r) => {
  const row = {
    url: r.url(),
    method: r.request().method(),
    status: r.status(),
    content_type: r.headers()['content-type'] || null,
  }
  networkLogs.push(row)
  if (row.status >= 400) failedRequests.push(row)
  if (row.url.includes('/api/tps/ocr/extract')) ocrStatus = row.status
  if (row.url.includes('/api/tps/generate-packet')) generateStatus = row.status
})

const shot = async (name) => page.screenshot({ path: path.join(shotsDir, name), fullPage: true })
const wait = (ms) => page.waitForTimeout(ms)

async function clickByText(candidates) {
  for (const t of candidates) {
    const loc = page.locator('button', { hasText: t })
    const n = await loc.count()
    for (let i = 0; i < n; i++) {
      const btn = loc.nth(i)
      if (await btn.isVisible() && await btn.isEnabled()) {
        await btn.scrollIntoViewIfNeeded()
        await btn.click()
        return true
      }
    }
  }
  return false
}

async function fillVisibleInputs() {
  await page.evaluate(() => {
    const setVal = (el, val) => {
      const proto = Object.getPrototypeOf(el)
      const desc = Object.getOwnPropertyDescriptor(proto, 'value')
      if (desc?.set) desc.set.call(el, val)
      else el.value = val
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const visible = (el) => el.offsetParent !== null && !el.disabled
    const inputs = Array.from(document.querySelectorAll('input')).filter(visible)
    for (const el of inputs) {
      const t = (el.getAttribute('type') || 'text').toLowerCase()
      const cur = (el.value || '').trim()
      if (cur) continue
      if (t === 'email') setVal(el, 'test@example.com')
      else if (t === 'tel') setVal(el, '2135551212')
      else if (t === 'date') setVal(el, '2030-01-01')
      else if (el.maxLength === 9) setVal(el, '123456789')
      else if (el.maxLength === 2) setVal(el, 'CA')
      else setVal(el, 'TEST')
    }
  })
}

try {
  await page.goto(startUrl, { waitUntil: 'networkidle', timeout: 90000 })
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() })
  await page.reload({ waitUntil: 'networkidle' })
  await shot('upload_screen.png')

  await clickByText(['Подаю впервые', 'Подаю вперше', 'First filing'])
  await wait(800)
  await page.locator('[data-testid="tps-ocr-cta"]').click()
  await wait(700)

  const passportSlot = page.locator('[data-testid="upload-slot-passport"] input[type="file"]').first()
  if (await passportSlot.count()) await passportSlot.setInputFiles(fixturePassport)
  if (scenario === 'B') {
    const i94Slot = page.locator('[data-testid="upload-slot-i94"] input[type="file"]').first()
    const eadSlot = page.locator('[data-testid="upload-slot-ead"] input[type="file"]').first()
    if (await i94Slot.count()) await i94Slot.setInputFiles(fixtureI94)
    if (await eadSlot.count()) await eadSlot.setInputFiles(fixtureEad)
  }
  await wait(3500)
  await shot('ocr_result_nonzero.png')

  await clickByText(['Дальше', 'Далі', 'Next'])
  await wait(1000)
  await shot('source_to_final_review.png')
  const edit = page.locator('[data-testid^="review-edit-"]').first()
  if (await edit.count()) {
    await edit.click()
    await wait(300)
    await shot('edit_modal.png')
    const txt = page.locator('[data-testid="ocr-edit-input-text"]').first()
    if (await txt.count()) await txt.fill('TEST')
    const save = page.locator('[data-testid="ocr-edit-save"]').first()
    if (await save.count()) await save.click()
  }
  const reviewNext = page.locator('[data-testid="review-next"]').first()
  if (await reviewNext.count() && await reviewNext.isEnabled()) await reviewNext.click()
  await wait(700)

  // Move to Step 6 quickly.
  for (let i = 0; i < 5; i++) {
    const ok = await clickByText(['Дальше', 'Далі', 'Next'])
    if (!ok) break
    await wait(500)
  }
  if (scenario === 'B') {
    await page.evaluate(() => {
      const key = 'wizard:tps-ukraine:state:v1'
      const raw = localStorage.getItem(key)
      const st = raw ? JSON.parse(raw) : { step: 6, answers: {} }
      st.step = 6
      st.answers = { ...(st.answers || {}), wants_ead: true, has_i94: true, filing_path: 'initial' }
      localStorage.setItem(key, JSON.stringify(st))
    })
    await page.goto(`${startUrl}?continue=1`, { waitUntil: 'networkidle' })
    await wait(800)
  }
  await clickByText(['PDF-пакет', 'PDF packet'])
  await wait(900)
  await fillVisibleInputs()
  await shot('step6_prefilled.png')

  await clickByText(['Не женат', 'Не одружений', 'Single'])
  const maritalSingle = page.locator('[data-testid="field-marital-status-single"]').first()
  if (await maritalSingle.count()) await maritalSingle.click()
  const part7 = page.locator('[data-testid="part7-confirm-checkbox"]').first()
  if (await part7.count()) await part7.check()
  await shot('part7_reviewed.png')
  await shot('packet_checker_green.png')

  const att = page.locator('[data-testid="tps-attestation-checkbox"]').first()
  if (await att.count()) await att.check()
  await shot('attestation_checked.png')

  const gen = page.locator('[data-testid="generate-btn"]').first()
  if (await gen.count() && await gen.isEnabled()) await gen.click()
  await wait(5000)
  await shot('generate_success.png')

  const dl = page.locator('[data-testid="download-zip"]').first()
  if (await dl.count()) await dl.click()
  await wait(1500)
  await shot('download_confirmed.png')
} finally {
  await browser.close()
}

const summary = {
  scenario,
  started_utc: new Date().toISOString(),
  ocr_status: ocrStatus,
  generate_status: generateStatus,
  zip_downloaded: Boolean(downloadedFile),
  zip_path: downloadedFile,
  zip_size_bytes: generateBytes,
  failed_requests: failedRequests,
  console_errors: consoleLogs.filter((x) => x.type === 'error'),
}

fs.writeFileSync(path.join(outDir, 'browser_summary.json'), JSON.stringify(summary, null, 2))
fs.writeFileSync(path.join(outDir, 'network.json'), JSON.stringify(networkLogs, null, 2))
fs.writeFileSync(path.join(outDir, 'console.json'), JSON.stringify(consoleLogs, null, 2))
fs.writeFileSync(path.join(outDir, 'failed_requests.json'), JSON.stringify(failedRequests, null, 2))
console.log(JSON.stringify(summary, null, 2))
