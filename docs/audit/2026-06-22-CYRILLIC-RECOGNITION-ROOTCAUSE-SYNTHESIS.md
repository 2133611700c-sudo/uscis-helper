# Cyrillic Recognition → Ready-Result: Root-Cause Synthesis (2026-06-22)

Synthesis of 4 parallel read-only forensic audits (dictionary, brain↔dictionary, Gemini OCR read, end-to-end auto-delivery). Every claim below is traceable to file:line in the source audits. Base: HEAD `1482998` / branch `translation/ru-and-model-matrix-fixes`.

## TL;DR — the reframe (challenge to the working assumption)

"Recognition of handwritten Cyrillic is weak" is **only partly true**, and the part that is true is NOT the main reason users don't get a ready result. The evidence splits the problem into four distinct surfaces, and three of them are **policy/architecture/measurement**, not model accuracy:

1. **OCR read** — handwritten *names* actually read well (project probe: 11/12). The acute read failure is **handwritten DATES** (0/3) + the model **copies one date into two fields** (DOB == date-of-issue). Plus: the default read path sends the **raw image with ZERO preprocessing** and **never tells the model which fields are handwritten**.
2. **Self-inflicted "review everything" policy** — a correctly normalized field still ships `review_required` because the dictionary's "accept" signal has **no authority to lower review**, and the one mechanism built to auto-deliver stable fields (`consensus_reliable`) is **severed in the adapter and never reaches the gate**.
3. **Dictionary data gap** — the gazetteer holds **~520 of ~28-30k settlements (zero village tier)**; village place-of-birth (the most common birth-cert field) always falls through.
4. **No measurement** — there is **no real-document accuracy benchmark with ground truth in repo/CI**; the "0 fabricated" number counts EMPTY-as-pass. **We cannot currently measure whether an auto-filled name/DOB is correct on a real document.** This is the meta-blocker: you cannot safely flip auto-delivery on what you cannot measure.

---

## A. OCR READ (Gemini vision) — what's actually happening

VERIFIED (geminiVisionProvider.ts, vision-extract/route.ts, image-preprocess.ts, documentFieldReader.ts):

- **Per-page PARALLEL fan-out**: each page = a separate concurrent `generateContent`. A 6-page upload = 6 simultaneous `gemini-3.1-pro-preview` calls → preview-model RPM pressure → 429 → fallback to flash → **every field force-reviewed** (`fallback_model_used`). This is the likely engine of "everything needs manual review." [INFERRED, well-grounded]
- **temperature = 0** already (good — the Моринці fabrication was model choice + weak grounding, not temperature).
- **Output is prose-described JSON, NOT schema-constrained** (`response_mime_type:'application/json'` but no `responseSchema`) → `JSON.parse` can throw and waste the attempt.
- **The default (Core) path does ZERO image preprocessing** — no upscale, no deskew, no content-orientation. All preprocessing (down-resize, EXIF rotate, `autoOrient`) is either OFF by flag (`AUTO_ORIENT_ENABLED` unset) or only on the rarely-reached legacy fallback path. The owner's rotated/upside-down scans are handled **only by a prose instruction**.
- **The `handwritten:true` registry flag never reaches the prompt.** `buildPrompt` reads only field/kind/label. The model is never told a field is cursive, gets no date-distinctness rule, no confusable-glyph table, no few-shot. The prompt is `v1`, never iterated despite repeated probes naming the date fix.
- **Single-pass in production.** Self-consistency voting, auto-delivery consensus, and date-region zoom re-read all EXIST and are all **OFF by default**.

## B. BRAIN ↔ DICTIONARY — why a correct read still becomes "review"

VERIFIED (knowledgeNormalize.ts, arbitration.ts, documentFieldReader.ts, ocrFieldSafetyGate.ts, translationAdapter.ts):

- **The dictionary can only RAISE review, never lower it.** D2 `applyKnowledge` accept-path does `{...f, normalizedValue}` and preserves `f.reviewRequired=true` (arbitration.ts:210-213). So a gazetteer-EXACT city, a known authority, a valid ISO date that the dictionary *confirms* still ships `review_required` if an upstream gate already fired. The dictionary's "I'm confident this is right" has **zero downward authority**.
- **The upstream gates that fire first**: handwritten-blanket review (every handwritten field → review), confidence < 0.95, `critical_no_mrz_anchor` (every critical field on a doc with no MRZ — i.e. all certs), `source_script_ambiguous`, `fallback_model_used`.
- **`consensus_reliable` is dead-wired (GAP-1).** It's produced on `ExtractedDocField`, but `docintelToCandidate` doesn't copy it, `FieldCandidate`/`FieldOut` don't carry it, and the Core call site never passes it to C3. The one mechanism explicitly built to let a verifiably-stable critical field auto-deliver **cannot reach the gate at all**.
- **C3 safety never runs on the live Core path (GAP-2)** — only on the legacy fallback return. The "unconditional" critical-null guard is conditional on taking the failure path.
- **`strong_source_anchor` defaults false for everything except MRZ** → every critical field on every non-MRZ doc is structurally "unanchored" → C3 (when it runs) parks it. Dictionary-exact and consensus-stable do NOT count as anchors today.

## C. DICTIONARY INVENTORY — coverage + gaps

VERIFIED (dictionary.ts, gazetteer.ts, registry/*, patronymic.ts):

- Strong: KMU-55 + Russian (BGN/PCGN) transliteration, months (full), civil status (18, gendered), patronymic engines (uk+ru, self-tested), oblast genitive→nominative (24), country dict (just added, wired), authorities (22+9).
- **#1 gap — gazetteer**: ~520 of ~28-30k settlements, **city/UTS tier only, ZERO villages**. Most birth-cert place-of-birth is a village → `unknown_geography` → falls through to bare transliteration with no cross-check. The header already mandates loading the full КАТОТТГ tier ("matcher doesn't change, only data").
- **Conflict — ЗАГС/РАЦС mapped THREE ways** across dictionary.ts + civil_registry_terms.json (a surviving parallel dictionary; CLAUDE.md forbids it).
- **Missing**: raion (district) list, given-name/surname validation lists, document-number/series format validators, death-cert + name-change-cert field labels (those docs have only a doc-type entry).

## D. END-TO-END AUTO-DELIVERY — the honest UX truth

VERIFIED (reviewGate.ts, TranslateWizard.tsx, generate-pdf/route.ts, form mappers, isMinimallyComplete):

- **TPS / EAD / Re-Parole already auto-deliver** (no operator). The form mappers auto-fill from canonical values; a null critical field → HTTP 422 with the missing list (correct legal gate). EAD is free + instant.
- **Translation live path is the legacy self-serve path** (operator-V2 is built but FROZEN/unmerged): paid + self-signed → instant PDF inline + email. **Operator is NOT structurally mandatory in prod.**
- For a **clean printed booklet**: 2 fields full-auto + **4 one-click soft-confirm** (`critical_no_mrz_anchor`, pre-filled, NO re-typing — "glance + one OK") → then the legally-required signature → download. This is close to ready, NOT a 6-field re-entry wall.
- For **handwritten / Soviet-bilingual / unknown** docs: force-reviewed, soft-confirm does NOT apply, the user hits genuine manual entry — and the product itself marks these "not production-ready."
- **The irreducible legal line**: the certified-translation *signature* (8 CFR §103.2(b)(3)) and non-null name/DOB/country on a federal form. These must stay human-confirmed. Everything *up to* the signature can be automated.

---

## THE PLAN — ranked by impact/cost (rules to create)

### Tier 0 — MEASURE FIRST (gates everything; needs Gemini quota)
- **R0. Real-doc accuracy harness.** Wire `test-fixtures/real-docs/` + `qa-private/ground-truth/` (8 owner-verified GT) into a per-field eval that reports correct / wrong / EMPTY separately (never empty-as-pass), per doc-class, per field-kind. This is the baseline that makes every change below measurable and makes auto-delivery decisions defensible.

### Tier 1 — CHEAP, HIGH-IMPACT (prompt + schema; hours, offline-testable for structure)
- **R1. Thread `handwritten:true` into `buildPrompt`** + per-field cursive instruction + **date-distinctness rule** ("each date field is a distinct location; never reuse one date for two fields") + handwritten digit/month confusable note. Bump `GEMINI_PROMPT_VERSION`. → targets the verified date failure + DOB/issue copy bug.
- **R2. Schema-constrain the output** (`responseSchema` matching `{cyrillic, iso_date, can_read, confidence, reason}`). → kills JSON.parse failures, tightens field discipline.

### Tier 2 — IMAGE PREPROCESSING ON THE LIVE PATH (1-2 days)
- **R3.** Move preprocessing to the Core path: content auto-orient (enable/inline `autoOrient`), deskew, and **upscale** small/low-DPI scans (drop `withoutEnlargement`, ~1500px min short side, light sharpen). → fixes rotated + small handwritten scans at the pixel level.

### Tier 3 — CONSENSUS + BIDIRECTIONAL DICTIONARY (the actual auto-delivery fix; touches the legal line — owner-gated)
- **R4.** Wire `consensus_reliable` end-to-end (FieldCandidate → CanonicalField → FieldOut → C3). Fix GAP-1.
- **R5.** Enable self-consistency **voting** (K=3 primary, majority-pick the value) on handwritten-risk classes — improves accuracy AND lets agreeing fields auto-deliver.
- **R6.** Make the dictionary **bidirectional**: a high-evidence D2 accept (gazetteer_exact / known authority / valid ISO date / valid KMU-55 on a whitelisted UA-ID doc) may CLEAR soft review reasons (handwritten-blanket, confidence, no_mrz_anchor) — but NEVER hard ones (fallback, conflict, ambiguous, unread). Add a `clearableSoftReasons` set; stop the strictly-monotonic-up merge.
- **R7.** Replace `strong_source_anchor=false`-default with a real anchor model: anchored = MRZ-valid OR consensus-stable OR dictionary-EXACT OR a date that passed role+sequence guards.
- **R8.** Run C3 on the Core path too (fix GAP-2).

### Tier 4 — DICTIONARY DATA (medium)
- **R9.** Load the full КАТОТТГ **village tier** into `settlements.generated.ts` (matcher unchanged). → flips the dominant review category on birth/marriage certs.
- **R10.** Resolve the ЗАГС/РАЦС triple-mapping (delegate the JSON to canonical `AUTHORITIES`).
- **R11.** Add a raion gazetteer + document-number/series format validators + a given-name validation list (cross-checks the patronymic engine).

### Tier 5 — BATCHING (RPM relief)
- **R12.** Batch pages into ONE Gemini call (multiple `inline_data` parts) instead of N parallel calls → cuts the primary-RPM→flash→force-review cascade. (Owner-side: raise `gemini-3.1-pro-preview` RPM/quota.)

---

## UNKNOWNS / honest caveats
- Prod env-flag values live in Vercel, not the repo. Code DEFAULTS verified: KNOWLEDGE_BRAIN ON, SOURCE_SCRIPT_REVIEW ON; AUTO_DELIVERY_CONSENSUS / ANTI_FAB / SELF_CONSISTENCY / AUTO_ORIENT / RU_TRANSLIT / MRZ_TRANSLATION all OFF.
- No live Gemini run this session (quota). All accuracy figures are cited from the project's own prior probes, not re-measured.
- Real read-accuracy on actual UA/RU docs is the central UNKNOWN until R0 exists — and R0 is therefore the recommended first move.
