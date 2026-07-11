import { test, expect, type Request } from '@playwright/test'
import * as path from 'node:path'
import { existsSync } from 'node:fs'

/**
 * BROWSER VERTICAL SLICE 1 — TranslateWizard auto-detect DOM path (fully mocked).
 *
 * Proves the real client-side flow of the translation wizard end-to-end in a
 * browser WITHOUT any real model call:
 *   welcome → doc-type (auto-detect) → upload → processing → review → edit one
 *   field → the edited value propagates into the translation draft preview.
 *
 * The ONLY network dependency, `/api/translation/vision-extract`, is intercepted
 * by page.route and fulfilled with a FULLY SYNTHETIC, PII-free body. No Gemini /
 * OpenAI / googleapis host is ever contacted; any such request FAILS the test.
 *
 * Runs against a remote Preview deploy (NEXT_PUBLIC_ONE_BRAIN_AUTO_DETECT=1
 * baked in), so it needs only @playwright/test + chromium — not the app's deps.
 *
 * PII DISCIPLINE: every value here is fabricated (SHEVCHENKO / TARAS / 1970-…).
 * The fixture (synthetic-birth-cert.jpg) and the edited value (EDITEDVALUE123)
 * are synthetic. No real person's data appears in this spec or its output.
 */

// Resolve from repo root (cwd), matching the repo's Playwright convention
// (see canonical-carriage.spec.ts) — portable across machines / CI runners,
// no hardcoded absolute path. Run Playwright with the repo root as cwd.
const FIXTURE = path.resolve(process.cwd(), 'test-fixtures/synthetic-birth-cert.jpg')

// Fail fast (with the resolved path) if the runner's cwd isn't the repo root —
// clearer than an opaque setInputFiles error, and proves the path is real.
if (!existsSync(FIXTURE)) {
  throw new Error(`Synthetic fixture not found: ${FIXTURE} (run Playwright from the repo root)`)
}

// The 12 canonical birth-certificate field ids the wizard knows how to label.
// Values are SYNTHETIC. All review_required:true so the wizard renders review rows.
const MOCK_FIELDS = [
  { field: 'child_family_name',        value: 'SHEVCHENKO',       raw_cyrillic: 'Шевченко' },
  { field: 'child_given_name',         value: 'TARAS',            raw_cyrillic: 'Тарас' },
  { field: 'child_patronymic',         value: 'HRYHOROVYCH',      raw_cyrillic: 'Григорович' },
  { field: 'dob',                      value: '1970-01-02',       raw_cyrillic: '02.01.1970' },
  { field: 'place_of_birth_city',      value: 'KYIV',             raw_cyrillic: 'Київ' },
  { field: 'father_full_name',         value: 'HRYHORII SHEVCHENKO', raw_cyrillic: 'Григорій Шевченко' },
  { field: 'mother_full_name',         value: 'OKSANA SHEVCHENKO',   raw_cyrillic: 'Оксана Шевченко' },
  { field: 'act_record_number',        value: '000123',           raw_cyrillic: '000123' },
  { field: 'act_record_date',          value: '1970-01-05',       raw_cyrillic: '05.01.1970' },
  { field: 'issuing_authority',        value: 'SYNTHETIC RAGS OFFICE', raw_cyrillic: 'Синтетичний РАЦС' },
  { field: 'certificate_series_number', value: 'AB-000000',       raw_cyrillic: 'АБ-000000' },
  { field: 'date_of_issue',            value: '1970-01-06',       raw_cyrillic: '06.01.1970' },
].map((f) => ({
  ...f,
  confidence: 0.5,
  review_required: true,
  kind: 'ai_vision' as const,
}))

const MOCK_BODY = {
  ok: true,
  status: 'ok:core-b2',
  doc_type_id: 'ua_birth_certificate',
  core_path: 'canonical',
  fields: MOCK_FIELDS,
  reader_provider: 'mock',
  reader_model: 'mock-fixture',
  model: 'mock-fixture',
  fallback_used: false,
  provider_call_count: 0,
  reader_execution: [
    {
      configuredPrimaryProvider: 'mock',
      configuredPrimaryModel: 'mock-fixture',
      primaryAttempted: false,
      primaryOutcome: 'skipped',
      fallbackAttempted: false,
      fallbackProvider: null,
      fallbackModel: null,
      fallbackOutcome: 'not_attempted',
      finalProvider: 'mock',
      finalModel: 'mock-fixture',
      providerCallCount: 0,
      primaryLatencyMs: null,
      fallbackLatencyMs: null,
      totalReaderLatencyMs: 0,
    },
  ],
  pages: [{ page: 1, ok: true, status: 'ok:mock', ms: 0 }],
  page_count: 1,
  canonical_document_id: null,
}

// Hosts that would indicate a real paid model call leaked through.
const FORBIDDEN_HOST_RE = /(generativelanguage\.googleapis\.com|aiplatform\.googleapis\.com|vision\.googleapis\.com|googleapis\.com\/.*vision|api\.openai\.com|openai\.com|gemini)/i

test('vertical slice 1 — auto-detect → upload → review → edit → draft (fully mocked)', async ({ page }) => {
  // Require an EXPLICIT target — never fall back to a hardcoded preview URL that
  // goes stale (a month later it would silently run against a dead deployment).
  // Point PLAYWRIGHT_BASE_URL at an auto-detect-enabled deployment
  // (built with NEXT_PUBLIC_ONE_BRAIN_AUTO_DETECT=1).
  test.skip(
    !process.env.PLAYWRIGHT_BASE_URL,
    'set PLAYWRIGHT_BASE_URL to an auto-detect-enabled deployment (NEXT_PUBLIC_ONE_BRAIN_AUTO_DETECT=1)',
  )
  const baseURL = process.env.PLAYWRIGHT_BASE_URL as string

  // ── Network accounting ──────────────────────────────────────────────
  let visionExtractHits = 0
  let geminiCalls = 0
  let openaiCalls = 0
  const unexpectedAi: string[] = []

  page.on('request', (req: Request) => {
    const url = req.url()
    if (FORBIDDEN_HOST_RE.test(url)) {
      unexpectedAi.push(url)
      if (/gemini|generativelanguage|aiplatform|vision\.googleapis/i.test(url)) geminiCalls++
      if (/openai/i.test(url)) openaiCalls++
    }
  })

  // Defensive: block ANY real paid AI host outright (there should be none).
  await page.route(FORBIDDEN_HOST_RE, (route) => {
    unexpectedAi.push(route.request().url())
    return route.abort()
  })

  // The ONE endpoint we mock — never hits the backend.
  await page.route('**/api/translation/vision-extract', async (route) => {
    visionExtractHits++
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_BODY),
    })
  })

  // ── Stub window.prompt BEFORE any interaction (the wizard edits via prompt) ──
  await page.addInitScript(() => {
    // Feed a distinctive synthetic value into the FIRST prompt only, so exactly
    // one field is edited; later prompts (if any) return null = cancel.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any
    w.__promptCount = 0
    window.prompt = (_msg?: string, _def?: string) => {
      w.__promptCount += 1
      return w.__promptCount === 1 ? 'EDITEDVALUE123' : null
    }
  })

  // ── 1. Land on the wizard start page (screen 1: welcome) ─────────────
  await page.goto(`${baseURL}/en/services/translate-document/start`, {
    waitUntil: 'domcontentloaded',
  })

  // Screen 1 → 2: "Start translation →"
  await page.getByRole('button', { name: /Start translation/i }).click()

  // ── 2. Select the auto-detect tile (screen 2) ────────────────────────
  const autoDetectTile = page.getByRole('button', { name: /detect automatically/i })
  await expect(autoDetectTile).toBeVisible()
  await autoDetectTile.click()
  const autoDetectSelected = (await autoDetectTile.getAttribute('aria-pressed')) === 'true'
  expect(autoDetectSelected).toBe(true)

  // Screen 2 → 3: "Next →"
  await page.getByRole('button', { name: /^Next/i }).click()

  // ── 3. Upload the synthetic fixture (screen 3) ───────────────────────
  const fileInput = page.locator('input[type=file]').first()
  await fileInput.setInputFiles(FIXTURE)

  // Wait for the page thumbnail to appear (upload registered).
  await expect(page.locator('.tw-page-tile img').first()).toBeVisible({ timeout: 15000 })
  const uploadCompleted = await page.locator('.tw-page-tile img').first().isVisible()

  // Screen 3 → 4 (processing) → 5 (review): "Recognize document →"
  await page.getByRole('button', { name: /Recognize document/i }).click()

  // ── 4. Wait for the REVIEW screen (screen 5) ─────────────────────────
  // Review rows render from the mock; screen 5 header = "Translation ready!"
  await expect(page.getByRole('heading', { name: /Translation ready/i })).toBeVisible({
    timeout: 30000,
  })
  const reviewRows = page.locator('.tw-trans-row')
  await expect(reviewRows.first()).toBeVisible()
  const reviewScreenVisible = (await reviewRows.count()) > 0

  // Confirm the mock body actually drove the review (source cyrillic present).
  await expect(page.locator('.tw-trans-orig').first()).toContainText('Шевченко')

  // ── 5. EDIT exactly one field through the UI (prompt is stubbed) ──────
  const firstEdit = page.locator('.tw-trans-row').first().getByRole('button', { name: /Edit value/i })
  await expect(firstEdit).toBeVisible()
  await firstEdit.click()

  // The edited row now shows the synthetic value + "Edited" badge.
  await expect(page.locator('.tw-trans-row').first()).toContainText('EDITEDVALUE123')
  await expect(page.locator('.tw-trans-row.user-edited').first()).toBeVisible()
  const fieldEdited = await page.locator('.tw-trans-row').first().getByText('EDITEDVALUE123').isVisible()

  // ── 6. CONFIRM the remaining review candidates through the UI ────────
  // Each still-flagged row has a per-row "Confirm" button. Click them all so
  // the review state resolves through real UI clicks (not state pokes).
  const confirmButtons = page.locator('.tw-trans-row button[aria-label^="Confirm"]')
  const confirmCount = await confirmButtons.count()
  for (let i = 0; i < confirmCount; i++) {
    // Re-query each iteration; confirming re-renders the list.
    const btns = page.locator('.tw-trans-row button[aria-label^="Confirm"]')
    if ((await btns.count()) === 0) break
    await btns.first().click()
  }
  const confirmClicked = confirmCount > 0
  // A4: prove EVERY review-required row was actually confirmed through the UI —
  // no Confirm button may remain (not just "some were clicked").
  await expect(confirmButtons, 'all review-required rows must be confirmed (0 left)').toHaveCount(0)

  // ── 7. Reach the translation DRAFT screen + assert edited value present ──
  // The draft preview is the watermarked "SAMPLE TRANSLATION" cert block on
  // screen 5 — it renders certRowsForPreview, which reflects the edited value.
  const draft = page.locator('.tw-cert-preview')
  await expect(draft).toBeVisible()
  const draftVisible = await draft.isVisible()

  await expect(draft).toContainText('EDITEDVALUE123')
  const editedPropagated = await draft.getByText('EDITEDVALUE123').isVisible()

  // ── PASS-CRITERIA ASSERTIONS ─────────────────────────────────────────
  expect(visionExtractHits, 'vision-extract must be intercepted exactly once').toBe(1)
  expect(geminiCalls, 'no Gemini calls').toBe(0)
  expect(openaiCalls, 'no OpenAI calls').toBe(0)
  expect(unexpectedAi, `no unexpected AI hosts: ${unexpectedAi.join(', ')}`).toHaveLength(0)
  expect(reviewScreenVisible).toBe(true)
  expect(uploadCompleted).toBe(true)
  expect(autoDetectSelected).toBe(true)
  expect(fieldEdited).toBe(true)
  expect(confirmClicked).toBe(true)
  expect(draftVisible).toBe(true)
  expect(editedPropagated).toBe(true)

  // Evidence screenshot (synthetic content only).
  await page.screenshot({ path: 'test-results/vertical-slice-1-draft.png', fullPage: true })

  // Structured proof line for the report.
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify({
      VERTICAL_SLICE_1: 'PASS',
      visionExtractHits,
      geminiCalls,
      openaiCalls,
      unexpectedAi,
      autoDetectSelected,
      uploadCompleted,
      reviewScreenVisible,
      fieldEdited,
      confirmClicked,
      draftVisible,
      editedPropagated,
    }),
  )
})
