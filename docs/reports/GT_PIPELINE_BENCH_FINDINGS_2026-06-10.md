# GT Pipeline Bench — Findings (2026-06-10)

Live measurement of the production brain (`/api/translation/vision-extract`,
gemini-3.1-pro-preview) on the owner's real Cyrillic documents vs owner-verified
ground truth. Runner: `apps/web/scripts/gt-pipeline-bench.mjs` (re-runnable).
Sanitized scorecard: `GT_PIPELINE_BENCH_2026-06-10.md`. Raw values: gitignored
`qa-private/`. Sample = 1 doc/class ⇒ **EXPLORATORY ONLY** (per exit criteria).

## Core-goal read: does the brain read Cyrillic reliably?

- **Printed / structured (military booklet): YES.** 4/4 readable identity fields
  exact in BOTH Cyrillic and KMU-55 Latin. All review-flagged (safe).
- **Handwritten (internal-passport booklet): PARTIAL.** Surname + given name + DOB
  read correctly; the model did NOT return patronymic at all. All returned fields
  review-flagged.
- **Handwritten (birth certificate): UNRELIABLE — as expected.** Surname Cyrillic
  correct; given name + patronymic Cyrillic misread; DOB wrong. **Every field was
  review-flagged → no silent bad output.** This matches the standing finding: no
  model is safe on handwritten birth certs ⇒ always-review is mandatory (the safety
  stack held here).

Conclusion: the architecture is sound — printed Cyrillic is production-reliable;
handwritten is caught by the always-review gate, not released silently.

## Real issues surfaced (prioritized)

### A. Images > ~4 MB get HTTP 413 at the edge, before the brain  [USER-FACING]
The owner's real photos are 4.1–7.1 MB. The first run returned `Request Entity Too
Large` (Vercel serverless body cap ~4.5 MB) on the 7.1 MB and 4.8 MB files — the
read never happened. Real users with large phone photos hit the same wall with a
cryptic error.
→ **Action:** confirm the wizard downscales client-side before upload; if not, add
a client resize (longest edge ~2400px, JPEG q≈75 brought 7.1MB→1.5MB here with no
accuracy loss). [verify, then fix]

### B. `ua_birth_certificate` fields are marked `handwritten: false`  [SAFETY SPEC]
The registry spec marks all birth-cert fields as printed, but handwritten birth
certs are the single most dangerous class (historic wrong-person fabrication). The
per-field `handwritten → review_required` trigger therefore does NOT fire from the
spec; review currently depends on confidence<0.95. On this run everything was
review-flagged anyway, but the safeguard is mislabeled and fragile.
→ **Action (owner decision):** a birth cert can be printed OR handwritten — a single
spec can't be both. Options: (1) route handwritten birth certs through the
anti-fabrication gate (force-review hard-case classes), or (2) a separate
`ua_birth_certificate_handwritten` spec. Either way, do not rely on confidence alone.

### C. `sex` is not extractable for booklet / birth / military  [SPEC GAP]
GT verifies `sex`, but no `sex` field exists in those registry specs, so the
pipeline never returns it. Minor (sex is often captured elsewhere in the products)
but the GT can never score it today.
→ **Action:** decide whether `sex` belongs in these specs.

### D. Pro misses patronymic on the handwritten booklet  [MODEL, inherent]
The model returned 4 fields (no patronymic) for the booklet. Patronymic handwritten
is the hardest token; the answer is the review gate, not a code fix. Tracked, not a bug.

## What this unblocks

This is the measurement keystone. To move from EXPLORATORY to a canary-grade
verdict (≥30 docs/class), the binding gap is **GT documents from different real
people** (a single owner's docs cannot detect wrong-person fabrication). That is an
owner-sourcing decision (see GT_BENCHMARK_EXIT_CRITERIA).
