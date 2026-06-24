# HONEST critical re-test — cert + passport, fixed boxes, blank control (2026-06-24)

**Owner: "не верь ранним тестам, делай заново честно."** This re-test fixes a real methodological flaw in
the earlier tri-agent run and CORRECTS two over-claims. PII → paid tiers + gitignored; PII-free here.

## What was wrong before (self-critique)
1. **Box overfitting:** earlier I selected field-crop bounds by best-CER-vs-GT — i.e. peeking at the answer,
   which inflates results. This re-test uses **FIXED boxes** (committed cert boxes + eye-set passport boxes),
   chosen WITHOUT looking at CER.
2. **Weak blank-control claim:** I reported raxtemur "blank-control clean". That only meant it didn't output
   the *surname*, not that it returned empty.

## Method
Fixed boxes; 4 readers (raxtemur local, gemini-3.1-pro-preview, gemini-2.5-pro, gpt-4.1); 3 runs each
(consistency); blank-control per reader; channel-aware scoring. **Passport (PRINTED) is the control** — if all
readers failed it, the harness would be broken.

## CRITICAL findings (the corrections)
**1. raxtemur CANNOT abstain — it fabricates on a BLANK image.**
On a blank crop raxtemur emitted **9 Cyrillic chars**; all 3 LLMs correctly returned **empty**. raxtemur is a
recognizer with no "I see nothing" state → it always emits a word. **Consequence:** only raxtemur's EXACT
(CER 0), run-consistent reads are trustworthy; any non-exact raxtemur read may be fabrication and MUST be
gated (consistency/confidence) + human-reviewed. This corrects the earlier "blank-control clean" claim.

**2. raxtemur FAILS printed text — it is a HANDWRITING specialist.**
On the printed passport name line raxtemur scored CER 0.9–1.0 (0/2 exact). The 3 LLMs read the printed
passport **perfectly (2/2 exact each)**. So "raxtemur is the reader" was too broad.

## Results (fixed boxes, exact = CER 0)
| Reader | Handwriting (cert, N=3) | Printed (passport, N=2) |
|---|---|---|
| **raxtemur** (local, $0) | **2/3 exact** (best on cursive) | **0/2 (fails print)** |
| gemini-3.1-pro-preview | 1/3 | 2/2 |
| gpt-4.1 | 1/3 | 2/2 |
| gemini-2.5-pro | 0/3 (fabricates handwriting) | 2/2 |

## Corrected conclusion (honest)
- **Route by field RENDERING, not one reader for all:** handwritten field → raxtemur (+ mandatory
  consistency/confidence gate because it can't abstain, + human review); printed field → LLM (all three read
  print perfectly). gemini-2.5-pro stays DISQUALIFIED for handwriting (0/3, fabricates).
- **What held up honestly:** with FIXED (non-tuned) boxes, raxtemur is still the best HANDWRITING reader
  (cert 2/3 exact, run-consistent — the surname+given exact reads are real, not box artifacts). The harness is
  sound (printed control passed for the LLMs). gemini-2.5-pro still fabricates cursive.
- **Earlier "raxtemur 3/6" included one CER-tuned crop set (soviet01)** — the birth01 numbers (used here) were
  always on committed boxes and reproduce; the soviet01 portion was partly tuned and is not relied on.
- **Not autonomous:** even the best per field is gated by human review; raxtemur's no-abstain property makes
  that gate non-negotiable.

## Reproduce
`qa-private/htr-venv/bin/python qa-private/htr-poc/honest_retest.py` (fixed boxes; crops/reads gitignored).
