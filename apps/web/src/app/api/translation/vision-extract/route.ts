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
import { preprocessImage } from '@/lib/ocr/image-preprocess'
import { heicToJpeg } from '@/lib/ocr/heicToJpeg'
import { isQualityGateEnabled, decideImageQuality, metricsFromPreprocess } from '@/lib/docintel/quality/documentImageQuality'
import { applyOcrFieldSafety, isOcrFieldSafetyEnabled } from '@/lib/documentSafety/applyOcrFieldSafety'
import { readDocument } from '@/lib/docintel/documentFieldReader'
import { googleVisionProvider } from '@/lib/ocr/providers/google-vision'
import { isBlocked } from '@/lib/ocr/types'
import { applyDateEnsemble, isDateFieldName, extractDateCandidatesFromText } from '@/lib/docintel/ensemble/applyDateEnsemble'
import { readDateRegionsWithVision } from '@/lib/docintel/ensemble/dateRegionRead'
import { HANDWRITTEN_FABRICATION_RISK_CLASSES } from '@/lib/docintel/antiFabricationGate'
import { getGeminiApiKey } from '@/lib/gemini/apiKey'
import { normalizeGeminiModel } from '@/lib/gemini/model'
// ONE BRAIN Core — B2: Translation consumes same Core as TPS. toTranslationRows = the B2 adapter.
import { buildKnowledgeContext, applyKnowledgeBrainIfEnabled } from '@/lib/canonical/core/knowledgeBrain'
import { docintelToCandidate, buildCyrillicMap, toTranslationRows } from '@/lib/canonical/core/translationAdapter'
import { mrzCandidatesForTranslation } from '@/lib/canonical/core/mrzAuthority'
// POLICY_WIRED: document-class guards (2026-06-03 benchmark findings)
import {
  checkImageQuality,
  applyHardCaseReviewOverride,
  applyCertificateRoleGuard,
  docintelIdToDocumentClass,
  isUkrainianIdentityDoc,
} from '@/lib/canonical/core/documentClassPolicy'

export const dynamic = 'force-dynamic'
export const maxDuration = 120 // multi-page: N pages read in parallel + a legacy fallback pass; 60s killed 4-page passports. Vision ~16-40s/page (handwriting). Caps at the Vercel plan limit if lower.

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  // HEIC / HEIF — iPhone default. heicToJpeg (WASM libde265 — sharp's prebuilt
  // libvips lacks the HEVC codec) converts at intake; downstream sees JPEG only.
  'image/heic',
  'image/heif',
])
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
  /** ENSEMBLE_DATE: reasons + the second engine's date reading on a cross-engine conflict. */
  review_reasons?: string[]
  ensemble_candidate?: string | null
}

/**
 * ENSEMBLE_DATE_ENABLED (default OFF): cross-engine date check shared by BOTH the
 * Core path and the legacy path. For handwritten-risk docs, read the date REGIONS
 * with a zoomed Google Vision pass and reconcile — disagreement forces review +
 * attaches the second reading. Fail-open; never lowers review. Returns PII-free diag.
 */
async function runDateEnsemble<T extends {
  field: string; kind?: string; value?: string | null; raw_cyrillic?: string | null
  review_required?: boolean; review_reasons?: string[]; ensemble_candidate?: string | null
}>(fields: T[], docTypeId: string, firstFile: File): Promise<{ fields: T[]; diag: Record<string, unknown> }> {
  if (!(
    process.env.ENSEMBLE_DATE_ENABLED === '1' &&
    isUkrainianIdentityDoc(docTypeId) &&
    HANDWRITTEN_FABRICATION_RISK_CLASSES.has(docintelIdToDocumentClass(docTypeId)) &&
    fields.some((f) => isDateFieldName(f.field, f.kind))
  )) return { fields, diag: { status: 'off' } }
  try {
    const apiKey = getGeminiApiKey()
    const imageBuffer = Buffer.from(await firstFile.arrayBuffer())
    const mimeType = firstFile.type || 'image/jpeg'
    let secondText = ''
    let diag: Record<string, unknown> = {}
    if (apiKey) {
      const rr = await readDateRegionsWithVision({
        imageBuffer, mimeType, geminiApiKey: apiKey,
        geminiModel: normalizeGeminiModel(process.env.GEMINI_MODEL, 'gemini-3.1-pro-preview'),
        vision: googleVisionProvider,
      })
      secondText = rr.text; diag = { ...rr.diag, source: 'region_crop' }
    }
    if (!secondText) {
      const full = await googleVisionProvider.extractText({ imageBuffer, mimeType })
      if (!isBlocked(full)) { secondText = full.raw_text ?? ''; diag = { ...diag, fallback_chars: secondText.length } }
    }
    if (secondText) {
      // PII-free diagnostics: do month words / years appear, and how many date candidates parsed?
      const monthHits = (secondText.match(/січ|лют|берез|квіт|трав|черв|лип|серп|вер|жовт|листоп|груд|январ|феврал|март|апрел|ма[йя]|июн|июл|август|сентябр|октябр|ноябр|декабр/gi) || []).length
      const yearHits = (secondText.match(/\b(1[89]\d{2}|20\d{2})\b/g) || []).length
      const cands = extractDateCandidatesFromText(secondText).length
      const outcome = applyDateEnsemble(fields, secondText)
      if (outcome.disagreements.length) console.info('[date_ensemble] disagreement', JSON.stringify({ doc_type_id: docTypeId, fields: outcome.disagreements }))
      return { fields: outcome.fields, diag: { ...diag, status: outcome.applied ? 'applied' : 'no_dates', disagreements: outcome.disagreements.length, month_hits: monthHits, year_hits: yearHits, cands } }
    }
    return { fields, diag: { ...diag, status: 'no_dates' } }
  } catch (e) {
    return { fields, diag: { status: 'error', error: e instanceof Error ? e.message.slice(0, 60) : 'err' } }
  }
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
  // HEIC/HEIF (iPhone default camera format) → JPEG BEFORE validation, so every
  // downstream read (ensemble, Core, legacy) sees a plain JPEG. Fail-open: a
  // failed decode leaves the original file, which the MIME gate below rejects
  // with the standard 415 — never a 500.
  for (let i = 0; i < rawFiles.length; i++) {
    const f = rawFiles[i]
    const suspicious =
      /heic|heif/i.test(f.type) || !f.type ||
      f.type === 'application/octet-stream' || /\.(heic|heif)$/i.test(f.name)
    if (!suspicious) continue
    const conv = await heicToJpeg(Buffer.from(await f.arrayBuffer()), f.type)
    if (conv.converted) {
      rawFiles[i] = new File(
        [new Uint8Array(conv.buffer)],
        f.name.replace(/\.(heic|heif)$/i, '') + '.jpg',
        { type: 'image/jpeg' },
      )
    }
  }
  // Validate every page before spending any vision budget.
  for (const file of rawFiles) {
    const mime = file.type || 'image/jpeg'
    if (!ALLOWED_MIME.has(mime)) {
      return NextResponse.json(
        { ok: false, error: `Unsupported image type: ${mime}. Use JPEG, PNG, WebP, or HEIC.` },
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

  // ── POLICY_WIRED: checkImageQuality — document-class size guard ──────────
  // Runs BEFORE any Gemini/Vision call. Blocks tiny images (82KB marriage
  // apostille proved insufficient). Warns on >2MB images (503 risk).
  // Only applies to Ukrainian identity documents (not US forms).
  if (isUkrainianIdentityDoc(docTypeId)) {
    const docClass = docintelIdToDocumentClass(docTypeId)
    // Use largest file for the size check — if any page is too small, block all
    const largestFile = rawFiles.reduce((max, f) => f.size > max.size ? f : max, rawFiles[0])
    const smallestFile = rawFiles.reduce((min, f) => f.size < min.size ? f : min, rawFiles[0])
    // Block if the smallest file is below the minimum (every page must be readable)
    const qualityCheck = checkImageQuality(docClass, smallestFile.size)
    if (qualityCheck.action === 'needs_better_scan') {
      console.warn('[documentClassPolicy] needs_better_scan:', qualityCheck.reason, 'docTypeId:', docTypeId)
      return NextResponse.json(
        {
          ok: false,
          status: 'needs_better_scan',
          review_required: true,
          reason: qualityCheck.reason,
          fields: null,
          error: 'Image quality insufficient for reliable extraction. Please upload a higher-resolution scan.',
          doc_type_id: docTypeId,
        },
        { status: 200 },
      )
    }
    if (checkImageQuality(docClass, largestFile.size).action === 'resize') {
      console.warn('[documentClassPolicy] image_large_resize_recommended:', largestFile.size, 'bytes, docTypeId:', docTypeId)
      // Continue — do not block, but log for monitoring
    }
  }

  // ── ONE BRAIN Core — default path (Phase 2.1) ────────────────────────────
  //
  // Flow: readDocument (Gemini docintel) → buildCyrillicMap → docintelToCandidate
  //       → arbitrateDocument (Core judge) → toTranslationRows (B2 adapter)
  //
  // raw_cyrillic threaded from ExtractedDocField → FieldCandidate.rawCyrillic
  // → CanonicalField.rawCyrillic → FieldOut.raw_cyrillic (Phase 2.0).
  // cyrillicMap kept as display fallback only.
  // 0 fields → legacy reader (with preprocessing) as fallback; errors → legacy.
  try {
    const allCandidates: ReturnType<typeof docintelToCandidate>[] = []
    const cyrillicMap = new Map<string, string>()
    // PAGES IN PARALLEL (504 fix, 2026-06-11). Sequential pages overflowed the
    // 60s hobby-plan ceiling on a 2-page handwritten booklet (16-40s/page →
    // owner hit four 504s live). Parallel wall-clock = slowest page, not the
    // sum. Paid Gemini tier handles 2-6 concurrent calls; per-page timeout
    // stays 40s. Merge order is preserved by index (earliest page still wins
    // in the arbiter) — results are awaited as a positional array.
    const corePages = await Promise.all(rawFiles.map(async (file, i) => {
      // HEIC was already converted to JPEG at intake (heicToJpeg, top of handler).
      const buffer = Buffer.from(await file.arrayBuffer())
      const r = await readDocument(buffer, file.type || 'image/jpeg', docTypeId, { timeoutMs: 40_000, product: 'translation' })
      return { i, r }
    }))
    const corePageResults: Array<{ page: number; ok: boolean; status: string; ms: number }> = []
    for (const { i, r } of corePages) {
      corePageResults.push({ page: i + 1, ok: r.ok, status: r.status, ms: r.ms })
      if (r.ok && Array.isArray(r.fields)) {
        buildCyrillicMap(r.fields).forEach((v, k) => { if (!cyrillicMap.has(k)) cyrillicMap.set(k, v) })
        allCandidates.push(...r.fields.map((f) => docintelToCandidate(f, i + 1)))
      }
    }
    // 1A — MRZ authority for the international passport (flag-gated, default OFF
    // = byte-identical prod). A valid MRZ (Latin, math-checkable) auto-resolves
    // passport_number/dob/expiry/names so the field doesn't fall to
    // critical_no_mrz_anchor. Fail-open: Vision blocked / no MRZ lines → [] →
    // identical to today. Vision OCR runs on the first (data) page only.
    if (process.env.MRZ_TRANSLATION_ENABLED === '1' && docTypeId === 'ua_international_passport' && rawFiles.length > 0) {
      try {
        const firstBuf = Buffer.from(await rawFiles[0].arrayBuffer())
        const vis = await googleVisionProvider.extractText({ imageBuffer: firstBuf, mimeType: rawFiles[0].type || 'image/jpeg' })
        if (!isBlocked(vis) && vis.raw_text) {
          const mrz = mrzCandidatesForTranslation(vis.raw_text, docTypeId)
          if (mrz.length > 0) {
            allCandidates.push(...mrz)
            console.info('[Core B2] MRZ_WIRED:', mrz.length, 'candidates for', docTypeId, 'valid=', mrz[0]?.mrzCheckValid)
          }
        }
      } catch (e) {
        console.warn('[Core B2] MRZ best-effort failed (fail-open):', (e as Error)?.message ?? e)
      }
    }
    const canonicalFields = applyKnowledgeBrainIfEnabled(
      allCandidates,
      buildKnowledgeContext({ docTypeId, product: 'translation' }),
    )
    if (canonicalFields.length > 0) {
      let fields = toTranslationRows(canonicalFields, cyrillicMap)
      // Cross-engine date ensemble (handwritten-risk; flag-gated) — wired HERE in
      // the Core path because this is the live return (status ok:core-b2).
      const ens = await runDateEnsemble(fields, docTypeId, rawFiles[0])
      fields = ens.fields
      const requiresReview = fields.some((f) => f.review_required)
      console.info('[Core B2] Translation: arbitrated', fields.length, 'fields; requiresReview=', requiresReview)
      return NextResponse.json({
        ok: true, doc_type_id: docTypeId, fields,
        date_ensemble: ens.diag,
        pages: corePageResults, page_count: rawFiles.length,
        provider: 'one-brain-core:translation-b2',
        model: normalizeGeminiModel(process.env.GEMINI_MODEL, 'gemini-2.5-flash'),
        status: 'ok:core-b2',
        core_version: 'b2',
      }, { status: 200 })
    }
    console.warn('[Core B2] 0 fields — falling through to legacy reader (with preprocessing)')
  } catch (e: any) {
    console.error('[Core B2] error, falling through to legacy reader:', e?.message ?? e)
  }

  // Legacy fallback — pages IN PARALLEL too (504 fix, 2026-06-11; the old
  // sequential rationale was the FREE Gemini tier, prod runs the paid key).
  // Merge field-by-field after all pages settle, keeping the earliest
  // non-empty value (page order preserved via the positional results array).
  const merged = new Map<string, FieldOut>()
  const pageResults: Array<{ page: number; ok: boolean; status: string; ms: number; provider?: string; error?: string }> = []
  let lastResult: Awaited<ReturnType<typeof readDocument>> | null = null

  type LegacyPage =
    | { kind: 'reshoot'; page: number; q: ReturnType<typeof decideImageQuality> }
    | { kind: 'read'; page: number; r: Awaited<ReturnType<typeof readDocument>> }
    | { kind: 'error'; page: number; message: string }
  const legacyPages: LegacyPage[] = await Promise.all(rawFiles.map(async (file, i): Promise<LegacyPage> => {
    const mime = file.type || 'image/jpeg'
    const rawBuffer = Buffer.from(await file.arrayBuffer())
    // Auto-rotate (EXIF), resize >2048px, normalize orientation.
    // Fixes upside-down/rotated phone photos of birth certs, marriage certs, etc.
    const pre = await preprocessImage(rawBuffer, mime).catch(() => null)
    const buffer = pre?.ok ? pre.buffer : rawBuffer
    const effectiveMime = pre?.ok ? pre.mimeType : mime
    // ── D0 intake quality gate (QUALITY_GATE_ENABLED, default OFF) ──────────
    // Flag OFF ⇒ skipped ⇒ byte-identical. ON ⇒ a too-blurry/dark/small photo is
    // bounced back for a reshoot BEFORE model spend. Never a fabrication signal.
    if (isQualityGateEnabled() && pre?.ok) {
      const q = decideImageQuality(metricsFromPreprocess(pre))
      if (q.reshoot_required) return { kind: 'reshoot', page: i + 1, q }
    }
    try {
      // 25s (was 15s): the primary model (gemini-3.1-pro-preview) takes 20-40s on
      // a full page, so 15s aborted it every time → always fell to the flash
      // fallback → every field flagged review. Pages run in parallel under the
      // 60s route budget, so 25s is safe.
      const r = await readDocument(buffer, effectiveMime, docTypeId, { timeoutMs: 25_000, product: 'translation' })
      return { kind: 'read', page: i + 1, r }
    } catch (e: any) {
      console.error('[translation/vision-extract page', i + 1, ']', e?.message ?? e)
      return { kind: 'error', page: i + 1, message: e?.message ?? 'unknown' }
    }
  }))
  for (const p of legacyPages) {
    if (p.kind === 'reshoot') {
      return NextResponse.json({
        ok: false,
        status: 'reshoot_required',
        reshoot: true,
        page: p.page,
        message_key: p.q.user_message_key,
        quality_decision: p.q.decision,
        signals: p.q.signals,
      }, { status: 200 })
    }
    if (p.kind === 'error') {
      pageResults.push({ page: p.page, ok: false, status: 'error', ms: 0, error: p.message })
      continue
    }
    const r = p.r
    lastResult = r
    pageResults.push({ page: p.page, ok: r.ok, status: r.status, ms: r.ms, ...(r.provider ? { provider: r.provider } : {}), ...(r.error ? { error: r.error } : {}) })
    if (r.ok && Array.isArray(r.fields)) {
      for (const f of r.fields) {
        const existing = merged.get(f.field)
        // Keep the earliest non-empty value. If existing entry has no
        // value but this page does, upgrade it.
        if (!existing) {
          merged.set(f.field, { ...f, source_page: p.page })
        } else if (!existing.value && f.value) {
          merged.set(f.field, { ...f, source_page: p.page })
        }
      }
    }
  }

  // Any field at all? Then the request is considered ok even if some pages
  // failed (e.g. user uploaded one good page + one blurry one).
  // Reaching here means Core returned 0 fields or errored — legacy reader ran.
  let fields = Array.from(merged.values())
  const ok = fields.length > 0

  // ── POLICY_WIRED: post-extraction document-class guards ───────────────────
  // Applied AFTER extraction, BEFORE response. Only for Ukrainian identity docs.
  let translationPolicyGuardStatus: 'not_applicable' | 'applied' | 'role_guard_triggered' = 'not_applicable'
  if (ok && isUkrainianIdentityDoc(docTypeId)) {
    const docClass = docintelIdToDocumentClass(docTypeId)

    // Wire 2: applyHardCaseReviewOverride — forces review_required=true on hard-case classes
    const hardCaseCheck = applyHardCaseReviewOverride(docClass, { review_required: false })
    if ('override_reason' in hardCaseCheck) {
      console.info('[documentClassPolicy] applyHardCaseReviewOverride applied (translation):', docClass, hardCaseCheck.override_reason)
      fields = fields.map((f) => ({ ...f, review_required: true }))
      translationPolicyGuardStatus = 'applied'
    }

    // Wire 3: applyCertificateRoleGuard — rejects generic family_name without role grounding
    const fieldRecord: Record<string, unknown> = {}
    for (const f of fields) {
      fieldRecord[f.field] = f.value
    }
    const roleCheck = applyCertificateRoleGuard(docClass, fieldRecord)
    if (!roleCheck.safe) {
      console.warn('[documentClassPolicy] applyCertificateRoleGuard triggered (translation):', roleCheck.reason, 'fields:', roleCheck.forcedReviewFields)
      const forcedSet = new Set(roleCheck.forcedReviewFields)
      fields = fields.map((f) => forcedSet.has(f.field) ? { ...f, review_required: true } : f)
      translationPolicyGuardStatus = 'role_guard_triggered'
    }
  }

  // ── ENSEMBLE_DATE_ENABLED (default OFF): cross-engine date check (legacy path) ──
  // Same shared helper as the Core path. OFF ⇒ skipped (byte-identical).
  const legacyEns = ok ? await runDateEnsemble(fields, docTypeId, rawFiles[0]) : { fields, diag: { status: 'off' } as Record<string, unknown> }
  fields = legacyEns.fields
  const dateEnsembleDiag = legacyEns.diag

  // ── C3: Global OCR field safety guard (OCR_FIELD_SAFETY_ENABLED, default OFF) ──
  // OFF ⇒ this block is skipped ⇒ byte-identical. ON ⇒ unsafe critical reads (hard-case,
  // source/stale mismatch, low conf, zero recognition) become candidate-only + review/manual,
  // never shown as the final value. Pure guard; no content changed, no PII.
  let ocrFieldSafety: { applied: boolean; unresolved_critical?: boolean } = { applied: false }
  if (isOcrFieldSafetyEnabled()) {
    const res = applyOcrFieldSafety(fields as never[], {
      flow: 'translation_public',
      document_class: docintelIdToDocumentClass(docTypeId),
    }, { zeroRecognition: !ok })
    fields = res.fields as typeof fields
    ocrFieldSafety = { applied: true, unresolved_critical: res.anyUnresolvedCritical }
  }

  return NextResponse.json({
    ok,
    doc_type_id: docTypeId,
    fields,
    ocr_field_safety: ocrFieldSafety,
    date_ensemble: dateEnsembleDiag,
    policy_guard_status: translationPolicyGuardStatus,
    pages: pageResults,
    page_count: rawFiles.length,
    // Backward compat: keep the single-call shape too for legacy clients.
    anchor_read: lastResult?.anchor_read ?? null,
    provider: lastResult?.provider ?? null,
    model: lastResult?.model ?? null,
    ms: pageResults.reduce((s, p) => s + p.ms, 0),
    status: ok ? 'ok:legacy-reader' : (lastResult?.status ?? 'no_fields'),
    ...(ok ? {} : { error: lastResult?.error ?? 'No fields extracted across all pages.' }),
    // Zero recognition is review_required even without the C3 flag, so the client
    // always treats a no-fields read as "needs your review", never silent success.
    ...(ok ? {} : { review_required: true }),
    // HTTP 200 always. "No fields recognized" / per-page provider error are EXPECTED
    // operational outcomes communicated by ok:false + status + error in the body — NOT
    // gateway errors. Returning 502 here was the P0 incident: it made Cloudflare mask the
    // JSON with a generic "error code: 502" page and the client show "HTTP 502" instead of
    // a real message, for every hard-case doc that read 0 fields. This matches the route's
    // other non-fatal returns (needs_better_scan / reshoot_required also return 200). True
    // unhandled exceptions still surface as a platform 500. (P0 triage 2026-06-06.)
  }, { status: 200 })
}
