# ADR-009: Provider Data Policy — PII Handling and Image Retention
Status: Accepted
Date: 2026-05-27

## Context

The pipeline processes Ukrainian identity documents containing PII (name, DOB, passport number, address). Multiple providers receive data at different stages. This ADR defines what each provider may receive and mandates image retention controls.

## Data Flow Rules (HARD RULES — violations = security bug)

### Rule 1: Google Vision / DocAI receive IMAGE BYTES ONLY
- DO NOT send extracted field values (name, DOB, passport number) as separate API parameters
- DO NOT send structured PII to Vision/DocAI beyond the image itself
- The image contains PII inherently — this is acceptable per standard OCR use
- Rationale: minimize structured PII exposure; comply with Google Cloud DPA

### Rule 2: DeepSeek receives RAW OCR TEXT ONLY
- NEVER send image bytes to DeepSeek
- Acceptable input: raw OCR text string as extracted by Vision (contains PII as unstructured text)
- NOT acceptable: structured key/value pairs of extracted fields (e.g., `{ passport_number: "IA123456" }`)
- Rationale: DeepSeek is a third-party LLM. Sending structured PII creates unnecessary exposure and complicates privacy disclosure requirements.
- **Privacy disclosure REQUIRED** before production enable: users must be informed that raw document text is sent to DeepSeek for extraction assistance

### Rule 3: Image Retention — MUST VERIFY (not assumed closed)
Status: **OPEN — requires explicit audit per item below**

Document images contain full PII. After OCR response is received, the image MUST NOT persist in:
- [ ] Temporary files (OS temp dir, Next.js temp uploads)
- [ ] Server logs (request bodies, multipart upload logs)
- [ ] Vercel function payload logs
- [ ] Supabase storage (unless user explicitly opts into storage)
- [ ] Build artifacts / CI artifacts
- [ ] Error tracking payloads (Sentry, Datadog — if used)

**Verification method**: for each item, trace code path from file upload handler to OCR call to confirm no persistence. Until each item is checked and closed, image retention status remains OPEN.

Known modules to audit:
- `apps/web/src/app/api/tps/ocr/` — upload handler
- `apps/web/src/lib/ocr/providers/google-vision.ts` — Vision call
- `apps/web/src/lib/docai/client.ts` — DocAI call (if enabled)
- Any `writeFile` / `fs.createWriteStream` calls in pipeline path

### Rule 4: No PII in git
- No raw OCR text in committed test fixtures
- No extracted field values (real documents) in committed artifacts
- No document images in repository
- Test fixtures use synthetic data only (fake names, fake passport numbers)

### Rule 5: No PII in ZIP artifacts stored server-side
- Translation HTML and TPS forms in ZIP are user-generated output
- ZIP must be delivered to user and NOT retained server-side beyond the session
- If Supabase storage is used for ZIP, it must be session-scoped and auto-deleted

## Privacy Disclosure Requirements

Before DeepSeek is enabled in production, the user-facing UI MUST include:

> "To automatically read your document, our system sends the text extracted from your document to an AI service for field identification. No document images are transmitted. You may skip this step and enter information manually."

Location: TPS Wizard upload step, before OCR is triggered.

## Audit Status

| Item | Status | Evidence |
|------|--------|----------|
| Google: image bytes only | ✅ VERIFIED | `google-vision.ts` sends only image buffer |
| DocAI: image bytes only | ✅ VERIFIED | `docai/client.ts` sends only document content |
| DeepSeek: text only | ✅ VERIFIED | `documentBrain.ts` takes `text: string` not image |
| Image not in git | ✅ VERIFIED | .gitignore covers uploads; test fixtures use synthetic data |
| Temp file cleanup | ⚠ OPEN | Not traced through full upload handler path |
| Log suppression | ⚠ OPEN | Vercel function logs not audited |
| Supabase storage | ⚠ OPEN | No confirmed auto-delete policy for ZIP |
| DeepSeek privacy disclosure | ⚠ OPEN | UI disclosure not present |

## Consequences

- P1 runtime changes must not introduce new PII exposure paths
- Open items in audit table are P2 blockers for production launch
- DeepSeek privacy disclosure is a pre-production requirement (not just nice-to-have)
- Image retention must be verified by code trace, not by assumption
