# Evidence report — shadow window + live wizard E2E + model probe (2026-07-04, canonical per AGENTS.md)

Statuses use ONLY the RUNTIME_TRUTH vocabulary. This report CORRECTS two of my own earlier
overclaims (owner audit findings accepted): (1) «4 флип-вердикта чистые» → the verdicts are
clean **on an insufficient window** — FLIP_CRITERIA requires N ≥ 25 per doc family; nothing
here is flip-ready; (2) «CI success» рядом с E2E — CI runs vitest only (one-brain-ci.yml:
`pnpm --filter web test`), it does NOT run Playwright; the E2E pass is a LOCAL proof.

## 1) Shadow window (translation route) — SHADOW_ONLY evidence, NOT flip-ready

| Differ | Docs | Fields | Result |
|---|---|---|---|
| decision engine (`[decision_shadow]`) | 9 | 82 | diffs=0, unresolved_mismatches=0 |
| gates-as-readers | 9 | — | loosening=0, mismatched=0 |
| tps one-arbitration | **0** | — | NO DATA — CORRECTED CAUSE: TPS front-OCR = Google Vision → 403 `OCR_BILLING_DISABLED` (node 9, BLOCKED_EXTERNAL on owner billing), NOT the Gemini storm |
| normalize collapse | **0** | — | NO DATA (same Vision-billing block) |

**Cost fact (raw log):** each Gemini full read = est_cost 2000 micro-USD ($0.002); the whole
evening's window spent well under $0.10 of the owner's $10 limit; key returned
`serviceTier: standard` (paid tier active, limit NOT exhausted).

**Qualifiers (mandatory):**
- Reader for this window = **gpt-4.1 via READER_PROVIDER=openai** (all 17 reads force-reviewed
  `fallback_model_used` — visible in the report). Primary-Gemini window: NOT yet run —
  Google's 2.5-pro was 503-ing heavy calls in waves for hours (measured: direct, local, and
  Vercel all saw `vision_failed:HTTP 503 UNAVAILABLE`; light probes 200).
- N=9 < N≥25 (FLIP_CRITERIA) and not per-doc-family. **No flip is authorized by this data.**
  Its value: differ mechanics proven on real traffic shapes; zero diffs so far.
- Runs: curl uploads + one real BROWSER-driven wizard run (see §2). Local server
  (`localhost:3333`, dev), branch tip code, shadow flags strict '1'.
- Report generator: `apps/web/scripts/shadow-window-report.mjs` over the local server log.

## 2) LIVE wizard E2E — local proof (Review UI, audit item 5) — first PASS

`apps/web/tests/e2e/translation-live-review.spec.ts` (commit 2038693): real upload (owner's
military booklet fixture, gitignored path via E2E_TRANSLATION_DOC) → step walk → «Recognize
document» → **«Translation ready!»** review screen → asserts ≥3 per-field Edit controls +
visible review instruction (uncertainty shown to the user). **PASSED 27.7s locally.**
- CI does NOT run this (vitest-only workflow + env-gated skip). Class: local proof, CI-neutral.
- Not yet proven: evidence-crop rendering on this screen (ONE_BRAIN_EVIDENCE_ENABLED was OFF
  in this run), error-state walk (task #48), preview/staging browser run.

## 3) Model probe on the pay key — raw artifact
See `docs/reports/MODEL_MATRIX_PAY_KEY_PROBE_2026-07-04.md` (39-model listing + statuses +
modelVersion). Key finding: `gemini-pro-latest` serves the banned preview version → law
«pin exact ids, no *-latest for pro» in MODEL_ROLE_MATRIX.md (commit b54b527).

## 4) CI runs (this session; verified via gh in MY session — re-verify with `gh run list`)
| sha | run | verdict |
|---|---|---|
| 6339157 (truth lock) | 28719740083 | success |
| bf8313b (one-committer rule) | — | success (next push run) |
| b54b527 (alias law) | — | success |
| 2038693 (E2E spec) | 28722809718 | success |
CI scope: tsc + PII guard + full vitest + prod build flags-OFF. NOT Playwright, NOT accuracy.

## 5) Open (unchanged, honest)
H3 GT corpus (owner data) · H4 localization (no second framing exists; fixture dup found:
birth_cert_soviet_01.jpg = byte-dup of birth_cert_handwritten_01.jpg) · primary-Gemini and
TPS windows (Google storm) · provider bbox DARK · HTR BLOCKED_EXTERNAL · key rotation
(two chat-exposed keys) · preview full window via wizard (flags+key already set on Preview).
