# Engineering Master Plan & Tracker — Messenginfo
**Owner:** Sergii · **Maintained by:** the engineering agent · **Status:** LIVING DOC
**Created:** 2026-05-30 · This is the single source of truth for HOW we move.
Every agent reads this first. Update the trackers (`[ ]` → `[x]`) after each PR.

---

## 0. Agent's honest assessment of the owner's input
The owner's guidance is senior-grade and correct on the decisive points:
- **One CanonicalDocumentResult, not "Gemini everywhere."** A naive "plug the best
  reader into TPS" (my earlier "go B1") would have created a THIRD brain. The
  contract-first + shadow-parity approach is the right one.
- **Safety PRs (geography no-silent-snap, audit hard-fail) BEFORE the big unification.**
  Small PRs, large safety ROI; they de-risk the migration.
- **Three laws as a constitution.** Without them, even one brain emits "smart garbage."

Critical pacing note (agent): the operational layer (full Human Review Queue product,
retention infra, ops dashboards) is important but must come AFTER canonical + safety —
building it first repeats "floors on a crack." It is in the plan, sequenced later.

---

## 1. THE THREE LAWS (project constitution — non-negotiable)
1. **No evidence → no field.** A value is never shown as "recognized" without
   `documentSessionId` + provider + page/rotation/bbox/snippet evidence.
2. **No review snapshot → no final PDF.** The signed PDF is generated ONLY from a
   frozen `reviewSnapshotHash`; no OCR/AI re-extraction after signature.
3. **One document → one CanonicalDocumentResult → all products read it.** No wizard/
   route calls OCR/provider/render directly; only through the Document Core.

Corollaries: no silent correction (raw≠normalized materially → review_required);
OCR text is untrusted DATA, never instructions; product may not say "certified/ready"
until snapshot + 2 checkboxes + signature + audit write + PDF-from-snapshot exist.

---

## 2. Target architecture
```
Upload → Document Core
  → Quality Gate (blur/rotation/wrong-page/low-res → ask better photo, no AI spend)
  → OCR/layout providers (Google Vision / Document AI) = RAW evidence
  → Vision reader (Gemini docintel) = field candidates + evidence
  → Provider Output Quarantine (candidates, not truth)
  → Normalizers (KMU-55, D-GLOSSARY geography/authority) — NO silent correction
  → Safety guards (garbage, confidence contract, criticality, provider-disagreement)
  → CanonicalDocumentResult (the single truth object)
→ Product Adapters (TPS / Translation / ReParole / EAD) — decide which fields they need
→ Review Gate (snapshot + checkboxes + signature) → Finalization Lock
→ PDF/ZIP (from frozen snapshot) → Two-layer PDF proof → Evidence Ledger + Audit
```
Key types: `CanonicalDocumentResult`, `CanonicalField` (key, rawValue, normalizedValue,
translatedValue?, source, confidence{ocr,field_match,normalization,source_match,final},
reviewRequired, extractionMissing, rejectedReason, evidence{...}).

---

## 3. PHASE PLAN (sequenced, each phase green before next)

### Phase 0 — FREEZE (active now)
STOP: P2 glossary migration · new doc types · BUREAU_PDF on · marriage/divorce/death
expansion · new OCR providers · deleting dead code. ALLOWED: one-brain migration,
evidence/safety gates, parity tests, source/audit fixes, dead-path isolation (not delete).

### Phase 1 — Small safety PRs (highest ROI, do FIRST)
- **S1 Geography no-silent-snap** — fuzzy match → suggestion + review_required, keep raw.
- **S2 Audit persistence hard-fail** — if order/audit DB write fails → non-200/DEGRADED, no "complete."
- **S3 No-silent-correction policy** — extend S1 to name/patronymic/authority/date/series.

### Phase 2 — Canonical contract (no behavior change)
- `canonicalDocumentResult.ts` + `readCanonicalDocument.ts` (adapter over the strongest
  existing reader). Field confidence contract + document-type gate + provider-disagreement.

### Phase 3 — Shadow parity
- TPS + Translation run canonical in SHADOW behind `ONE_BRAIN_SHADOW`. `oneBrainParity.test.ts`
  (same fixture → identical canonical → both products read it). `ONE_BRAIN_SHADOW_DIFF.md`.

### Phase 4 — Controlled migration
- After 3–5 real docs show canonical ≥ old: flip canonical primary for TPS, then Translation.
  Old TPS modules stay as validators/fallback. Kill switches per layer.

### Phase 5 — Consolidate & remove duplicates
- One preprocessor · `tps/transliterate`→knowledge · merge marriage renderer · one packet
  endpoint (or justify) · dictionary P2–P5 · delete confirmed-dead (assembler/normalize/marriage) LAST.

### Phase 6 — Operational layer
- Human Review Queue spec · retention policy · ops metrics · canary · incident log · status board.

---

## 4. REQUIRED CONSTITUTION DOCUMENTS (must exist)
- [x] DOCUMENT_SESSION_CONTRACT.md — lifecycle IDs/hashes, reset rules, stale-state prevention
- [x] EVIDENCE_LEDGER_SPEC.md — uploadHash→canonicalHash→reviewSnapshotHash→pdfHash→auditId
- [x] FIELD_CONFIDENCE_AND_CRITICALITY_POLICY.md — split confidence + legal criticality matrix
- [x] PRODUCT_STATUS_AND_LAUNCH_GATES.md — status board + launch gate
- [x] AGENT_WORK_ORDER_PROTOCOL.md — scope/allowed/forbidden/acceptance/stop-conditions
- [x] ADR-016 one recognition brain (PR #44/45)
- [x] RECOGNITION_ENGINES_FULL_INVENTORY.md + NORMATIVE_BASE_INVENTORY.md
- [x] FULL_REPO_INVENTORY + ARCHITECTURE_DEPENDENCY_MAP + DEAD_CODE + PRODUCT_FLOW_MATRIX + RISK_REGISTER (PR #46)

---

## 5. CONTROL TRACKER (the full checklist — every owner recommendation + agent items)
Legend: [x] done&verified · [~] done-but-degraded/unverified · [ ] todo · [B] blocked-on-owner

### Already shipped to prod this cycle
- [x] Review-Gate v2 (name+address+2 checkboxes+signature) — LIVE
- [x] Attestation record built (8 CFR) — code
- [x] Garbage guard (label-as-value `„ Пріз`) — both wizards, LIVE
- [x] Session isolation (Translation draft restore gated on ?paid=1) — LIVE
- [x] Owner mode (Translation + TPS free testing) — LIVE
- [x] Signature image embedded in PDF — LIVE
- [x] No-silent-strip (renderValue) + class guard — LIVE
- [x] Source verifier script (P3) · agent-permissions ADR (P6) · release gate (P10)
- [x] Glossary +5 agencies (ПФУ/КМУ/МОН/МОЗ/Мінрегіон) · glossary P1 dedup
- [x] Booklet orientation auto-rotate (additive) — LIVE [~] needs live rotated-photo proof
- [~] Audit DB persistence — table created + insert works, BUT route continues on failure → **S2**

### Safety (Phase 1)
- [x] S1 Geography no-silent-snap (raw kept, fuzzy → suggestion + review) — **PR #48**; verified by `geographyNoSilentSnap.test.ts` 3/3 (Ярошенець NOT→Тростянець; exact normalizes; unknown→review), full web 2261 pass, tsc 0, guard 0; report `docs/reports/S1_GEOGRAPHY_NO_SILENT_SNAP.md`. Prod-impact: was LIVE in Translation orchestrator + any TPS snapCity reader; now no silent replace. Risk: seed gazetteer ~70 places + UI must show suggestion (UX phase). No unrelated scope.
- [ ] S2 Audit persistence hard-fail (no 200 on DB failure)
- [ ] S3 No-silent-correction for name/patronymic/authority/date/series

### Canonical core (Phase 2–3)
- [ ] CanonicalDocumentResult + CanonicalField types
- [ ] readCanonicalDocument adapter (over strongest reader)
- [ ] Field Confidence Contract (ocr/field_match/normalization/source_match/final; final ≤ weakest)
- [ ] Document-Type Confidence Gate (unknown_page blocks recognized fields; anchor scoring)
- [ ] Provider Disagreement Policy (critical-field disagreement → review_required)
- [ ] Provider Output Quarantine (candidates until gates pass)
- [ ] Source Authority Ranking (MRZ>visual>I-94>EAD>DL>manual; manual only after confirm)
- [ ] Manual Override Contract (source='manual_user_entry', preserves prior + rejected reason)
- [ ] ONE_BRAIN_SHADOW flag + TPS/Translation shadow + parity test + diff report

### Finalization & PDF (Phase 4)
- [ ] Finalization Lock (reviewSnapshotHash; PDF only from frozen snapshot; no re-extraction)
- [ ] Two-Layer PDF Proof (PNG visual + text readback + hash vs snapshot; no [CONFIRM] in signed)
- [ ] Evidence Ledger per final document
- [ ] Product Claim Gate (no "certified/ready" until snapshot+checkboxes+signature+audit+PDF)
- [ ] Release Kill Switches (ONE_BRAIN/GEMINI_VISION/BUREAU_PDF/PAYMENTS/CERTIFIED_OUTPUT)

### Quality, safety, robustness
- [ ] Document Quality Gate (blur/rotation/wrong-page/low-res → ask better photo, no AI spend)
- [ ] Customer-safe failure mode (no evidence→blank; wrong page→ask; conflict→manual; never guess)
- [ ] Unknown-field policy (blank + plain reason to user, exact reason in audit)
- [ ] Adversarial Document Test Matrix (rotated/cropped/blurred/wrong-page/multi-doc/low-light/screenshot)
- [ ] Cross-Document Contradiction Detector (passport vs I-94 vs EAD vs DL → review)
- [ ] Prompt-Injection Defense (OCR text = untrusted data; LLM extract-only, no tools/approve/certify/pay/finalize)
- [ ] Cost Firewall (per-doc provider-call + cost cap; over-budget → manual review/ask photo)
- [ ] Regression Corpus + "every incident → fixture+test before closed"
- [ ] Incident Log (structured, not chat)
- [ ] Canary Production Test post-deploy (healthz sha, owner mode, no-review reject, reset, garbage reject)
- [ ] Legal Copy Freeze + versioned/hash-pinned certification text (change only via ADR)
- [ ] Official Source Version Pinning (url/retrievedAt/hash/effectiveDate/status; amended→needs_review)
- [ ] No-Cross-Product-Memory (no field shared without documentSessionId + fileHash + explicit action)
- [ ] State reset: clear tps:legal-risk:v1 / tps:attest:v1 on new upload; per-documentSessionId
- [ ] Translation wizard Back + Start-over buttons (UX)
- [ ] PII Redaction in logs — CI grep test (passport#/A-number/DOB/address/phone/email/full name → FAIL)
- [ ] Data Minimization (send crop+label, not whole image) + Retention policy
- [ ] Human Review Queue spec (owner, SLA, field checklist, accept/reject, audit)
- [ ] Operational metrics (OCR success, correction rate, rejection rate, disagreement, audit fails, PDF fails, restart rate, cost/doc)
- [ ] Product Status Board (per product+doc-type: ACTIVE/OWNER_TEST_ONLY/FLAGGED_OFF/DRAFT/BLOCKED/DEPRECATED — no "done" without runtime proof)
- [ ] OFFICIAL_RULES_COVERAGE_MATRIX.csv (doc_type×field: source/rule/canGuess/era/renderer/review/fixture/status)
- [ ] Evidence Viewer (internal debug: field→raw→bbox→provider→rotation→confidence→decision→final)
- [ ] Agent Stop Conditions (SHA mismatch / DB fail / no evidence / legal copy changed / source unavailable / owner visual approval → BLOCKED, never "done")

### Owner-gated (cannot close without owner)
- [B] birth_certificate pilot activation — owner visual approval of pilot PNG
- [B] Official URLs: military / diploma / pension; КАТОТТГ byte-verify
- [B] Live rotated-booklet photo to confirm orientation
- [B] Live owner-mode generation to confirm audit DB row

---

## 6. PRIORITY ORDER (agent's recommendation, owner-approved sequencing)
1. S1 Geography no-silent-snap
2. S2 Audit persistence hard-fail
3. S3 No-silent-correction (extend)
4. Translation reset + Back/Start-over UX (cheap, owner-reported)
5. Constitution docs (Document Session Contract, Field Confidence/Criticality, Product Status Board, Agent Work Order, Evidence Ledger spec)
6. Canonical contract (Phase 2) → Shadow parity (Phase 3)
7. Controlled migration (Phase 4) + Finalization Lock + Two-Layer PDF Proof
8. Consolidate duplicates (Phase 5)
9. Operational layer (Phase 6)
10. THEN P2 glossary consolidation

> Rationale: S1/S2/S3 are small PRs with large safety ROI; they de-risk before the
> big unification. P2 glossary is real but NOT a fire — it waits.

---

## 7. HOW TO USE THIS TRACKER
- Each PR: flip the matching `[ ]` to `[x]` (or `[~]` if degraded), with the PR # and
  "verified by" (test/live/owner). Never mark `[x]` without proof per the relevant law.
- An item is only "done" when its acceptance + a regression test + (if user-facing) a
  canary/live proof exist. Unit-green alone is `[~]`, not `[x]`.
- Agent Stop Conditions apply: stop and report BLOCKED rather than writing "done."

### Phase-completion gate (mandatory — owner rule)
No phase may be marked `[x]` unless ALL five hold:
1. A test proves the exact owner-reported failure is blocked.
2. Production-impact status is stated (was it live? affected what? now what?).
3. Remaining risk is written down.
4. No unrelated scope was changed.
5. A report file exists under `docs/reports/`.

Anything missing a condition is `[~]` (degraded/unverified), never `[x]`.
