/**
 * reviewExplainer — BLUEPRINT #5: explain WHY a field is in review, in reviewer language.
 *
 * Today a reviewer sees raw reason codes ('critical_no_mrz_anchor', 'zoom_mismatch') and has
 * to know the pipeline to act on them. This module translates codes → plain instructions.
 *
 * ARCHITECTURE (cost-efficiency law: deterministic first, LLM last):
 *  - explainReviewReasons() — PURE deterministic glossary. Free, offline, always available.
 *    This is the base layer every surface can use today.
 *  - deepseekComposeReviewSummary() — OPTIONAL one-paragraph composition over the SAME
 *    keys+codes input, behind strict DEEPSEEK_REVIEW_EXPLAINER='1' (key ≠ permission, L3).
 *    DeepSeek output is PROSE ONLY (L3): it can never author, alter or unlock a value —
 *    callers may only display it next to the deterministic list. Fail-open: null.
 *
 * PII-FREE BY CONSTRUCTION: input is field KEYS + reason CODES only, never values.
 */

export interface ReviewedFieldReasons {
  field: string
  reasons: string[]
}

/** Deterministic reviewer-facing glossary for the pipeline's review reason codes. */
const REASON_GLOSSARY: Record<string, string> = {
  fallback_model_used: 'Read by a backup model (primary was unavailable) — verify against the document image.',
  handwritten_llm_crop_read: 'Handwritten fragment read by an LLM crop pass — handwriting is never auto-accepted; compare with the image.',
  handwritten_field: 'Handwritten field — always requires human confirmation.',
  critical_no_mrz_anchor: 'No machine-readable zone on this document to cross-check against — confirm the value visually.',
  source_script_ambiguous: 'The source script (Ukrainian vs Russian) could not be confirmed — check which language the document uses; it changes the Latin spelling.',
  orientation_uncertain: 'Page orientation could not be confirmed — make sure the read was not taken from a rotated image.',
  canonical_value_unresolved: 'The raw text was read but could not be converted to the expected format — enter the normalized value manually.',
  not_read_manual_entry: 'The reader could not find this field on the document — enter it manually.',
  zoom_mismatch: 'A verification re-read of this exact region returned a DIFFERENT text — one of the two reads is wrong; check the image closely.',
  low_confidence: 'The reader was not confident about this value — verify it against the image.',
  provider_conflict: 'Two readers disagreed on this value — resolve from the document image.',
  mrz_check_failed: 'The machine-readable zone checksum does not match this value — one of them is misread.',
  'critic:dob_not_before_issue': 'Logical conflict: the birth date is not before the issue date — at least one of the two dates is misread.',
  'critic:issue_not_before_expiry': 'Logical conflict: the issue date is not before the expiry date — at least one is misread.',
  'critic:dob_in_future': 'The birth date is in the future — it is misread.',
  'critic:age_over_120': 'The birth date implies an age over 120 — it is almost certainly misread.',
  'critic:sex_patronymic_conflict': 'The sex field contradicts the patronymic ending — one of the two is misread.',
  'critic:place_unverified': 'This place name is not in the settlement registry — verify the spelling (it may still be correct; registries are incomplete).',
}

const GENERIC =
  'Flagged for review — confirm the value against the document image before releasing.'

/** Pure, deterministic, free. Unknown codes get the generic instruction (fail-open). */
export function explainReviewReasons(fields: ReviewedFieldReasons[]): Array<{
  field: string
  explanations: string[]
}> {
  return fields
    .filter((f) => f.field && Array.isArray(f.reasons) && f.reasons.length > 0)
    .map((f) => ({
      field: f.field,
      explanations: [...new Set(f.reasons.map((r) => REASON_GLOSSARY[r] ?? GENERIC))],
    }))
}

export function isDeepseekReviewExplainerEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.DEEPSEEK_REVIEW_EXPLAINER === '1'
}

/**
 * Optional LLM composition over keys+codes ONLY (never values — the message content is
 * PII-free by construction). Strict flag; key presence is NOT permission (L3). PROSE ONLY:
 * the returned string may only be DISPLAYED; it can never change a value or a gate.
 * Fail-open: any error → null (the deterministic glossary remains the truth).
 */
export async function deepseekComposeReviewSummary(
  fields: ReviewedFieldReasons[],
  fetchImpl: typeof fetch = fetch,
  env: Record<string, string | undefined> = process.env,
): Promise<string | null> {
  if (!isDeepseekReviewExplainerEnabled(env)) return null
  const key = (env.DEEPSEEK_API_KEY ?? '').trim()
  if (!key) return null
  const payload = fields
    .filter((f) => f.field && f.reasons.length > 0)
    .map((f) => ({ field: f.field, reasons: f.reasons }))
  if (payload.length === 0) return null
  try {
    const res = await fetchImpl('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: env.DEEPSEEK_EXPLAINER_MODEL || 'deepseek-chat',
        temperature: 0,
        max_tokens: 400,
        messages: [
          {
            role: 'system',
            content:
              'You write a short review checklist for a human document reviewer. Input is a ' +
              'JSON list of field KEYS and machine reason CODES (no document content). Write ' +
              '2-5 plain sentences telling the reviewer what to check first and why. Never ' +
              'invent field values; never say a value is correct.',
          },
          { role: 'user', content: JSON.stringify(payload) },
        ],
      }),
    })
    if (!res.ok) return null
    const j = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
    return j.choices?.[0]?.message?.content?.trim() || null
  } catch {
    return null
  }
}
