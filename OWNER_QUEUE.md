# OWNER QUEUE — actions only the owner can do

Items here are blocked on a human (PII, real documents, prod env, billing).
Agents do NOT perform these. Newest first.

## 2026-06-03 — P2 ground-truth (blocks P2 accuracy proof)

P2 (`SMART_NORMALIZE_ENABLED`, default OFF) is wired and tests pass, but
"better" cannot be claimed without verified ground-truth. Blank, PII-free
templates are versioned at **`docs/templates/ground-truth/`**:

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
