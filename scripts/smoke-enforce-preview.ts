/**
 * scripts/smoke-enforce-preview.ts
 *
 * Turnkey enforce-mode smoke for the canonical-continuity PREVIEW deploy.
 *
 *   pnpm tsx scripts/smoke-enforce-preview.ts
 *
 * Required env:
 *   PREVIEW_BASE_URL   e.g. https://uscis-helper-xxxx.vercel.app  (NO trailing slash)
 *
 * SAFETY CONTRACT (read before running):
 *   - This harness makes ONLY read-only HTTP calls. Every assertion below
 *     exercises a code path that returns its status code BEFORE any DB write,
 *     payment charge, PDF render, or email send. Nothing is mutated.
 *   - It deliberately does NOT call the OCR extract endpoint (that runs PAID
 *     Google Vision and would INSERT a canonical_documents row). Extract-driven
 *     end-to-end is an owner-manual + integration-test step — see the runbook.
 *   - There is NO HTTP override route on this branch
 *     (apps/web/src/app/api/canonical/[id]/override does not exist). The atomic
 *     override / version-conflict guarantee is verified by the library
 *     integration test `canonicalConcurrency.integration`, NOT by this script.
 *     This script does not invent endpoints.
 *
 * WHAT THIS PROVES (the live-preview enforce gate):
 *   T1  translation/generate-pdf  — missing canonical_document_id → 422 CANONICAL_ID_REQUIRED
 *   T2  translation/generate-pdf  — bogus canonical_document_id    → 404 CANONICAL_NOT_FOUND
 *   T3  translation/render        — missing canonical_document_id → 422 CANONICAL_ID_REQUIRED
 *   T4  translation/render        — bogus canonical_document_id    → 404 CANONICAL_NOT_FOUND
 *
 * If enforce mode were NOT set (e.g. still shadow), T1/T3 would NOT 422 — they
 * would fall through to the payment/review gates (402/403/400). So a green run
 * here is positive evidence the preview env has CANONICAL_CONTINUITY_MODE=enforce.
 *
 * Exit 0 = all PASS. Exit 1 = any FAIL. PII-free output.
 */

const BASE = (process.env.PREVIEW_BASE_URL ?? '').replace(/\/+$/, '')

if (!BASE) {
  console.error('FAIL: PREVIEW_BASE_URL is not set.')
  console.error('  export PREVIEW_BASE_URL=https://uscis-helper-xxxx.vercel.app')
  process.exit(1)
}
if (!/^https:\/\//.test(BASE)) {
  console.error(`FAIL: PREVIEW_BASE_URL must be https. Got: ${BASE}`)
  process.exit(1)
}

// A syntactically valid UUID that will not exist in the canonical_documents table.
// resolveCanonicalDocument() returns null for it → route returns 404 (read-only SELECT).
const BOGUS_UUID = '00000000-0000-4000-8000-000000000000'

interface Check {
  id: string
  name: string
  pass: boolean
  detail: string
}

const checks: Check[] = []

function record(id: string, name: string, pass: boolean, detail: string) {
  checks.push({ id, name, pass, detail })
  const tag = pass ? 'PASS' : 'FAIL'
  console.log(`[${tag}] ${id} ${name} — ${detail}`)
}

/** Minimal review-gate-free body. We only care about the canonical pre-gate, which
 *  runs before payment/review, so we send the smallest body the route will parse. */
function pdfBody(canonicalId?: string): Record<string, unknown> {
  const body: Record<string, unknown> = {
    session_id: 'SMOKE-enforce-preview',
    doc_type: 'ua_birth_certificate',
    profile: { name: '', email: '', phone: '', addr: '' },
    selectedPlan: 'basic',
    spanishCopy: false,
    locale: 'en',
    signatureDataUrl: null,
    signatureMethod: 'manual_wet_signature',
    signedAt: new Date().toISOString(),
    certificationTextVersion: 'smoke',
    fields: [],
  }
  if (canonicalId !== undefined) body.canonical_document_id = canonicalId
  return body
}

async function postJson(
  path: string,
  body: Record<string, unknown>,
): Promise<{ status: number; json: any; text: string }> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  let json: any = null
  try {
    json = JSON.parse(text)
  } catch {
    /* non-JSON (e.g. a PDF) — leave json null */
  }
  return { status: res.status, json, text }
}

async function assertEnforceGate(
  id: string,
  path: string,
  body: Record<string, unknown>,
  expectStatus: number,
  expectErrorCode: string,
) {
  const name = `${path} → ${expectStatus} ${expectErrorCode}`
  try {
    const { status, json } = await postJson(path, body)
    const code = json?.error ?? '(none)'
    const pass = status === expectStatus && code === expectErrorCode
    record(
      id,
      name,
      pass,
      `got status=${status} error=${code}` +
        (pass ? '' : ` (expected status=${expectStatus} error=${expectErrorCode})`),
    )
  } catch (e: any) {
    record(id, name, false, `request threw: ${e?.message ?? e}`)
  }
}

async function main() {
  console.log('─'.repeat(72))
  console.log('Canonical-continuity ENFORCE smoke (read-only HTTP)')
  console.log(`Target: ${BASE}`)
  console.log('─'.repeat(72))

  // T1 — generate-pdf, no canonical_document_id → 422
  await assertEnforceGate(
    'T1',
    '/api/translation/generate-pdf',
    pdfBody(/* no id */),
    422,
    'CANONICAL_ID_REQUIRED',
  )

  // T2 — generate-pdf, bogus (non-existent) canonical_document_id → 404
  await assertEnforceGate(
    'T2',
    '/api/translation/generate-pdf',
    pdfBody(BOGUS_UUID),
    404,
    'CANONICAL_NOT_FOUND',
  )

  // T3 — render, no canonical_document_id → 422
  await assertEnforceGate(
    'T3',
    '/api/translation/render',
    { session_id: 'SMOKE-enforce-preview' },
    422,
    'CANONICAL_ID_REQUIRED',
  )

  // T4 — render, bogus canonical_document_id → 404
  await assertEnforceGate(
    'T4',
    '/api/translation/render',
    { session_id: 'SMOKE-enforce-preview', canonical_document_id: BOGUS_UUID },
    404,
    'CANONICAL_NOT_FOUND',
  )

  console.log('─'.repeat(72))
  const failed = checks.filter((c) => !c.pass)
  const passed = checks.length - failed.length
  console.log(`SUMMARY: ${passed}/${checks.length} PASS`)

  if (failed.length > 0) {
    console.log('')
    console.log('FAILURES:')
    for (const f of failed) console.log(`  - ${f.id} ${f.name}: ${f.detail}`)
    console.log('')
    console.log('Most likely cause if T1/T3 did NOT return 422:')
    console.log('  CANONICAL_CONTINUITY_MODE is not "enforce" on this preview deploy,')
    console.log('  OR the preview was not REDEPLOYED after setting the env var')
    console.log('  (Vercel applies env changes to the NEXT deploy only).')
  }

  console.log('─'.repeat(72))
  console.log('NOT covered by this read-only HTTP smoke (see runbook):')
  console.log('  - extract → real canonical UUID (PAID Vision, INSERTs a row): owner-manual')
  console.log('  - override 200 then 409 version-conflict: NO HTTP route exists on this')
  console.log('    branch → covered by canonicalConcurrency.integration (library test)')
  console.log('  - generate-pdf 200 + 7-field cert metadata: needs owner session + a real')
  console.log('    canonical id + signed review payload: owner-manual + Supabase SQL check')
  console.log('─'.repeat(72))

  process.exit(failed.length > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error('FAIL: smoke harness crashed:', e?.message ?? e)
  process.exit(1)
})
