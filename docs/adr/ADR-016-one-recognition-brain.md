# ADR-016 — One Recognition Brain (unify TPS + Translation)

**Status:** Accepted · 2026-05-30
**Trigger:** Owner live-tested the SAME Ukrainian passport in TPS and in Translation
and got **different results** — TPS read only the surname; Translation read surname,
given name, DOB, place. Two products, two recognition engines, inconsistent output
on one document. For USCIS filings this is a **legal-accuracy defect**, not cosmetics.

## The two brains today (verified)
| Flow | Route | Engine |
|---|---|---|
| **Translation** | `/api/translation/vision-extract` | `readDocument` (docintel: **Gemini vision** → KMU-55) + `analyze` (central-brain). **Read the whole passport.** |
| **TPS** | `/api/tps/ocr/extract` | **Google Vision** OCR + keyword **modules** (passport/booklet/i94) + `tps/centralBrain` merge. **Read only the surname.** |

They use different OCR, different field extraction, and different geography
normalization (e.g. TPS snapped place `Ярошенець → Trostianets`; the engine
`snapCity` threshold 0.34 is too loose and should keep the raw read + review on a
distant match). Same document → divergent fields → the owner's legal concern.

## Decision
**There is ONE recognition scenario. The canonical reader is the Gemini-vision
docintel spine + central-brain `analyze`** (it demonstrably reads the full
document). Both products call the SAME recognition entry point; modules become
post-readers/validators over the SAME read, not a parallel engine.

## Target architecture
```
upload → ONE reader: docintel.readDocument (Gemini vision) ──┐
                                                             ├→ central-brain analyze (normalize: KMU-55 / D-GLOSSARY geography+authority / patronymic / dates, era-gated)
TPS modules (passport/booklet/i94) become VALIDATORS over ───┘     → fields + evidence (source_zone, rotation, page_type) + review flags
the same read (slot contract, MRZ controlling-Latin), NOT a
second OCR engine.
                                                             → TPS wizard  AND  Translation wizard render the SAME fields
```
- One geography path (D-GLOSSARY `lookupSettlement` + KATOTTG), one snap policy
  (distant match ⇒ keep raw + `review_required`, never silently replace a village
  with a city — AGENT_DOCUMENT_RULES rule 7).
- One authority/term path (D-GLOSSARY), one transliteration (KMU-55).

## Migration (phased, each green; no big-bang)
- **B1 — single reader for TPS.** Add the docintel Gemini-vision reader as the
  primary reader in `/api/tps/ocr/extract`; keep the modules as validators over its
  output. Compare against the current Google-Vision read on a fixture set; adopt the
  reader when it is ≥ as good (it read the full passport where modules read one field).
- **B2 — single normalize.** Route both flows' fields through central-brain
  `analyze` so geography/authority/patronymic/date normalization is identical.
- **B3 — one geography snap policy.** Tighten `snapCity` (or gate it behind
  `lookupSettlement`) so a distant match keeps the raw value + `review_required`.
- **B4 — evidence parity.** Both flows attach `source_zone`/rotation/page_type so a
  field is "recognized" only with evidence (closes the source-evidence gap).
- **B5 — delete the divergent path.** Remove the second OCR engine once parity holds.

## Acceptance
The same fixture document, run through TPS and Translation, yields **identical
recognized fields, identical geography/authority normalization, identical review
flags**. A fixture regression test asserts parity. No product reads a document with
a different engine than the other.

## Consequences
- One brain → one legal truth. Recognition quality improves for TPS (it inherits the
  better reader). The hard part is making the TPS modules validators (not a second
  engine), and a fixture parity test gating the merge.
- Until B1–B5 land, the two flows can still diverge — this is a multi-step project,
  executed and verified phase by phase (not a single commit).

## Also fix alongside (owner-reported)
- Translation wizard has **no "back" and no "start over"** buttons — add normal
  navigation (UX), independent of the brain unification.
