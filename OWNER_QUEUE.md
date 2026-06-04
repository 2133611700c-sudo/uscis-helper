# OWNER QUEUE — actions only the owner can do

Items here are blocked on a human (PII, real documents, prod env, billing).
Agents do NOT perform these. Newest first.

## 2026-06-04 — OPEN: durability of the prod metric deploy + GT fill
- **Prod is ahead of main.** `vercel --prod` (2026-06-04) shipped the local branch
  `feat/knowledge-core-stabilize` (22 commits, unpushed). Prod runs `sha f60d73f`, NOT in `main`.
  A future push-to-main auto-deploy would ROLL BACK the metric + gate code. **Owner action:** push
  the branch + open a PR + merge to `main` so prod is durable + reviewed-of-record.
- **GT fill (still MISSING):** fill `qa-private/ground-truth/birth_cert_soviet_*.json` +
  `birth_cert_handwritten_*.json` → `VERIFIED_BY_OWNER` per `docs/reports/GT_OWNER_FILL_GUIDE.md`.
  Then the agent runs local accuracy. Do NOT fill from model output.
- **Metric verification:** after a real document is processed in prod, the agent can confirm the
  `[document_class_metric]` line via Vercel runtime logs (PII-free).

## 2026-06-03 — P2 ground-truth (BLOCKS the OFF-vs-ON accuracy delta) — STILL OPEN

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
