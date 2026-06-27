# Stability Audit — real documents, multi-run (2026-06-23)

Owner demanded an honest, multi-run, can't-be-faked measurement on the REAL documents (the "7/7"
single-run "proof" was distrusted). This is that measurement. Tool: `apps/web/scripts/stability-audit.mjs`
(runs each doc N times through the live pipeline, scores the MAJORITY value vs owner GT, reports
per-field variance; 429/fallback → BLOCKED, never faked — ADR-018). Primary = removed preview primary.

## Runs (N=5/doc, primary-only)

### A. Baseline — single read (TILE_VOTE_RUNS=1)
| doc | identity read | recovery | orient | blocked | acc@majority |
|---|---|---|---|---|---|
| international passport (as booklet) | family/given CORRECT 5/5 | UNSTABLE (dob/place/issue 4/5) | STABLE 0° | 0 | — |
| military id | family/given/patronymic CORRECT 5/5 | STABLE 5/5 | STABLE 0° | 0 | — |
| birth cert (handwritten RU) | child name+dob CORRECT 4/4 | UNSTABLE (father/mother/series 2/4) | **UNSTABLE 0/270** | 1 (deadline) | — |
| **overall** | | | | | **10/15 = 66.7%** |

### B. Tile voting (TILE_VOTE_RUNS=3) — same N=5
| doc | recovery | change |
|---|---|---|
| international passport | **STABLE 5/5** (dob/place/issue) | ⬆ from 4/5 |
| military id | STABLE 5/5 | = |
| birth cert | **4/5** (father/mother/series) | ⬆ from 2/4 |
| birth orient | still 270/0 | (run used pre-voting orient code) |
| **overall** | | acc 66.7%, **0 blocked** |

### C. Combined (ORIENT_VOTE_RUNS=3 + TILE_VOTE_RUNS=3) — RATE-LIMITED
All 15 runs BLOCKED: the heavy ~150-call burst tripped Google's primary-model availability →
`HTTP 503 UNAVAILABLE` + fallback-to-flash (ADR-018 force-excluded). The audit reported **0 ok,
accuracy 0/15, every run BLOCKED — zero faked numbers.** This is the honesty gate working, and an
operational finding: K=3×K=3 voting in a burst is too aggressive for the rate limit.

## Honest findings
1. **The identity Cyrillic read is STABLE** — surname/given/patronymic CORRECT 5/5, distinct=1 on
   every doc. The core read is reliable run-to-run.
2. **Tile recovery WAS flaky (the "качели" is real at N=5)** — baseline passport 4/5, birth 2/4.
   **K-sample majority voting fixed it**: passport → 5/5, birth → 4/5. Research-backed
   (self-consistency) and now measured, not claimed. My earlier "7/7" was one lucky single run.
3. **Orientation detection flips 0/270 on the birth cert** (a two-page spread is ambiguous to the
   grid VLM). I had WRONGLY called it "3/3 stable" on N=2-3. Fix shipped: K-vote the detector
   (`detectUprightCwVoted`, ORIENT_VOTE_RUNS=3); a split → no rotation. Combined live re-measure is
   pending a rate-limit cooldown.
4. **Accuracy@majority 66.7% via standalone readDocument is NOT a clean product number** — the
   harness bypasses the route's MRZ injection (so printed/MRZ dob shows MISS) and the
   "internal_passport" fixture is actually the international passport scored as a booklet. Real
   product accuracy must be measured through the live route (gt-pipeline-bench). The MISS fields
   here are mostly harness artifacts + one real gap: **sex is not extracted on birth/military**
   (derivable from the patronymic — Сергеевич ⇒ M; the patronymic engine exists → teachable).
5. **Cost/rate reality:** voting multiplies calls; both votings at K=3 burst-tripped the rate limit.
   Flag posture must be moderate (e.g. tile vote K=3 where it matters, orient vote K=3 only when a
   first detect is uncertain — a cheaper "vote-on-doubt" variant is the next refinement).

## Verdict per stage
| stage | stable? | accurate? | action |
|---|---|---|---|
| content orientation | NO at N=5 (birth 0/270) → voting added | n/a | re-measure voted after cooldown |
| identity Cyrillic read | YES (5/5) | YES on names | keep |
| tile recovery | flaky → **voting fixes it** (5/5 / 4/5) | recovers present fields | keep voting |
| sex field | stable MISS | NO (not extracted) | teach: derive from patronymic |
| dob (printed/MRZ) | n/a standalone | MISS standalone (route injects MRZ) | measure via live route |

## Next (research-backed, owner-gated)
- Re-run the combined voted audit after rate-limit cooldown; expect birth orient → stable, birth
  recovery → ≥4/5.
- "Vote-on-doubt" orientation: single detect; only vote when low-confidence/split → cuts cost.
- Sex-from-patronymic for birth/military (existing patronymic engine).
- Future (deps): a dedicated orientation classifier (Phi-3.5/PP-LCNet, 96.8%) and a 2nd OCR reader
  (Mistral OCR / PaddleOCR-VL) for consensus — both noted in the research, not adopted yet.

All flags remain default OFF (byte-identical). Nothing flipped in prod.
