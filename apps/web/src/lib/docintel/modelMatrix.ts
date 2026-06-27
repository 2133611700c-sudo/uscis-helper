/**
 * modelMatrix — the SINGLE CODE source of truth for which model does what.
 *
 * ADR-026 (2026-06-24): ROUTE BY FIELD RENDERING — handwritten field → key-free `raxtemur/trocr-base-ru`
 * HTR on a NATIVE-res crop (cannot abstain → gate + human review); printed field → an LLM. The HTR READER
 * is now WIRED as `providers/htrSidecarProvider.ts` (field-first crop loop → HTR sidecar `ocr_api.py`),
 * gated by `HTR_SIDECAR_URL` (UNSET in prod → disabled, byte-identical). REMAINING to make it the PRIMARY
 * handwriting path: (1) automatic field-region LOCALIZER (boxes) — e.g. Gemini bbox like dateRegionRead;
 * (2) wire the sidecar reads into documentFieldReader for HANDWRITTEN_DOC_FAMILIES; (3) a prod sidecar host.
 * This LLM matrix still ships as the printed-field reader until those land. Legacy preview primaries were
 * removed from the contract. See docs/adr/ADR-026 + docs/research/HTR_LOCAL_API_AND_BATTERY.md.
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
 * PRIMARY CHANGE (2026-06-24, owner): the unstable preview primary was REMOVED
 * (sporadic 503/429 + run-to-run instability — HTR_STABLE_BENCHMARK). The stable GA `gemini-2.5-pro`
 * is now PRIMARY — reliably available + accurate + stable on PRINTED docs. It FABRICATES on handwriting,
 * so it stays DISQUALIFIED for the certificate family → handwritten certs are force-reviewed (no LLM
 * acceptance; the handwriting reader is `raxtemur`, ADR-026, not yet wired).
 *
 * Nobody reports a fallback read as acceptance. The removed preview must never reappear. These are
 * invariants, enforced here + by tests + by a CI guard.
 */

/** The ONE document reader (D1). The only model a quality/acceptance number may use.
 * CHANGED 2026-06-24 (owner): removed the unstable preview primary (sporadic 503/429
 * AND run-to-run instability — HTR_STABLE_BENCHMARK). Promoted the stable GA `gemini-2.5-pro` (reads
 * PRINTED docs correctly + stably across 5 runs). Handwriting does NOT rely on this LLM: certs are
 * force-reviewed and DISQUALIFIED below (2.5-pro fabricates cursive) → handwriting reader = raxtemur
 * (ADR-026, not yet wired) + human review. The deprecated preview is in DEPRECATED_MODELS. */
export const PRIMARY_READER = 'gemini-2.5-pro' as const

/**
 * Availability fallbacks, in PREFERENCE order (best-available first). NEVER primary. A
 * non-Latin read here is force-reviewed. flash models for last-resort availability only.
 */
export const FALLBACK_MODELS = ['gemini-3.5-flash', 'gemini-2.5-flash'] as const

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

/** Models that must never appear anywhere (deprecated / 404 / removed for instability). */
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
  'gemini-2.5-pro': {
    id: 'gemini-2.5-pro', tier: 'ga', role: 'primary',
    availability: 'RELIABLE — GA, no 503/429 in the bench, STABLE across 5 runs. NOTE: thinking eats the output budget → set maxOutputTokens high (≥16384) or it returns EMPTY (MAX_TOKENS).',
    readsWell: 'PRINTED docs (passport, military ID): correct person, stable (95–100%), accurate names/dates. The acceptance LLM for printed fields.',
    failsOn: 'HANDWRITTEN certificates — FABRICATES a different, fake person (confident + stable) → DISQUALIFIED for the certificate family; handwriting goes to raxtemur + human review, NOT this model.',
    function: 'D1 PRIMARY READER (promoted 2026-06-24) — acceptance reader for PRINTED fields. Disqualified on handwriting certs.',
    tested: '2026-06-24',
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

/**
 * Acceptance-read contract (owner, 2026-06-27 — single Gemini truth): a result is acceptance-valid
 * ONLY when the requested AND actual model are the primary reader and NO fallback fired. A flash/other
 * read is forensic evidence, never an acceptance result. Used by the acceptance harness as a hard gate.
 */
export function assertAcceptanceRead(p: { requested: string | null; actual: string | null; fallbackUsed: boolean }):
  | { ok: true }
  | { ok: false; reason: string } {
  if (p.requested !== PRIMARY_READER) return { ok: false, reason: `requested_model_not_primary:${p.requested ?? 'null'}` }
  if (p.actual !== PRIMARY_READER) return { ok: false, reason: `actual_model_not_primary:${p.actual ?? 'null'}` }
  if (p.fallbackUsed) return { ok: false, reason: 'fallback_used' }
  return { ok: true }
}

/** Is `model` disqualified for a given doc type id? (substring match on the family). */
export function isDisqualifiedFor(model: string | null | undefined, docTypeId: string | null | undefined): boolean {
  if (!model || !docTypeId) return false
  const families = DISQUALIFIED[model]
  if (!families) return false
  const t = docTypeId.toLowerCase()
  return families.some((fam) => t.includes(fam))
}
