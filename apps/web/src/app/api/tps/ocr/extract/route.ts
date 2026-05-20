/**
 * POST /api/tps/ocr/extract — TPS document OCR endpoint.
 *
 * SPRINT-OCR Day 1, Block B.
 *
 * Accepts a multipart upload of a single document image (passport, I-94,
 * or EAD card), runs Google Vision DOCUMENT_TEXT_DETECTION on it through
 * the existing OCR provider, and returns the raw `OcrResult` (words +
 * lines + bboxes) for downstream agents to consume.
 *
 * This route does NOT yet do field extraction, classification, or
 * confidence routing — those come in later blocks. It is a thin wrapper
 * around the OCR provider so we can prove the Vision key is wired in
 * production before building the rest of the pipeline.
 *
 * Privacy: the route does NOT persist the image. After the response is
 * returned, the in-memory buffer is dropped. Persistence (Supabase
 * Storage) is a later block.
 *
 * Reuse: the OCR provider, types, and image-preprocess helpers are
 * shared with the Translation Engine v5 — see docs/translation/
 * DOCUMENT_TRANSLATION_ENGINE_V5.md §3.
 */

import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, getClientIP } from '@/lib/security/rate-limit'
import { googleVisionProvider } from '@/lib/ocr/providers/google-vision'
import { isBlocked } from '@/lib/ocr/types'
import { preprocessImage } from '@/lib/ocr/image-preprocess'
import { runPassportModule } from '@/lib/tps/modules/passport'
import { runPassportBookletModule } from '@/lib/tps/modules/passportBooklet'
import { runI94Module } from '@/lib/tps/modules/i94'
import { runEadModule } from '@/lib/tps/modules/ead'
import type { TpsModuleResult, TpsExtractedField } from '@/lib/tps/types'
import { applyContract } from '@/lib/tps/ocr/documentContracts'
import {
  runBrain,
  validateBrainField,
  isBrainEnabled,
  type DocumentBrainOutput,
} from '@/lib/tps/ai/documentBrain'

// Vision REST call needs full Node runtime (Buffer + fetch with timeout).
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// 10 MB hard limit per image. USCIS recommends pages < 5 MB.
const MAX_BYTES = 10 * 1024 * 1024

// Accept only inline images. PDFs are rejected here — they should be
// pre-split client-side or via a different endpoint.
// SVG / HTML / scripts are NOT in the list — fail-closed against the
// disguised-payload class of attacks.
const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/jpg', // some clients use the non-standard /jpg subtype
  'image/png',
  'image/webp',
  // HEIC / HEIF — iPhone default. Sharp can transcode in preprocessing.
  'image/heic',
  'image/heif',
])

export async function POST(req: NextRequest) {
  // ── Rate limit: 20 OCR calls per minute per IP. Vision is paid; we
  //    do not want a single user (or bot) hammering it.
  const ip = getClientIP(req)
  const rl = await rateLimit(`tps-ocr:${ip}`, 20, 60_000)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many OCR requests. Please wait a moment.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt.getTime() - Date.now()) / 1000)) } },
    )
  }

  // ── Parse multipart form
  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json(
      { error: 'Expected multipart/form-data with a "file" field.' },
      { status: 400 },
    )
  }

  const file = form.get('file')
  const docTypeHint = (form.get('doc_type_hint') as string | null) ?? ''

  if (!file || typeof file === 'string') {
    return NextResponse.json(
      { error: 'Missing "file" field. Send the image as multipart form-data.' },
      { status: 400 },
    )
  }

  const mimeType = file.type || 'application/octet-stream'
  if (!ALLOWED_MIME.has(mimeType)) {
    return NextResponse.json(
      {
        error: 'Unsupported image type. Use JPEG, PNG, or WebP.',
        received_mime: mimeType,
        allowed: Array.from(ALLOWED_MIME),
      },
      { status: 415 },
    )
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      {
        error: 'Image is too large. Maximum 10 MB per file.',
        size_bytes: file.size,
        max_bytes: MAX_BYTES,
      },
      { status: 413 },
    )
  }

  const arrayBuffer = await file.arrayBuffer()
  const rawBuffer = Buffer.from(arrayBuffer)

  // ── Image-quality gate (PP.T2 — reuses the v5 translation engine's
  //    preprocessor). This catches blurry / too-small / corrupt photos
  //    BEFORE we pay for a Vision call AND returns a structured error
  //    that DocumentUploadScreen can render in the user's language
  //    ("plохо видно — снимите ещё раз"). Phone photos with EXIF
  //    rotation get auto-rotated, and oversized images get resized to
  //    ≤2048px so Vision doesn't time out on 50-MP camera shots.
  const t0 = Date.now()
  const pre = await preprocessImage(rawBuffer, mimeType)
  if (!pre.ok) {
    return NextResponse.json(
      {
        error: pre.message,
        quality_error: {
          code: pre.code,            // 'too_small' | 'too_blurry' | 'corrupt_image' | 'unsupported_file_type'
          message: pre.message,      // user-safe localized in the client
        },
        ok: false,
      },
      {
        status: 422,
        headers: {
          'X-OCR-QualityGate': pre.code,
        },
      },
    )
  }
  // Use the normalised buffer + MIME. The original is dropped here —
  // no global cache, no logging, GC eligible after response.
  const imageBuffer = pre.buffer
  const effectiveMime = pre.mimeType

  // ── Call OCR provider
  const result = await googleVisionProvider.extractText({ imageBuffer, mimeType: effectiveMime })

  if (isBlocked(result)) {
    return NextResponse.json(
      {
        error: result.reason,
        required_env_vars: result.required_env_vars,
        configured: false,
      },
      { status: 503 },
    )
  }

  // ── Run the per-document extraction module if a hint was supplied.
  //    Hint-based routing keeps the response shape stable: caller asks
  //    "this is a passport" and gets passport-specific TpsExtractedField[].
  //    Without a hint we return raw OCR only.
  //
  //    For doc_type_hint=passport we try BOTH formats:
  //      1. TD3 MRZ (international Ukrainian passport / загранпаспорт)
  //      2. Internal Ukrainian passport-booklet (паспорт-книжка) — if TD3
  //         not located.
  //    This is critical for real Ukrainian users — many never had a
  //    travel passport and only have the internal booklet, which is
  //    explicitly accepted by USCIS I-821 Instructions as a national
  //    identity document with photograph.
  const document_id = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  let moduleResult: TpsModuleResult | null = null
  switch (docTypeHint) {
    case 'passport': {
      const td3 = runPassportModule(result, { document_id })
      if (td3.matched) {
        moduleResult = td3
      } else {
        // Fallback to internal-passport-booklet label-based extraction.
        const booklet = runPassportBookletModule(result, { document_id })
        if (booklet.matched) {
          moduleResult = booklet
        } else {
          // Neither matched — surface the more informative reason so the
          // user-facing UI can localize properly.
          moduleResult = td3.match_reason === 'mrz_not_located'
            ? booklet // (matched=false, booklet_signals_missing) — better hint
            : td3
        }
      }
      break
    }
    case 'i94':
      moduleResult = runI94Module(result, { document_id })
      break
    case 'ead':
      moduleResult = runEadModule(result, { document_id })
      break
    default:
      moduleResult = null
  }

  // ── DS.2 — Optional AI Brain fallback. Runs ONLY when:
  //   (a) operator has set TPS_AI_BRAIN_ENABLED=1 in the environment, AND
  //   (b) the rule-based module produced no result OR fewer than 3 fields,
  //       OR the document type hint is missing.
  // Privacy: only raw_text + lines (no image, no PII bundle beyond
  // what Vision already extracted) is sent to DeepSeek.
  // Validators (validateBrainField) are applied to each Brain field
  // before it's surfaced — anything failing is left as requires_review
  // and is never auto-merged into PDF data.
  let brainResult: DocumentBrainOutput | null = null
  const ruleFieldsCount = moduleResult?.fields?.length ?? 0
  const shouldTryBrain =
    isBrainEnabled() &&
    (moduleResult === null || moduleResult.matched === false || ruleFieldsCount < 3)
  if (shouldTryBrain) {
    try {
      brainResult = await runBrain({
        raw_text: result.raw_text,
        lines: result.lines.map((l) => l.text),
        doc_type_hint: docTypeHint || null,
      })
    } catch (e: unknown) {
      // Never let Brain failure crash the OCR response. Surface as a
      // soft warning — the user still gets rule-based output + can edit.
      brainResult = {
        ok: false,
        error_code: 'UNKNOWN',
        detail: e instanceof Error ? e.message : 'unknown',
      }
    }
  }

  // Build extra TpsExtractedField[] from validated Brain output. Each
  // brain-derived field is marked extraction_source='ai_brain' so the
  // review screen can render an "AI" badge and the user explicitly
  // confirms it.
  let brainFields: TpsExtractedField[] = []
  let brainSkipped: Array<{ field: string; reason: string }> = []
  if (brainResult?.ok) {
    const r = brainResult.result
    for (const [k, f] of Object.entries(r.fields)) {
      if (!f) continue
      const validation = validateBrainField(k, f)
      if (!validation.ok) {
        brainSkipped.push({ field: k, reason: validation.reason ?? 'invalid' })
        continue
      }
      brainFields.push({
        field: k,
        raw_value: f.source_value,
        normalized_value: f.final_value,
        extraction_source: 'ai_brain',
        source_document_id: document_id,
        source_zone: f.source_line ?? 'ai_brain',
        bbox: null,
        language_layer: 'mixed',
        confidence: f.confidence,
        review_required: f.requires_review,
        ocr_word_ids: [],
        passes: [],
        failures: [],
        user_corrected: false,
      })
    }
  }

  // Merge strategy: rule-based fields win when both sources have the
  // same field key (rule-based is deterministic and audited). Brain
  // fills the gaps.
  let mergedModule = moduleResult
  if (brainFields.length > 0) {
    const existingKeys = new Set<string>(moduleResult?.fields?.map((f) => f.field) ?? [])
    const additions = brainFields.filter((f) => !existingKeys.has(f.field))
    mergedModule = {
      module:
        (moduleResult?.module as string) ||
        (brainResult?.ok ? `ai_brain:${brainResult.result.document_type}` : 'ai_brain'),
      matched: (moduleResult?.matched ?? false) || additions.length > 0,
      match_reason: moduleResult?.match_reason ?? 'ai_brain_fallback',
      fields: [...(moduleResult?.fields ?? []), ...additions],
      manual_review_required:
        Boolean(moduleResult?.manual_review_required) ||
        (brainResult?.ok ? brainResult.result.needs_manual_review : false),
    } as TpsModuleResult
  }

  // ── Document Slot Firewall ─────────────────────────────────────────────
  // Apply the per-slot allowed/forbidden field contract BEFORE we surface
  // anything to the wizard. This blocks two real failure modes seen in
  // production:
  //
  //   1. Brain hallucinating fields the document can't possibly contain
  //      (e.g. an A-number from a passport upload).
  //   2. User dropping the wrong document into the wrong slot (e.g.
  //      passport into the I-94 input). The Brain's `document_type`
  //      classification doesn't match what the slot expects → flag
  //      `slot_mismatch: true` so the wizard can warn instead of
  //      silently merging unrelated fields.
  //
  // The contract is the single source of truth; defining a new field
  // requires explicitly listing it under the right slot.
  const rawDocTypeFromBrain =
    brainResult?.ok ? brainResult.result.document_type : null
  const allMergedKeys = mergedModule
    ? Array.from(new Set(mergedModule.fields.map((f) => f.field)))
    : []
  const contract = applyContract(docTypeHint, allMergedKeys, rawDocTypeFromBrain)
  if (mergedModule && contract.rejected_fields.length > 0) {
    const acceptedSet = new Set(contract.accepted_field_keys)
    mergedModule = {
      ...mergedModule,
      fields: mergedModule.fields.filter((f) => acceptedSet.has(f.field)),
    }
  }

  // ── Top-level diagnostics so the wizard, monitors, and audit scripts
  // can see at a glance what happened to extraction without parsing the
  // nested brain object. No PII surfaced — counts and codes only.
  const finalFieldKeys = mergedModule
    ? Array.from(new Set(mergedModule.fields.map((f) => f.field))).sort()
    : []
  const finalFieldCount = finalFieldKeys.length
  const brainStatus: 'off' | 'skipped' | 'ran' | 'error' = !isBrainEnabled()
    ? 'off'
    : !shouldTryBrain
      ? 'skipped'
      : brainResult?.ok
        ? 'ran'
        : 'error'
  const brainErrorCode = brainResult && !brainResult.ok ? brainResult.error_code : null
  const brainAddedCount = brainFields.length

  // ── Successful OCR. Build a response with just what downstream agents
  //    need; we do NOT include the raw API response (could leak provider
  //    internals or echoed key).
  return NextResponse.json(
    {
      ok: true,
      provider: result.provider,
      doc_type_hint: docTypeHint || null,
      document_id,
      raw_text: result.raw_text,
      vision_text_length: result.raw_text.length,
      page_count: result.pages.length,
      word_count: result.words.length,
      line_count: result.lines.length,
      // Flat extraction diagnostics — auditable at a glance.
      brain_status: brainStatus,
      brain_error_code: brainErrorCode,
      brain_added_count: brainAddedCount,
      final_field_count: finalFieldCount,
      final_field_keys: finalFieldKeys,
      // ── Slot firewall diagnostics. Surfaces both the hard-rejected
      // fields (so the wizard never sees them) and the document-type
      // mismatch flag (so the wizard can show a "wrong document for
      // this slot" warning instead of silently merging unrelated data).
      slot: contract.slot,
      slot_mismatch: contract.slot_mismatch,
      detected_document_type: contract.detected_document_type,
      rejected_fields: contract.rejected_fields,
      rejected_field_count: contract.rejected_fields.length,
      pages: result.pages.map((p) => ({
        page: p.page,
        width: p.width,
        height: p.height,
        line_count: p.lines.length,
        word_count: p.words.length,
      })),
      words: result.words,    // includes ids, bboxes, confidence
      lines: result.lines,    // includes ids, bboxes
      processing_ms: result.processing_ms,
      route_total_ms: Date.now() - t0,
      warnings: result.warnings,
      // Per-document module output — present only when doc_type_hint is set.
      // If the AI Brain ran and added fields, `module` is the merged shape.
      module: mergedModule,
      // Backward-compatible aliases for evidence scripts and external checks.
      // Keep these flat so shell tooling can grep counts/keys quickly.
      module_result: mergedModule,
      module_matched: mergedModule ? mergedModule.matched : null,
      module_field_count: mergedModule ? mergedModule.fields.length : 0,
      module_field_keys: mergedModule
        ? Array.from(new Set(mergedModule.fields.map((f) => f.field))).sort()
        : [],
      // DS.2 — Brain diagnostics surfaced to the client (UI never renders
      // raw_response_length; this is for /api/tps/health-style monitoring).
      brain: brainResult
        ? brainResult.ok
          ? {
              ok: true,
              document_type: brainResult.result.document_type,
              document_type_confidence: brainResult.result.document_type_confidence,
              field_count: Object.keys(brainResult.result.fields).length,
              needs_manual_review: brainResult.result.needs_manual_review,
              warnings: brainResult.result.warnings,
              validated_skipped: brainSkipped,
            }
          : {
              ok: false,
              error_code: brainResult.error_code,
              detail: brainResult.detail,
            }
        : { ok: false, error_code: 'NOT_RUN', detail: shouldTryBrain ? 'flag_off' : 'rules_sufficient' },
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store',
        // Surface counts in headers so curl smoke can assert without
        // parsing JSON.
        'X-OCR-Provider': result.provider,
        'X-OCR-Word-Count': String(result.words.length),
        'X-OCR-Page-Count': String(result.pages.length),
        // Preprocess fingerprint — auditors can see what the gate did.
        'X-OCR-Preprocess-Resized': String(pre.resized),
        'X-OCR-Preprocess-Width': String(pre.width),
        'X-OCR-Preprocess-Height': String(pre.height),
        'X-TPS-Module': mergedModule ? mergedModule.module : 'none',
        'X-TPS-Module-Matched': mergedModule ? String(mergedModule.matched) : 'na',
        'X-TPS-Module-Fields': mergedModule ? String(mergedModule.fields.length) : '0',
        'X-TPS-Module-ManualReview': mergedModule ? String(mergedModule.manual_review_required) : 'na',
        // Brain headers — only present when the Brain was attempted.
        'X-TPS-Brain': brainResult ? (brainResult.ok ? brainResult.result.document_type : `error:${brainResult.error_code}`) : 'off',
        'X-TPS-Brain-Added': String(brainFields.length),
        'X-TPS-Brain-Skipped': String(brainSkipped.length),
      },
    },
  )
}

export async function GET() {
  // Friendly response for someone who lands here from a browser address bar.
  return NextResponse.json(
    {
      route: '/api/tps/ocr/extract',
      method: 'POST',
      content_type: 'multipart/form-data',
      fields: {
        file: 'JPEG / PNG / WebP image (≤ 10 MB)',
        doc_type_hint: 'optional: passport | i94 | ead | i797 | evidence',
      },
      note: 'This is a thin OCR endpoint. Field extraction and classification happen in later pipeline stages.',
    },
    { status: 405, headers: { Allow: 'POST' } },
  )
}
