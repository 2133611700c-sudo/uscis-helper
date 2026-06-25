# HTR STABLE benchmark — frozen config, 5 runs/field, variance measured (2026-06-24)

**Owner: "всё по-разному = фейк; откуда gemini-3.1-pro? это нестабильная preview!"** — both correct. Prior
reports wobbled because (1) I wrongly used `gemini-3.1-pro-preview` (a known-unstable PREVIEW), and (2) I
changed the config between runs (models, CER-tuned vs fixed crops). This is the FROZEN, reproducible benchmark.

## Method (frozen — do not change)
- Readers: **raxtemur** (local, deterministic) + **gpt-4.1** + **gemini-2.5-pro** (stable GA). **NO preview
  models** (gemini-3.1-pro-preview dropped — unreliable by our own finding, ADR-018).
- Fixed boxes (committed cert + eye-set passport). Docs: cert (handwritten) + passport (printed).
- **N=5 runs per field**, temp 0. Report VARIANCE (distinct outputs / 5) FIRST, then CER. PII → paid tiers +
  gitignored; PII-free here. Reproduce: `qa-private/htr-venv/bin/python qa-private/htr-poc/stable_bench.py`.

## Stability (distinct outputs across 5 runs)
| Reader | stable fields | wobble |
|---|---|---|
| **raxtemur** | **5/5 STABLE** (deterministic — identical every run) | none |
| **gpt-4.1** | **5/5 STABLE** (temp 0 deterministic) | none |
| gemini-2.5-pro | 4/5 stable | **1 field VARIES** (cert given: 3 distinct outputs in 5 runs) ⚠ |

The instability was never raxtemur (rock-stable). It was the preview model + my config churn + gemini-2.5-pro
genuinely wobbling on cursive.

## Frozen results (every value identical across all 5 runs unless noted)
| Doc | Field | raxtemur | gpt-4.1 | gemini-2.5-pro |
|---|---|---|---|---|
| cert (HW) | surname | **0.0 exact** | 0.8 | 0.7 |
| cert (HW) | given | **0.0 exact** | **0.0 exact** | 0.833 (⚠ varies, never exact) |
| cert (HW) | patronymic | 0.333 | 0.889 | 0.778 |
| passport (PRINT) | surname | 0.9 (fails) | **0.0 exact** | **0.0 exact** |
| passport (PRINT) | given | 1.0 (fails) | **0.0 exact** | **0.0 exact** |

## ⛔ HELD-OUT REGULARITY CHECK — NEGATIVE (2026-06-24): no proven pattern
Owner challenge: "не объявляй победу по всей рукописи; прогони held-out набор разных украинских
рукописей — если повторится, это решение, а не удачный кейс; я не верю, нет закономерности."
Tested raxtemur on a DIFFERENT handwritten document — `marriage_1939_kharkiv_borodavka` (1939,
bilingual UA/RU ЗАГС, a different writer/era/style, lower-res 1920px). **The surname FAILED** (the
visibly-handwritten word read as garbage, not a match), across crop attempts. So:
- The two "successes" (birth_cert_handwritten_01, birth_cert_soviet_01) are a NARROW CLUSTER — both
  Soviet/Russian-script cursive at high resolution (2493–4128px). **They are not a pattern; they are
  two similar points.**
- The FIRST genuinely different held-out doc broke it. **Regularity is NOT demonstrated.**
- We have ZERO scored Ukrainian-handwriting results (UA docs lack ground truth); the other UA docs we
  hold are either PRINTED (modern typed marriage certs) or too low-res to be a fair handwriting test.
- Field localization is also unsolved: every new document needed hand-found boxes, several mis-located.
**Honest status:** raxtemur reads a narrow cluster of high-res Soviet-RU cursive; it is NOT a proven
general handwriting reader. The correct order is (1) assemble a GROUND-TRUTHED held-out set of DIVERSE
real UA/RU handwriting (needs owner-supplied GT), (2) measure regularity, and ONLY IF it repeats (3)
build the raxtemur sidecar. Building the sidecar before the regularity evidence would be backwards.

## Conclusion (stable + reproducible)
- **Handwriting → raxtemur:** stable, best (2/3 exact, deterministic). gpt-4.1 gets given only; gemini-2.5-pro
  fails AND wobbles on cursive → stays disqualified for handwriting.
- **Printed → gpt-4.1 or gemini-2.5-pro:** both read the printed passport perfectly (2/2 exact, stable).
  raxtemur fails printed (stably).
- **Route by field rendering** (ADR-026, corrected). Deterministic readers (raxtemur, gpt-4.1) give identical
  results every run — THIS report is reproducible; re-running yields the same table. raxtemur still cannot
  abstain (HTR_HONEST_RETEST) → non-exact reads gated + human-reviewed.
