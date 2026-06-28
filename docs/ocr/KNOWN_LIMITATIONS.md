# OCR / Recognition — Known Limitations

Stage-0 documentation only. This file is an honest, evidence-cited register of what is
NOT working, NOT proven, or only partially built in the OCR / recognition path.

**No production-readiness claim is made or implied by this document.** Every item below
cites a concrete `path:line` or test name from the verified set. Nothing here is generalized
beyond what was actually measured.

---

## BLOCKED-EXTERNALLY

External services that cannot run because of billing / credentials / quota. These are
infrastructure blocks, not code defects — but they mean no live baseline exists.

- **Google Cloud Vision — credentials/billing blocked (returns `blocked`).** When
  credentials are absent the provider returns `{ blocked: true }` requiring
  `GOOGLE_VISION_SERVICE_ACCOUNT_JSON`.
  Cite: `apps/web/src/lib/ocr/providers/google-vision.ts:147` (and the 403/PERMISSION_DENIED
  handling at `:244`).
- **Document AI — 403 PERMISSION_DENIED on missing/insufficient credentials.** HTTP 403 is
  mapped to `PERMISSION_DENIED`.
  Cite: `apps/web/src/lib/docai/client.ts:191`.
- **Gemini live measurement — blocked by 429 / spend cap.** Cannot obtain a stable
  acceptance baseline while the AI Studio project spend cap / rate limit is exhausted.
  (No stable baseline can be reported; per CLAUDE.md a blocked read is `BLOCKED_…`, never a
  flash number.)

---

## NOT-PROVEN

Things that have NOT been measured, or where a passing signal does NOT prove correctness.
Do not cite these as quality numbers.

- **Handwriting Cyrillic recognition FAILED on the held-out hand.** `hand_B_military_ua`
  scored `strict_exact: 0` of 3 with `raxtemur/trocr-base-ru`. The GA LLMs fabricate on
  unreadable handwriting. This is a recorded regression anchor, not a success.
  Cite: `scripts/htr/cross_hand_harness.py:62-65`.
- **Printed Cyrillic baseline NOT measured (no corpus).** There is no printed-document corpus
  measured. The handwriting 0% result MUST NOT be generalized to printed documents — printed
  accuracy is simply unknown, not zero.
- **Gemini live baseline NOT available.** See BLOCKED-EXTERNALLY (429 / spend cap). No stable
  multi-run acceptance number exists for the primary reader.
- **Gemini structured-JSON compliance is NOT proof of value correctness.** A response that
  conforms to the expected JSON schema only proves shape, not that the field *values* match
  the document. Schema compliance must never be reported as recognition accuracy.

---

## BUILT-BUT-OFF

Safety / gating mechanisms that exist in code but are disabled by default (flag OFF →
byte-identical legacy behavior). They provide no protection in the shipped default.

- **`finalPdfGate` — built but default OFF.** Gate flag
  `FINAL_PDF_CONFIRMATION_GATE_ENABLED`; OFF returns `{ ready:true, enforced:false }` so
  callers keep legacy gates.
  Cite: `apps/web/src/lib/contracts/finalPdfGate.ts:7,24`.
- **C3 OCR field safety (null-on-reject) — built but default OFF.** Flag
  `OCR_FIELD_SAFETY_ENABLED`; OFF → caller skips the guard entirely (byte-identical prod).
  Cite: `apps/web/src/lib/documentSafety/applyOcrFieldSafety.ts:5,19-20`.

---

## ARCHITECTURAL-GAP

Missing wiring or missing capability in the architecture itself — not a flag, not an external
block.

- **Translation path produces NO per-field bbox / evidence.** `FieldOut` carries no `bbox` or
  `evidence` fields, so the review UI falls back to `full_image` / `zone_fallback` instead of
  a precise per-field crop.
  Cite: `apps/web/src/lib/canonical/core/translationAdapter.ts:22-50`;
  `apps/web/src/app/[locale]/services/translate-document/session/[sessionId]/review/EvidenceReviewPage.tsx:73,200`.
- **Document AI is NOT wired into the translation path.** Only `google-vision` is imported in
  the translation vision-extract route, and only for raw text.
  Cite: `apps/web/src/app/.../vision-extract/route.ts:42,167,172,403`.
- **No real browser / API DB-backed E2E.** Only local, mocked contract tests exist.
  Cite: `apps/web/tests/e2e-contract/*`.

---

_All claims above are bounded to their cited evidence. Absence of a measurement is reported as
"unknown", never as a pass or a fail._
