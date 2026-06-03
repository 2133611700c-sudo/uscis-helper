/**
 * POST /api/translation/vision-extract
 *
 * Accepts ONE OR MORE Ukrainian document images (multipart/form-data
 * with repeated `file` key — up to MAX_PAGES). Each page is run through
 * the docintel spine (Gemini vision → KMU-55 transliteration); resulting
 * fields are merged across pages preferring the earliest non-empty value
 * for each field name. The translation wizard renders the merged set on
 * its review screen.
 *
 * Multi-page rationale: a Ukrainian internal-passport booklet has at least
 * an identity page + a registration/photo page; a birth certificate may be
 * a single double-sided sheet; users may upload front + back as separate
 * photos. The OCR call accepts them all in one request so the user is not
 * forced to pre-merge images.
 *
 * This is the REAL replacement for the wizard's previous fake-detection
 * animation that hardcoded "SHEVCHENKO TARAS HRYHOROVYCH". The user now sees
 * fields actually read from their own document(s).
 *
 * Privacy: free Gemini tier trains on data. Callers must use PAID Gemini for
 * real client PII — server reads GEMINI_API_KEY from env; production must set
 * the paid-tier key. v5 §30.
 *
 * Rate-limited (8 requests/min/IP — each request may span up to MAX_PAGES
 * pages, so cost is bounded). Backward compatible: a single `file` request
 * still works exactly as before.
 */

import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, getClientIP } from '@/lib/security/rate-limit'
import { readDocument } from '@/lib/docintel/documentFieldReader'
import { getGeminiApiKey } from '@/lib/gemini/apiKey'
// Central Brain (flag-gated, default OFF → prod behavior unchanged)
import { analyze } from '@/lib/central-brain'
import { deepseekProseTranslator } from '@/lib/engine/translator'
import { DOC_TYPES } from '@/lib/engine/docTypes'
// ONE BRAIN Core arbitration (flag-gated: ONE_BRAIN_CORE_ENABLED=1, default OFF)
// B2: Translation consumes same Core as TPS. toTranslationRows = the B2 adapter.
import { arbitrateDocument } from '@/lib/canonical/core/arbitration'
import { docintelToCandidate, buildCyrillicMap, toTranslationRows } from '@/lib/canonical/core/translationAdapter'

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // gemini-2.5-pro vision ~16-40s/page (handwriting) — default 15s would abort it

const ALLOWED_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp'])
const MAX_BYTES = 10 * 1024 * 1024 // 10 MB per page
const MAX_PAGES = 6                  // hard cap matching the wizard

type FieldOut = {
  field: string
  value: string | null
  raw_cyrillic: string | null
  confidence: number
  review_required: boolean
  kind: string
  source_page?: number
}

export async function POST(req: NextRequest) {
  const ip = getClientIP(req)
  const rl = await rateLimit(`translation-vision:${ip}`, 8, 60_000)
  if (!rl.allowed) {
    return NextResponse.json(
      { ok: false, error: 'Too many requests. Wait a minute.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt.getTime() - Date.now()) / 1000)) } },
    )
  }

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ ok: false, error: 'Expected multipart/form-data with one or more "file" entries.' }, { status: 400 })
  }

  const docTypeId = (form.get('docTypeId') as string | null) ?? 'ua_internal_passport_booklet'

  // Collect all `file` entries (repeated key supports multi-page upload).
  const rawFiles = form.getAll('file').filter((v) => v && typeof v !== 'string') as File[]
  if (rawFiles.length === 0) {
    return NextResponse.json({ ok: false, error: 'Missing "file" field.' }, { status: 400 })
  }
  if (rawFiles.length > MAX_PAGES) {
    return NextResponse.json(
      { ok: false, error: `Too many pages: ${rawFiles.length}. Max ${MAX_PAGES}.` },
      { status: 413 },
    )
  }
  // Validate every page before spending any vision budget.
  for (const file of rawFiles) {
    const mime = file.type || 'image/jpeg'
    if (!ALLOWED_MIME.has(mime)) {
      return NextResponse.json(
        { ok: false, error: `Unsupported image type: ${mime}. Use JPEG, PNG, or WebP.` },
        { status: 415 },
      )
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { ok: false, error: `File too large: ${(file.size / 1024 / 1024).toFixed(1)} MB. Max 10 MB per page.` },
        { status: 413 },
      )
    }
  }

  // ── Central Brain path (flag-gated; default OFF = unchanged legacy below) ──
  // Replaces the single-Gemini reader with a 2-reader consensus
  // (Gemini + Google Vision) so a single AI is never the truth-source.
  let degradedFromBrain = false // true ⇒ brain was ON but errored → we fell to the guard-less legacy path
  if (process.env.CENTRAL_BRAIN_TRANSLATION === 'on') {
    try {
      const spec = DOC_TYPES[docTypeId]
      const gem = getGeminiApiKey() // any GEMINI_API_KEY* name the owner uses
      const gv = process.env.GOOGLE_CLOUD_VISION_API_KEY || process.env.GOOGLE_VISION_API_KEY
      if (spec && gem && gv) {
        const docs = await Promise.all(rawFiles.map(async (f) => ({
          docTypeId, mime: f.type || 'image/jpeg', image: Buffer.from(await f.arrayBuffer()),
        })))
        // D3b prose translator (#10): free text the glossary didn't cover (e.g. a
        // registry office's full name) is translated by DeepSeek with names/numbers
        // LOCKED, instead of being dropped. Fails open (keeps original + review).
        const ds = process.env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_CHAT_API_KEY
        const proseTranslator = ds ? deepseekProseTranslator({ apiKey: ds }) : undefined
        const br = await analyze({ product: 'translation', locale: 'en', documents: docs }, { geminiApiKey: gem, gvApiKey: gv, proseTranslator })
        const fields: FieldOut[] = br.recognizedFields.map((f) => ({
          field: f.field, value: f.value || null, raw_cyrillic: f.cyrillic || null,
          confidence: f.can_read ? 0.9 : 0, review_required: f.review_required, kind: f.source,
        }))
        // Only return the consensus result when it actually read something. When it
        // reads 0 fields, DEGRADE to the legacy single-read path below (proven to
        // read real Ukrainian docs) instead of hard-failing with a 502.
        if (fields.length > 0) {
          return NextResponse.json({
            ok: true, doc_type_id: docTypeId, fields,
            pages: [], page_count: rawFiles.length, provider: 'central-brain:consensus',
            model: 'gemini+google-vision', readiness: br.productReadiness,
            official_sources: br.officialSourcesUsed, status: 'ok:central-brain',
          }, { status: 200 })
        }
        console.warn('[central-brain translation] 0 fields — degrading to legacy single-read')
        degradedFromBrain = true
        // fall through to legacy path below
      }
    } catch (e: any) {
      console.error('[central-brain translation] fell back to legacy:', e?.message ?? e)
      degradedFromBrain = true
      // fall through to legacy path below — never break the endpoint
    }
  }

  // ── ONE BRAIN Core path — B2: Translation consumes same Core as TPS ──────
  // (flag: ONE_BRAIN_CORE_ENABLED=1, default OFF)
  //
  // Flow: readDocument (Gemini docintel) → buildCyrillicMap → docintelToCandidate
  //       → arbitrateDocument (Core judge) → toTranslationRows (B2 adapter)
  //
  // raw_cyrillic is preserved via cyrillicMap: KMU-55 transliteration produces the
  // English value, but the original Cyrillic text is kept separately for display.
  // Falls through to legacy if Core returns 0 fields or errors.
  if (process.env.ONE_BRAIN_CORE_ENABLED === '1') {
    try {
      const allCandidates: ReturnType<typeof docintelToCandidate>[] = []
      const cyrillicMap = new Map<string, string>()
      const corePageResults: Array<{ page: number; ok: boolean; status: string; ms: number }> = []
      for (let i = 0; i < rawFiles.length; i++) {
        const file = rawFiles[i]
        const buffer = Buffer.from(await file.arrayBuffer())
        const r = await readDocument(buffer, file.type || 'image/jpeg', docTypeId, { timeoutMs: 20_000 })
        corePageResults.push({ page: i + 1, ok: r.ok, status: r.status, ms: r.ms })
        if (r.ok && Array.isArray(r.fields)) {
          // Preserve Cyrillic BEFORE conversion to candidates (KMU-55 erases it)
          buildCyrillicMap(r.fields).forEach((v, k) => { if (!cyrillicMap.has(k)) cyrillicMap.set(k, v) })
          allCandidates.push(...r.fields.map((f) => docintelToCandidate(f, i + 1)))
        }
      }
      const canonicalFields = arbitrateDocument(allCandidates)
      if (canonicalFields.length > 0) {
        // B2: toTranslationRows = named adapter, maps canonical → Translation FieldOut
        const fields = toTranslationRows(canonicalFields, cyrillicMap)
        const requiresReview = fields.some((f) => f.review_required)
        console.info('[ONE_BRAIN_CORE B2] Translation: arbitrated', fields.length, 'fields; requiresReview=', requiresReview, 'cyrillicPreserved=', cyrillicMap.size)
        return NextResponse.json({
          ok: true, doc_type_id: docTypeId, fields,
          pages: corePageResults, page_count: rawFiles.length,
          provider: 'one-brain-core:translation-b2',
          model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
          status: 'ok:core-b2',
          core_version: 'b2',
        }, { status: 200 })
      }
      console.warn('[ONE_BRAIN_CORE B2] 0 fields after arbitration — falling through to legacy')
    } catch (e: any) {
      console.error('[ONE_BRAIN_CORE B2] error, falling through to legacy:', e?.message ?? e)
    }
  }

  // Run all pages sequentially (Gemini free tier rate-limits parallel calls
  // hard; sequential is more reliable + simpler to reason about for a 1-6
  // page job). Merge field-by-field, keeping the earliest non-empty value.
  const merged = new Map<string, FieldOut>()
  const pageResults: Array<{ page: number; ok: boolean; status: string; ms: number; provider?: string; error?: string }> = []
  let lastResult: Awaited<ReturnType<typeof readDocument>> | null = null

  for (let i = 0; i < rawFiles.length; i++) {
    const file = rawFiles[i]
    const mime = file.type || 'image/jpeg'
    const buffer = Buffer.from(await file.arrayBuffer())
    try {
      const r = await readDocument(buffer, mime, docTypeId, { timeoutMs: 15_000 })
      lastResult = r
      pageResults.push({ page: i + 1, ok: r.ok, status: r.status, ms: r.ms, ...(r.provider ? { provider: r.provider } : {}), ...(r.error ? { error: r.error } : {}) })
      if (r.ok && Array.isArray(r.fields)) {
        for (const f of r.fields) {
          const existing = merged.get(f.field)
          // Keep the earliest non-empty value. If existing entry has no
          // value but this page does, upgrade it.
          if (!existing) {
            merged.set(f.field, { ...f, source_page: i + 1 })
          } else if (!existing.value && f.value) {
            merged.set(f.field, { ...f, source_page: i + 1 })
          }
        }
      }
    } catch (e: any) {
      console.error('[translation/vision-extract page', i + 1, ']', e?.message ?? e)
      pageResults.push({ page: i + 1, ok: false, status: 'error', ms: 0, error: e?.message ?? 'unknown' })
    }
  }

  // Any field at all? Then the request is considered ok even if some pages
  // failed (e.g. user uploaded one good page + one blurry one).
  // #12: if we got here because the central brain ERRORED (not because the flag is
  // off), this is a DEGRADED path (single reader, no consensus guard) → force every
  // field to human review and tell the client, so a degraded read is never trusted.
  const fields = Array.from(merged.values()).map((f) =>
    degradedFromBrain ? { ...f, review_required: true } : f)
  const ok = fields.length > 0

  return NextResponse.json({
    ok,
    doc_type_id: docTypeId,
    fields,
    pages: pageResults,
    page_count: rawFiles.length,
    // Backward compat: keep the single-call shape too for legacy clients.
    anchor_read: lastResult?.anchor_read ?? null,
    provider: degradedFromBrain ? `legacy-fallback:${lastResult?.provider ?? 'gemini'}` : (lastResult?.provider ?? null),
    model: lastResult?.model ?? null,
    ms: pageResults.reduce((s, p) => s + p.ms, 0),
    ...(degradedFromBrain ? { degraded: true, degraded_reason: 'central-brain unavailable — used legacy single reader; verify every field against the document' } : {}),
    status: ok ? (degradedFromBrain ? 'ok:degraded-legacy' : 'ok') : (lastResult?.status ?? 'no_fields'),
    ...(ok ? {} : { error: lastResult?.error ?? 'No fields extracted across all pages.' }),
  }, { status: ok ? 200 : 502 })
}
