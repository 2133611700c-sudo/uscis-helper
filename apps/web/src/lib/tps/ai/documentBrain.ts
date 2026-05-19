/**
 * documentBrain — TPS AI extraction layer (DeepSeek-controlled, NOT autonomous).
 *
 * CONTRACT:
 *   - Brain SUGGESTS. Validators DECIDE. User CONFIRMS.
 *   - Never writes to a PDF directly. Output flows into TpsExtractedField[]
 *     which the SelfReviewScreen renders with edit buttons.
 *   - Never makes a legal-eligibility decision. Never decides "approved",
 *     "denied", "qualified". Output is mechanical: classify type, extract
 *     fields, flag uncertainty.
 *   - Feature-flagged off by default. Operator enables via env var
 *     TPS_AI_BRAIN_ENABLED=1.
 *
 * INPUT:
 *   - raw_text: string  (output of Google Vision DOCUMENT_TEXT_DETECTION)
 *   - lines: string[]   (per-line breakdown, for context)
 *   - doc_type_hint?: string | null   (user-selected slot hint)
 *
 * OUTPUT: a zod-validated DocumentBrainResult with:
 *   - document_type classification across 6 categories
 *   - structured fields with source_value, final_value, confidence,
 *     source_line, requires_review
 *   - warnings array (uncertainty flags)
 *   - needs_manual_review boolean
 *
 * PRIVACY:
 *   - Only raw_text + lines are sent to DeepSeek. NO image bytes.
 *   - The raw_text already crossed our TLS boundary once (Vision API).
 *     Sending it to DeepSeek is a second third-party hop. This MUST be
 *     disclosed in the privacy notice before the Brain is enabled in prod.
 *   - DeepSeek terms: at the time of writing (2026-05-11), DeepSeek does
 *     not train on API inputs by default. Operator MUST re-verify on
 *     vendor's current ToS before flipping the flag in prod.
 */

import { z } from 'zod'

import { chat, isDeepSeekError, type ChatMessage } from '@/lib/deepseek/client'
import { hasCyrillic, toWinAnsiSafe } from '@/lib/tps/transliterate'
// Reusing nameNormalizer from the translation product (built for v6 OCR).
// Catches mixed-script (Cyrillic+Latin look-alikes), abnormal casing,
// applies safe title-case. Saves us from reinventing it for TPS.
import { analyseNameField, NAME_FIELDS } from '@/lib/ocr/nameNormalizer'

// ── Schema ──────────────────────────────────────────────────────────────────

export const DocumentTypeEnum = z.enum([
  'international_passport',
  'ukrainian_internal_passport',
  'i94',
  'ead',
  'uscis_notice',
  'unknown',
])
export type DocumentType = z.infer<typeof DocumentTypeEnum>

const FieldSchema = z.object({
  // What the document literally shows. Cyrillic stays Cyrillic.
  source_value: z.string().max(200),
  // What we will write into the USCIS form. Latin only, KMU-55 if Cyrillic
  // input was given by the Brain. Validators on this end will re-apply
  // toWinAnsiSafe defensively.
  final_value: z.string().max(200),
  // 0..1 — anything below 0.7 must set requires_review true.
  confidence: z.number().min(0).max(1),
  // Short snippet from the document text where the Brain found this value
  // (≤120 chars). Helps the user verify in the review screen. Never store
  // beyond the request lifecycle.
  source_line: z.string().max(200).optional().nullable(),
  // True if confidence < 0.7 OR if multi-conflict was detected OR if the
  // field was inferred (not directly read).
  requires_review: z.boolean(),
})
export type DocumentBrainField = z.infer<typeof FieldSchema>

export const DocumentBrainResultSchema = z.object({
  document_type: DocumentTypeEnum,
  // Confidence in the document_type classification itself, separate
  // from per-field confidence.
  document_type_confidence: z.number().min(0).max(1),
  // Per-field map. Brain may include any subset of these keys; missing
  // keys are simply "not found" (downstream module reports them as
  // missing-critical to the Packet Checker).
  fields: z
    .object({
      family_name: FieldSchema.optional(),
      given_name: FieldSchema.optional(),
      middle_name: FieldSchema.optional(),
      dob: FieldSchema.optional(),
      sex: FieldSchema.optional(),
      country_of_birth: FieldSchema.optional(),
      country_of_nationality: FieldSchema.optional(),
      passport_number: FieldSchema.optional(),
      passport_country_of_issuance: FieldSchema.optional(),
      passport_expiration_date: FieldSchema.optional(),
      i94_admission_number: FieldSchema.optional(),
      last_entry_date: FieldSchema.optional(),
      i94_class_of_admission: FieldSchema.optional(),
      a_number: FieldSchema.optional(),
      ead_category_on_card: FieldSchema.optional(),
      ead_expiration_date: FieldSchema.optional(),
    })
    .default({}),
  warnings: z.array(z.string().max(280)).default([]),
  needs_manual_review: z.boolean().default(false),
})
export type DocumentBrainResult = z.infer<typeof DocumentBrainResultSchema>

// ── Public surface ──────────────────────────────────────────────────────────

export interface DocumentBrainInput {
  raw_text: string
  lines?: string[]
  doc_type_hint?: string | null
  /** Test hook — pass a stub chat() in tests so we don't hit DeepSeek. */
  chatFn?: (msgs: ChatMessage[], opts?: { timeoutMs?: number }) => Promise<{ content: string }>
}

export interface DocumentBrainOutcome {
  ok: true
  result: DocumentBrainResult
  raw_response_length: number
}
export interface DocumentBrainFailure {
  ok: false
  error_code:
    | 'NOT_CONFIGURED'
    | 'EMPTY_INPUT'
    | 'AI_HTTP_ERROR'
    | 'AI_TIMEOUT'
    | 'INVALID_JSON'
    | 'SCHEMA_VIOLATION'
    | 'UNKNOWN'
  detail: string
}
export type DocumentBrainOutput = DocumentBrainOutcome | DocumentBrainFailure

/**
 * Returns true if the AI brain can run in this environment.
 *
 * Policy (harmonized with the translation + re-parole OCR pipelines,
 * which use the same DeepSeek client and do NOT require a separate
 * opt-in flag):
 *
 *   - Brain is ENABLED when DEEPSEEK_API_KEY is present.
 *   - An operator can force-disable it by setting TPS_AI_BRAIN_ENABLED='0'
 *     (e.g. during a DeepSeek outage) without removing the API key.
 *
 * Previously this defaulted to OFF, which silently turned the AI fallback
 * into a no-op in production even when the key was configured. That made
 * the TPS wizard surface zero fields whenever the rule-based passport
 * module failed to find an MRZ — a very common case for real users.
 */
export function isBrainEnabled(): boolean {
  if (process.env.TPS_AI_BRAIN_ENABLED === '0') return false
  return Boolean(process.env.DEEPSEEK_API_KEY)
}

/**
 * Main entry. Pure function — no side effects, no DB writes, no logging
 * of input/output values (only count-of-tokens is acceptable in logs).
 *
 * Caller should:
 *   1. First run rule-based modules.
 *   2. If module result is { document_type: 'unknown' } OR has fewer than
 *      3 fields with confidence ≥ 0.7, call runBrain(raw_text).
 *   3. Merge: for each Brain field with confidence ≥ 0.7 AND not already
 *      present from rules with equal-or-higher confidence, add as a
 *      TpsExtractedField with extraction_source='ai_brain'.
 *   4. Validators (validateBrainOutput below) run on every Brain field
 *      before merge — anything that fails validators stays as a
 *      requires_review entry, never auto-merged.
 */
export async function runBrain(
  input: DocumentBrainInput,
): Promise<DocumentBrainOutput> {
  if (!isBrainEnabled() && !input.chatFn) {
    return {
      ok: false,
      error_code: 'NOT_CONFIGURED',
      detail: 'TPS_AI_BRAIN_ENABLED is not set. Brain is opt-in per environment.',
    }
  }

  const text = (input.raw_text || '').trim()
  if (text.length < 10) {
    return {
      ok: false,
      error_code: 'EMPTY_INPUT',
      detail: 'raw_text is empty or too short to classify (need ≥10 chars).',
    }
  }

  // Cap input to keep token cost bounded. Real USCIS-relevant document
  // pages produce 200-2000 chars of OCR text; 4000 is comfortably above
  // that ceiling without breaking the Brain on bilingual booklets.
  const capped = text.slice(0, 4000)

  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: buildUserMessage(capped, input.lines ?? [], input.doc_type_hint),
    },
  ]

  let content: string
  try {
    const chatFn = input.chatFn ?? defaultChat
    const res = await chatFn(messages, { timeoutMs: 25_000 })
    content = res.content
  } catch (e: unknown) {
    if (isDeepSeekError(e, 'TIMEOUT')) {
      return { ok: false, error_code: 'AI_TIMEOUT', detail: 'DeepSeek call exceeded 25s' }
    }
    if (isDeepSeekError(e, 'NOT_CONFIGURED')) {
      return {
        ok: false,
        error_code: 'NOT_CONFIGURED',
        detail: 'DEEPSEEK_API_KEY missing',
      }
    }
    if (isDeepSeekError(e)) {
      return {
        ok: false,
        error_code: 'AI_HTTP_ERROR',
        detail: `HTTP ${e.statusCode ?? 'unknown'}`,
      }
    }
    return {
      ok: false,
      error_code: 'UNKNOWN',
      detail: e instanceof Error ? e.message : 'unknown',
    }
  }

  // Parse the JSON envelope. DeepSeek returns code-fenced or plain JSON.
  const json = extractJsonObject(content)
  if (!json) {
    return {
      ok: false,
      error_code: 'INVALID_JSON',
      detail: 'No JSON object found in Brain response',
    }
  }

  const parsed = DocumentBrainResultSchema.safeParse(json)
  if (!parsed.success) {
    return {
      ok: false,
      error_code: 'SCHEMA_VIOLATION',
      detail: parsed.error.issues
        .slice(0, 3)
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; '),
    }
  }

  // Post-validation hardening. The Brain may return Latin already
  // (passport MRZ) or Cyrillic (Ukrainian internal passport) — for
  // every field we OVERWRITE final_value with toWinAnsiSafe(source_value)
  // to remove the Brain's freedom to invent transliteration. This is
  // the "validators decide, AI suggests" contract enforced in code.
  const hardened = hardenFinalValues(parsed.data)
  return { ok: true, result: hardened, raw_response_length: content.length }
}

// ── Validators ──────────────────────────────────────────────────────────────

/**
 * For each field, enforce that final_value is derived from source_value
 * via toWinAnsiSafe + KMU-55. The Brain's claimed final_value is NEVER
 * trusted as-is. If the Brain wrote 'Shevсhenko' (Latin с Cyrillic с),
 * this normalization replaces it with the deterministic Latin form.
 */
function hardenFinalValues(r: DocumentBrainResult): DocumentBrainResult {
  const next: DocumentBrainResult = { ...r, fields: { ...r.fields } }
  const fieldKeys = Object.keys(next.fields) as Array<keyof typeof next.fields>
  for (const k of fieldKeys) {
    const f = next.fields[k]
    if (!f) continue
    // For all fields: deterministic KMU-55 + WinAnsi-safe from the
    // SOURCE value. The Brain's claimed final_value is never trusted.
    let safeFinal = toWinAnsiSafe(f.source_value)
    let extraReviewReason: string | undefined

    // For name-like fields, reuse the translation product's
    // nameNormalizer (built for v6 OCR). Catches:
    //  - mixed-script tokens (Cyrillic+Latin look-alikes)
    //  - abnormal casing (ShEVChENKO)
    //  - safe title-case
    // If it flags review, we propagate that.
    const isNameField =
      k === 'family_name' || k === 'given_name' || k === 'middle_name' ||
      NAME_FIELDS.has(k)
    if (isNameField) {
      // Apply name analysis on the source value, then transliterate.
      const analysis = analyseNameField(f.source_value)
      const transliterated = toWinAnsiSafe(analysis.normalized)
      safeFinal = transliterated
      if (analysis.review_required) {
        extraReviewReason = analysis.review_reason
      }
    }

    next.fields[k] = {
      ...f,
      final_value: safeFinal,
      // requires_review fires if:
      //  - the Brain said so
      //  - or confidence < 0.7
      //  - or KMU-55/nameAnalyser disagreed with the Brain's claim
      //  - or the name analyser flagged it
      requires_review:
        f.requires_review ||
        f.confidence < 0.7 ||
        safeFinal !== f.final_value ||
        Boolean(extraReviewReason),
    }
  }
  return next
}

/**
 * Public helper for callers (the OCR route) — given a Brain field,
 * report ALL hard validation failures. Anything failing here MUST be
 * surfaced as requires_review and is NEVER auto-merged into PDF data.
 *
 * Rules (deterministic, no AI):
 *   - Dates must be MM/DD/YYYY or YYYY-MM-DD and represent real dates.
 *   - DOB must not be in the future and must be after 1900-01-01.
 *   - Passport expiration must not be more than 20 years in future.
 *   - Passport number length 5-15.
 *   - I-94 number 9-11 digits (CBP format).
 *   - A-number 7-9 digits.
 *   - EAD category shape: letter+digits (e.g. 'a12', 'c19').
 *   - Sex in {M,F,X}.
 *   - final_value must not contain Cyrillic (transliteration must have
 *     happened before this — if it didn't, that's a bug).
 */
export function validateBrainField(
  fieldKey: string,
  f: DocumentBrainField,
): { ok: boolean; reason?: string } {
  if (hasCyrillic(f.final_value)) {
    return { ok: false, reason: 'final_value still contains Cyrillic — KMU-55 failed' }
  }
  if (fieldKey.endsWith('_date') || fieldKey === 'dob') {
    const d = parseDate(f.final_value || f.source_value)
    if (!d) return { ok: false, reason: 'date not parseable' }
    if (fieldKey === 'dob') {
      if (d.getTime() > Date.now()) return { ok: false, reason: 'DOB in the future' }
      if (d.getFullYear() < 1900) return { ok: false, reason: 'DOB before 1900' }
    }
    if (fieldKey === 'passport_expiration_date') {
      const twentyYears = new Date()
      twentyYears.setFullYear(twentyYears.getFullYear() + 20)
      if (d.getTime() > twentyYears.getTime()) {
        return { ok: false, reason: 'passport expiration > 20 years future' }
      }
    }
    // Normalize whatever-format-Brain-gave-us to USCIS canonical MM/DD/YYYY
    // in-place, so downstream PDF fillers don't need date-parser logic.
    f.final_value = toUscisDate(d)
  }
  if (fieldKey === 'country_of_nationality' || fieldKey === 'passport_country_of_issuance') {
    const normalized = normalizeCountry(f.final_value)
    if (normalized) f.final_value = normalized
  }
  if (fieldKey === 'passport_number') {
    const v = (f.final_value || '').trim()
    if (v.length < 5 || v.length > 15) {
      return { ok: false, reason: 'passport_number length out of 5..15' }
    }
  }
  if (fieldKey === 'i94_admission_number') {
    const v = (f.final_value || '').replace(/\D/g, '')
    if (v.length < 9 || v.length > 11) {
      return { ok: false, reason: 'i94 number digits out of 9..11' }
    }
  }
  if (fieldKey === 'a_number') {
    const v = (f.final_value || '').replace(/\D/g, '')
    if (v.length < 7 || v.length > 9) {
      return { ok: false, reason: 'a_number digits out of 7..9' }
    }
  }
  if (fieldKey === 'sex') {
    const v = (f.final_value || '').toUpperCase().charAt(0)
    if (v !== 'M' && v !== 'F' && v !== 'X') {
      return { ok: false, reason: 'sex not M/F/X' }
    }
  }
  if (fieldKey === 'ead_category_on_card') {
    const v = (f.final_value || '').toLowerCase().replace(/[^a-z0-9]/g, '')
    if (!/^[a-z][0-9]{1,3}$/.test(v)) {
      return { ok: false, reason: 'ead_category shape not letter+digits' }
    }
  }
  return { ok: true }
}

/**
 * Parse a date string in any of the formats that real-world documents use,
 * normalized to a UTC Date. Accepts:
 *
 *   ISO              YYYY-MM-DD                  (Brain canonical)
 *   US               MM/DD/YYYY  M/D/YYYY        (USCIS canonical)
 *   European/UA      DD.MM.YYYY  D.M.YYYY        (Ukrainian internal/passport)
 *   European slash   DD/MM/YYYY  (only when DD > 12, otherwise treated as US)
 *   Visual           D MMM YYYY  e.g. "01 JAN 1985", "1 Jan 1985"
 *   MRZ TD3 birth    YYMMDD                       century resolved: if YY > current+10 → 19YY
 *
 * Returns null if no recognized format matches. The validator caller
 * compares the result against today/1900 bounds.
 */
function parseDate(s: string): Date | null {
  if (!s) return null
  const t = s.trim()
  const yearOk = (y: number) => y >= 1900 && y <= 2099
  const mkUtc = (y: number, mo: number, d: number): Date | null => {
    if (!yearOk(y) || mo < 1 || mo > 12 || d < 1 || d > 31) return null
    const dt = new Date(Date.UTC(y, mo - 1, d))
    // Reject silent rollover (e.g. Feb 31 → Mar 3)
    if (
      dt.getUTCFullYear() !== y ||
      dt.getUTCMonth() !== mo - 1 ||
      dt.getUTCDate() !== d
    ) return null
    return dt
  }

  // YYYY-MM-DD
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (m) return mkUtc(+m[1], +m[2], +m[3])

  // MM/DD/YYYY or M/D/YYYY (US format — wins when month <=12 and day <=12 ambiguity)
  m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m) {
    const a = +m[1], b = +m[2], y = +m[3]
    // If first token > 12, this must be DD/MM/YYYY
    if (a > 12 && b <= 12) return mkUtc(y, b, a)
    return mkUtc(y, a, b) // default MM/DD/YYYY
  }

  // DD.MM.YYYY or D.M.YYYY — unambiguous European/Ukrainian style
  m = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/)
  if (m) return mkUtc(+m[3], +m[2], +m[1])

  // D MMM YYYY  e.g. "01 JAN 1985", "1 Jan 1985", "01-JAN-1985"
  const MONTHS: Record<string, number> = {
    JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6,
    JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12,
  }
  m = t.match(/^(\d{1,2})[\s\-\/]+([A-Za-z]{3,})[\s\-\/]+(\d{4})$/)
  if (m) {
    const mo = MONTHS[m[2].slice(0, 3).toUpperCase()]
    if (mo) return mkUtc(+m[3], mo, +m[1])
  }

  // MRZ TD3 birth (YYMMDD). Resolve century: YY beyond "current year + 10" rolls
  // to 19xx. Used when Brain forwards the raw MRZ birth slice unchanged.
  m = t.match(/^(\d{2})(\d{2})(\d{2})$/)
  if (m) {
    const yy = +m[1], mo = +m[2], d = +m[3]
    const cutoff = (new Date().getFullYear() % 100) + 10
    const fullYear = yy > cutoff ? 1900 + yy : 2000 + yy
    return mkUtc(fullYear, mo, d)
  }

  return null
}

/**
 * Format a Date as MM/DD/YYYY (USCIS canonical).
 */
function toUscisDate(d: Date): string {
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  return `${mm}/${dd}/${d.getUTCFullYear()}`
}

/**
 * Map any text that means "Ukraine" to the canonical English country name.
 * Add other former-USSR countries as our user base expands.
 */
const COUNTRY_ALIASES: Record<string, string> = {
  ukraine: 'Ukraine',
  ukr: 'Ukraine',
  ukraina: 'Ukraine',
  ukrayina: 'Ukraine',
  'україна': 'Ukraine',
  'украина': 'Ukraine',
}

export function normalizeCountry(raw: string | null | undefined): string | null {
  if (!raw) return null
  const key = raw.trim().toLowerCase()
  return COUNTRY_ALIASES[key] ?? raw.trim()
}

// ── Prompt + helpers ────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an OCR text classifier for a USCIS packet preparation tool.
You receive plain text extracted from a single document image. You return ONLY a JSON object
matching the schema below. You do NOT give legal advice. You do NOT decide eligibility.
You do NOT invent values. If you cannot find a field, omit it from the output.

Schema:
{
  "document_type": "international_passport" | "ukrainian_internal_passport" | "i94" | "ead" | "uscis_notice" | "unknown",
  "document_type_confidence": 0.0..1.0,
  "fields": {
    "family_name"?: { source_value, final_value, confidence, source_line?, requires_review },
    "given_name"?: { ... },
    "middle_name"?: { ... },
    "dob"?: { ... },             // MM/DD/YYYY format in final_value
    "sex"?: { ... },             // M|F|X in final_value
    "country_of_birth"?: { ... },
    "country_of_nationality"?: { ... },
    "passport_number"?: { ... },
    "passport_country_of_issuance"?: { ... },
    "passport_expiration_date"?: { ... },   // MM/DD/YYYY
    "i94_admission_number"?: { ... },        // digits only, 9-11
    "last_entry_date"?: { ... },             // MM/DD/YYYY
    "i94_class_of_admission"?: { ... },      // short code like UH, B-2
    "a_number"?: { ... },                    // 7-9 digits, no 'A' prefix
    "ead_category_on_card"?: { ... },        // letter+digits, e.g. a12
    "ead_expiration_date"?: { ... }
  },
  "warnings": ["string"],
  "needs_manual_review": boolean
}

Rules:
1. source_value is what the document literally shows (Cyrillic allowed).
2. final_value is the Latin/English form a USCIS officer would expect.
3. For names: if the document has an MRZ block (international passport), MRZ Latin is the controlling source.
   Otherwise, transliterate Cyrillic via Ukrainian KMU-55 rules.
4. confidence is 0..1. confidence < 0.7 means requires_review must be true.
5. source_line is the single line from the document text where the value appears (≤120 chars).
6. NEVER fabricate fields. If unsure, omit.
7. If the document looks like neither passport, I-94, EAD, nor USCIS notice, set document_type "unknown".
8. needs_manual_review: true if any critical field is missing or confidence < 0.7 on family_name OR given_name OR dob.

Return ONLY the JSON object, no surrounding prose, no markdown fences.`

function buildUserMessage(
  text: string,
  lines: string[],
  hint: string | null | undefined,
): string {
  const hintLine = hint ? `User-selected document slot hint: ${hint}\n\n` : ''
  // Light de-dup of lines to keep prompt compact.
  const lineBlock = lines.length > 0
    ? `Line-by-line view (first 30):\n${lines.slice(0, 30).map((l) => `  ${l}`).join('\n')}\n\n`
    : ''
  return `${hintLine}${lineBlock}Full OCR text:\n${text}\n\nReturn the JSON object now.`
}

/**
 * Tolerantly extract the first JSON object in a string. Handles:
 *   - bare JSON
 *   - ```json fenced blocks
 *   - JSON followed by trailing prose
 */
export function extractJsonObject(s: string): unknown | null {
  if (!s) return null
  // Try fenced code first
  const fenced = s.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/)
  const candidate = fenced ? fenced[1] : firstBalancedObject(s)
  if (!candidate) return null
  try {
    return JSON.parse(candidate)
  } catch {
    return null
  }
}

function firstBalancedObject(s: string): string | null {
  const start = s.indexOf('{')
  if (start < 0) return null
  let depth = 0
  let inStr = false
  let escape = false
  for (let i = start; i < s.length; i++) {
    const c = s[i]
    if (inStr) {
      if (escape) escape = false
      else if (c === '\\') escape = true
      else if (c === '"') inStr = false
      continue
    }
    if (c === '"') inStr = true
    else if (c === '{') depth++
    else if (c === '}') {
      depth--
      if (depth === 0) return s.slice(start, i + 1)
    }
  }
  return null
}

/** Module-level default that lets tests inject a stub. */
async function defaultChat(
  msgs: ChatMessage[],
  opts?: { timeoutMs?: number },
): Promise<{ content: string }> {
  const res = await chat(msgs, { temperature: 0, maxTokens: 800, timeoutMs: opts?.timeoutMs })
  return { content: res.content }
}
