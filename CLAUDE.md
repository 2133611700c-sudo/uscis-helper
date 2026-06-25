# CLAUDE.md — Mandatory Agent Rules for uscis-helper

## THE RULES MENU — start here, don't grep (2026-06-22):
- `docs/architecture/RULES_MASTER_INDEX.md` — the audit menu: WHO has which rules, by TOPIC, by DOCUMENT, by GUARD, with file pointers. Open this to find any rule instead of searching.
- `docs/architecture/CONSTITUTION.md` — the 10 laws (L1–L10) above everything (one Gemini reader, one codex, DeepSeek prose-only, C3 single final_value writer, never guess critical, …).
- `docs/architecture/RECOGNITION_ORG_CHART.md` — each AI's single role; `docs/adr/ADR-AGENT-PERMISSIONS.md` — permissions.
- RULE #1 (owner-emphatic): for ANY task, read the existing report/audit on THAT question BEFORE planning or coding.

## BEFORE YOU TOUCH ANY CODE — READ THESE FILES (in order):
0. `docs/audit/2026-06-13-DOCUMENT_CORE_AND_PROJECT_STATE_AUDIT.md` — consolidated evidence-only audit (brain/dictionary/arbitration/canonical + repo/PR/security/deploy). Read FIRST; verified facts, `UNVERIFIED` items, and risk register.
1. `STATUS.md` — current operational truth (1 screen)
2. `HANDOFF.md` — last session results + exact next task
3. `SOURCE_OF_TRUTH.md` — canonical modules, what NOT to duplicate
4. `docs/adr/*.md` — accepted architecture decisions (DO NOT re-litigate)
5. `CHANGELOG.md` — permanent session history (scan latest 3-5 entries)
6. `PROJECT_HISTORY.md` — full product timeline across all repos (read once)

If you skip this step, you WILL waste time re-investigating solved problems.

## AFTER EVERY SESSION — UPDATE THESE FILES:
1. Update `HANDOFF.md` with: what you did, what you didn't, exact next task, evidence
2. Update `STATUS.md` if any VERIFIED/OPEN items changed
3. If you made an architecture decision, create a new ADR in `docs/adr/`
4. Append `CHANGELOG.md` with session summary

Enforcement: pre-commit + GitHub Actions require `STATUS.md`, `HANDOFF.md`, and `CHANGELOG.md` in every commit.
Before first local use: run `bash scripts/setup-git-hooks.sh`.

## AFTER EVERY COMMIT — APPEND TO CHANGELOG:
Add entry to `CHANGELOG.md` with: date, what changed, which files, test results.
Format: `## YYYY-MM-DD | <short summary>` then bullet list of changes.
This is the permanent project history. HANDOFF.md is only the latest session.

## EVERY WORK SESSION MUST PRODUCE:
1. Updated HANDOFF.md (what done, what not, next task)
2. Updated CHANGELOG.md (permanent log entry)
3. Test evidence (paste exact test output)
4. Build evidence (0 type errors confirmed)
If a session produces no updates to these files, the session is considered undocumented and its changes are untrusted.

## PROJECT IDENTITY
Messenginfo = self-help immigration info + document translation + USCIS draft-form platform.
NOT a law firm. NOT legal advice. User reviews, signs, files independently.
Entity: SK Logistics LLC, Los Angeles, CA.

## CANONICAL PACKAGES
- `packages/knowledge/` — dictionary, transliteration (KMU-55), normalization. THIS IS THE SINGLE SOURCE OF TRUTH for Ukrainian terminology. Do NOT create parallel dictionaries.
- `apps/web/src/lib/tps/` — TPS pipeline (answers, field maps, PDF prefill, OCR modules)
- `apps/web/src/lib/translation/` — Translation engine

## HARD RULES (violations = bugs)
- Patronymic = "Patronymic", NEVER "Middle Name"
- Historical "Міліція" → "Militsiya", NEVER "Police" or "Militia"
- Self-name on .gov.ua beats any third-party reference
- Controlling Latin spelling (MRZ/I-94/EAD) beats re-transliteration
- Historical place names in old documents: preserve, do NOT modernize
- "смт" = "urban-type settlement", NEVER "city" or "town"
- Oblast genitive ("Вінницької") → nominative DMS-verified ("Vinnytsia Oblast")

## MODELS — ADR-018 IS LAW (enforced in code: `apps/web/src/lib/docintel/modelMatrix.ts`)
- **⚠ CORRECTION (ADR-026, 2026-06-24) — ROUTE BY FIELD RENDERING.** Verified on the owner's real docs: a HANDWRITTEN field reads correctly **key-free** via `raxtemur/trocr-base-ru` on a NATIVE-resolution crop + contrast (never downscale/binarize) — it BEATS the LLMs on cursive but CANNOT abstain (fabricates on a blank crop) → its non-exact reads are gated + human-reviewed. A PRINTED field → an LLM (Gemini/GPT read print perfectly; raxtemur fails print). `gemini-3.1-pro-preview` is an UNSTABLE preview that WOBBLES run-to-run (dropped from HTR benchmarks); deterministic readers are raxtemur + gpt-4.1. The handwriting reader + route-by-rendering are NOT yet wired into the production pipeline (sidecar hosting decision pending) — the bullets below describe the LLM availability matrix as currently shipped.
- **Primary LLM reader = `gemini-2.5-pro`** (stable GA; reads PRINTED Cyrillic correctly + stably across runs). The unstable `gemini-3.1-pro-preview` was REMOVED 2026-06-24 (owner) — sporadic 503/429 + run-to-run instability; it is now in DEPRECATED_MODELS (never use). 2.5-pro stays DISQUALIFIED on handwritten certs (fabricates) → handwriting = raxtemur (ADR-026, not yet wired) + human review.
- **Fallbacks = AVAILABILITY only, force-reviewed, NEVER acceptance, NEVER primary**, in PREFERENCE order: `gemini-2.5-pro` (GA, accurate on PRINTED docs), `gemini-3.5-flash`, `gemini-2.5-flash`. A fallback read of a non-Latin doc is force-reviewed (`fallback_model_used`).
- **`gemini-2.5-pro` AND `gemini-2.5-flash` are DISQUALIFIED for certificate docs** — they FABRICATE a different, fake person on handwriting. `gemini-2.0-flash` is DEPRECATED (404) — never use.
- **HANDWRITTEN certificates are ALWAYS human-reviewed**, regardless of model (birth/marriage/divorce/death/name-change/certificate). The GA **LLM APIs fabricate** on handwriting; the key-free `raxtemur` HTR reads it best but cannot abstain → review gate stays mandatory (ADR-026 corrects the old blanket "no model reads handwriting").
- **Token budget:** thinking models hit `MAX_TOKENS` at 8192 → EMPTY reads; the provider raised the cap to `max(8192, GEMINI_MAX_OUTPUT_TOKENS || 16384)`.
- **NEVER report a fallback read as a quality/acceptance number.** Acceptance is measured ONLY on the primary reader; if it is unavailable (e.g. quota 429), the result is `BLOCKED_…`, NOT a flash number. (This rule exists because an agent once proposed measuring acceptance on flash.) Enforced by `modelMatrix.acceptanceModelVerdict()` + the runner gate + `modelMatrix.test.ts` (CI).
- Full live matrix: `docs/architecture/MODEL_INVENTORY.md`.

## TECH STACK
- Next.js 14 (App Router), TypeScript strict, Tailwind CSS
- Vercel deploy, Supabase DB, DeepSeek R1 AI, Stripe payments
- pnpm workspace: `apps/web` + `packages/*`
- Tests: `pnpm --filter web run test` (vitest, expect 1930+ pass)
- Typecheck: `npx tsc --noEmit -p apps/web/tsconfig.json` (expect 0 errors)
- Build: `pnpm --filter web build`

## CONTENT RULES
- Never "консультация" — say "информационная помощь"
- Never "сертифицированный перевод" — say "черновик перевода"
- Never "мы подадим за вас" — say "система заполняет, вы проверяете"
- Never "Handy & Fiend" — correct is "Handy & Friend"
- Address: 1213 Gordon St, LA, CA 90038 — "Apt 8" NEVER appears
- Never fixed prices — only ranges
- All colors via CSS vars (dark mode): `var(--text-1)`, `var(--surface-1)`

## KNOWLEDGE BASE
- NotebookLM: https://notebooklm.google.com/notebook/555f6e28-1a29-4ea0-9b25-2d1925537145
  Check here first for immigration knowledge, then verify on uscis.gov

## GIT
- Branch: main (direct push)
- Deploy: auto via Vercel on push
- Healthcheck: `https://messenginfo.com/api/healthz`
