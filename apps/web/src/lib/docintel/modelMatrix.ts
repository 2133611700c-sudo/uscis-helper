/**
 * modelMatrix — the SINGLE CODE source of truth for which model does what.
 *
 * ADR-018 ("Iron Model Matrix") used to live only in markdown, so an agent (or a
 * script) could act against it — e.g. measure acceptance on a fallback model. This
 * module encodes the matrix in TYPED code + provides hard assertions so that the
 * wrong thing FAILS CLOSED instead of relying on anyone reading the ADR.
 *
 * THE LAW (ADR-018, updated 2026-06-23 after a full live model bench on the real docs):
 *   - PRIMARY_READER is the ONLY model whose read is a valid product/acceptance result.
 *   - FALLBACK models exist for AVAILABILITY only; a fallback read of a non-Latin doc
 *     is force-reviewed and is NEVER a quality/acceptance number.
 *   - Some fallback models are DISQUALIFIED for whole doc classes because they read a
 *     DIFFERENT, fabricated person on handwriting (2.5-flash 2026-06-02/09; 2.5-pro 2026-06-23).
 *   - DEPRECATED models must never appear in any chain.
 *   - NO model — not even the primary — is PROVEN to read HANDWRITTEN certificates without
 *     error. Handwritten birth/marriage/divorce/death/name-change docs are ALWAYS human-reviewed,
 *     regardless of model. (See MODEL_PROFILES + HANDWRITTEN_DOC_FAMILIES below.)
 *
 * AVAILABILITY REALITY (2026-06-23): the primary `gemini-3.1-pro-preview` is a PREVIEW endpoint
 * with NO capacity guarantee → it sporadically returns 503 UNAVAILABLE / 429 RESOURCE_EXHAUSTED.
 * The provider retries it with exponential backoff (geminiVisionProvider) before falling back.
 * The GA `gemini-2.5-pro` is reliably AVAILABLE and accurate on PRINTED docs, so it is the
 * preferred availability fallback — but it FABRICATES a different person on handwriting, hence
 * it is DISQUALIFIED for the certificate family.
 *
 * Nobody promotes a flash/2.5-pro model to primary. Nobody reports a fallback read as
 * acceptance. These are invariants, enforced here + by tests + by a CI guard.
 */

/** The ONE document reader (D1). The only model a quality/acceptance number may use. */
export const PRIMARY_READER = 'gemini-3.1-pro-preview' as const

/**
 * Availability fallbacks, in PREFERENCE order (best-available first). NEVER primary. A
 * non-Latin read here is force-reviewed. 2.5-pro is GA + accurate on PRINTED docs, so it
 * outranks flash; flash models follow for last-resort availability.
 */
export const FALLBACK_MODELS = ['gemini-2.5-pro', 'gemini-3.5-flash', 'gemini-2.5-flash'] as const

/**
 * Models disqualified for specific doc-class families (returned a DIFFERENT, fabricated person
 * on the HANDWRITTEN documents of that family). Verified by live bench:
 *   - gemini-2.5-flash: 2026-06-02/09 + 2026-06-23 (two different fake people across temps).
 *   - gemini-2.5-pro:   2026-06-23 (a confident, STABLE fabricated person — wrong surname/given/
 *     patronymic/oblast). Accurate on printed docs, unsafe on handwriting.
 */
export const DISQUALIFIED: Readonly<Record<string, readonly string[]>> = Object.freeze({
  'gemini-2.5-flash': ['certificate', 'birth', 'marriage', 'divorce', 'death', 'name_change'],
  'gemini-2.5-pro': ['certificate', 'birth', 'marriage', 'divorce', 'death', 'name_change'],
})

/** Doc-type-id family substrings that are typically HANDWRITTEN ⇒ ALWAYS human-reviewed (any model). */
export const HANDWRITTEN_DOC_FAMILIES = ['birth', 'marriage', 'divorce', 'death', 'name_change', 'certificate'] as const

/** Models that must never appear anywhere (deprecated / 404 on generation). */
export const DEPRECATED_MODELS = ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-3-pro-preview'] as const

/** The full sanctioned provider chain (primary first). Anything else is a violation. */
export const SANCTIONED_CHAIN = [PRIMARY_READER, ...FALLBACK_MODELS] as const

/**
 * THE MODEL INVENTORY — what each model IS, what it reads, what it must NOT do (live-tested).
 * This is the human-readable truth that the doc rules (ADR-018, CONSTITUTION, ORG_CHART) mirror.
 * `tested` = the date the claim was last verified against the real documents.
 */
export interface ModelProfile {
  id: string
  tier: 'preview' | 'ga'
  role: 'primary' | 'fallback' | 'deprecated'
  /** Live-tested availability (the owner's #1 concern). */
  availability: string
  /** What it reads ACCURATELY (same person, stable). */
  readsWell: string
  /** Where it FAILS / is forbidden. */
  failsOn: string
  /** Its job in the pipeline. */
  function: string
  tested: string
}

export const MODEL_PROFILES: Readonly<Record<string, ModelProfile>> = Object.freeze({
  'gemini-3.1-pro-preview': {
    id: 'gemini-3.1-pro-preview', tier: 'preview', role: 'primary',
    availability: 'UNRELIABLE — preview, no capacity guarantee; sporadic 503 UNAVAILABLE + 429 RESOURCE_EXHAUSTED. Retried with exponential backoff before fallback.',
    readsWell: 'Historically the best reader of the owner\'s Cyrillic incl. handwriting (vision-arbiter proof); the ONLY acceptance-valid model.',
    failsOn: 'Availability (503/429). Even it is NOT proven error-free on handwriting → handwriting still human-reviewed.',
    function: 'D1 PRIMARY READER — the only model whose read is a product/acceptance result.',
    tested: '2026-06-23',
  },
  'gemini-2.5-pro': {
    id: 'gemini-2.5-pro', tier: 'ga', role: 'fallback',
    availability: 'RELIABLE — GA, no 503/429 in the bench. NOTE: thinking eats the output budget → set maxOutputTokens high (≥16384) or it returns EMPTY (MAX_TOKENS).',
    readsWell: 'PRINTED docs (passport, military ID): correct person, stable (95–100% temp-stability), accurate names/dates.',
    failsOn: 'HANDWRITTEN certificates — FABRICATES a different, fake person (confident + stable). DISQUALIFIED for the certificate family. Never an acceptance number (fallback).',
    function: 'Preferred AVAILABILITY fallback for PRINTED docs (force-reviewed). NOT for handwriting.',
    tested: '2026-06-23',
  },
  'gemini-3.5-flash': {
    id: 'gemini-3.5-flash', tier: 'ga', role: 'fallback',
    availability: 'INTERMITTENT — frequent 503 in the current window (~1/4 reads landed).',
    readsWell: 'When it lands: printed identity blocks, correct person.',
    failsOn: 'Availability (503). Fallback only; non-Latin reads force-reviewed; never acceptance.',
    function: 'Availability fallback #2; also the date-box detector (GEMINI_DATEBOX_MODEL).',
    tested: '2026-06-23',
  },
  'gemini-2.5-flash': {
    id: 'gemini-2.5-flash', tier: 'ga', role: 'fallback',
    availability: 'AVAILABLE.',
    readsWell: 'PRINTED identity blocks (passport, military): correct person on the scored fields.',
    failsOn: 'HANDWRITTEN certificates — fabricates TWO different fake people across temps. DISQUALIFIED for the certificate family. Hallucinates peripheral fields even on printed docs.',
    function: 'Last-resort availability fallback for PRINTED docs only; force-reviewed; never acceptance.',
    tested: '2026-06-23',
  },
  'gemini-2.5-flash-lite': {
    id: 'gemini-2.5-flash-lite', tier: 'ga', role: 'deprecated',
    availability: 'AVAILABLE on printed; 503 on the handwritten cert.',
    readsWell: 'Clean PRINTED identity blocks only (passport/military), correct person.',
    failsOn: 'Handwriting (503). Fabricates secondary fields. Weakest tier — NOT in the sanctioned chain.',
    function: 'Not used in production chain (documented for completeness).',
    tested: '2026-06-23',
  },
})

/** Is `model` the primary reader? (Acceptance/quality numbers require true.) */
export function isPrimaryReader(model: string | null | undefined): boolean {
  return model === PRIMARY_READER
}

/** Is `model` allowed to read AT ALL in the sanctioned chain? */
export function isSanctionedModel(model: string | null | undefined): boolean {
  return !!model && (SANCTIONED_CHAIN as readonly string[]).includes(model)
}

/** Is this doc-type-id in a family that is typically HANDWRITTEN ⇒ mandatory human review (any model). */
export function isHandwrittenFamily(docTypeId: string | null | undefined): boolean {
  if (!docTypeId) return false
  const t = docTypeId.toLowerCase()
  return HANDWRITTEN_DOC_FAMILIES.some((fam) => t.includes(fam))
}

/**
 * Acceptance gate: a read is a VALID quality/acceptance result ONLY if it came from
 * the primary reader. A fallback (or any other) model is availability, never quality.
 * Returns a typed reason so a runner can record it instead of silently scoring.
 */
export type AcceptanceModelVerdict =
  | { valid: true }
  | { valid: false; reason: 'fallback_model_not_acceptance_valid' | 'unsanctioned_model' | 'no_model' }

export function acceptanceModelVerdict(model: string | null | undefined): AcceptanceModelVerdict {
  if (!model) return { valid: false, reason: 'no_model' }
  if (model === PRIMARY_READER) return { valid: true }
  if ((FALLBACK_MODELS as readonly string[]).includes(model)) return { valid: false, reason: 'fallback_model_not_acceptance_valid' }
  return { valid: false, reason: 'unsanctioned_model' }
}

/** HARD assert: throw if a model is being used as primary that isn't the primary reader. */
export function assertPrimaryReader(model: string | null | undefined): asserts model is typeof PRIMARY_READER {
  if (model !== PRIMARY_READER) {
    throw new Error(`model_matrix_violation: primary reader must be ${PRIMARY_READER}, got ${model ?? 'null'} (ADR-018)`)
  }
}

/** Is `model` disqualified for a given doc type id? (substring match on the family). */
export function isDisqualifiedFor(model: string | null | undefined, docTypeId: string | null | undefined): boolean {
  if (!model || !docTypeId) return false
  const families = DISQUALIFIED[model]
  if (!families) return false
  const t = docTypeId.toLowerCase()
  return families.some((fam) => t.includes(fam))
}
