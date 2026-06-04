# OWNER QUEUE — actions only the owner can do

Items here are blocked on a human (PII, real documents, prod env, billing).
Agents do NOT perform these. Newest first.

## 2026-06-04 — current owner-gates (after PR #80 merge)

**DONE (no longer owner-blocked):**
- ✅ Durability: branch pushed → PR #80 → **MERGED** → `prod == main` (origin/main `46a0912`; healthz ok sha `46a0912`).
- ✅ `DOCUMENT_CLASS_METRICS_ENABLED=1` set in Production (metric code now in prod via main).
- ✅ Prod health verified (messenginfo.com ok, latest deploy Ready).

**OPEN — owner only:**
1. **Fill ground-truth** (human transcription, NOT model output) for
   `qa-private/ground-truth/birth_cert_soviet_*.json` + `birth_cert_handwritten_*.json` →
   `ground_truth_status: VERIFIED_BY_OWNER`. Guide: `docs/reports/GT_OWNER_FILL_GUIDE.md`.
2. After GT: tell the agent → it runs the local OFF-vs-ON accuracy verification (no prod).
3. After accuracy: decide whether to enable `SMART_NORMALIZE_ENABLED` (and later anti-fab/self-consistency)
   in a canary — owner authorization required; agent will not enable behavior flags alone.
4. Later: PII history sweep before sharing the repo externally (surname/`FU262473`/DOB are pervasive in
   main history — Session-54 debt; not a blocker for internal work).

**Agent can do autonomously (not owner-gated):** verify the `[document_class_metric]` line via Vercel
runtime logs once a real document is processed in prod (currently NOT_OBSERVED_YET — no extraction since deploy).

## 2026-06-03 — P2 ground-truth — SUPERSEDED (the "no images" claim below was FALSE; images exist)

**Verified 2026-06-03 (raw):** the OFF-vs-ON harness was requested but CANNOT run —
precondition not met:
- `test-fixtures/real-docs/ground-truth/*.json` → all `ground_truth_status="NEEDS_OWNER"`,
  `0` filled fields (birth_cert_handwritten 0/11, birth_cert_soviet 0/11, military_id_p1 0/7).
- No document images in `test-fixtures/real-docs/` (`NO_IMAGES_FOUND`) — `readDocument`
  has nothing to read.

**Two things are needed from the owner to unblock the accuracy measurement:**
1. The DOCUMENT IMAGES (birth cert soviet / handwritten, military id p1) placed in
   `test-fixtures/real-docs/` (gitignored) — needed to run `readDocument`.
2. The GROUND-TRUTH VALUES filled into the JSONs + `ground_truth_status=VERIFIED_BY_OWNER`.

Once both exist, the harness runs each doc through `readDocument` twice
(`SMART_NORMALIZE_ENABLED` unset vs `=1`) and reports the per-field delta. **Until
then, enabling `SMART_NORMALIZE_ENABLED` in prod stays FORBIDDEN** (Core is already
ON in prod — see `docs/reports/P2_DICTIONARY_IN_LIVE_PATH_CHECKPOINT.md`).

---

Blank, PII-free templates are versioned at **`docs/templates/ground-truth/`**:

- `birth_cert_soviet.template.json`
- `birth_cert_handwritten.template.json`
- `military_id_p1.template.json`

**Owner action:**
1. Copy each template to a local gitignored path
   (`test-fixtures/real-docs/ground-truth/` or `qa-private/ground-truth/`).
2. Fill the EXACT values from the physical documents.
3. Set `_meta.ground_truth_status` to `VERIFIED_BY_OWNER`.
4. **Do not commit** the filled files (they contain PII).

See `docs/templates/ground-truth/README.md` for the full procedure and how the
P2 OFF-vs-ON delta is measured afterward.

> The passport booklet ground-truth is already VERIFIED at
> `qa-private/ground-truth/internal_passport_<surname>.json` (gitignored).
