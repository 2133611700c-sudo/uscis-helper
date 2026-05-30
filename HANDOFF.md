# HANDOFF — Session 76f (2026-05-30)

## Session 76f — Tracker: UX (#51) + P2.1 canonical core (#52) (branch `docs/engineering-master-plan`)

Tracker updated: UX wizard reset/Back/Start-over → `[x]` (PR #51); the P2.1 canonical items → `[x]` (PR #52) — CanonicalDocumentResult+CanonicalField types, Field Confidence Contract, Provider Disagreement Policy, Source Authority Ranking. Phase-1 safety (S1+S2+S3) + UX + P2.1 all merged to main. Exact next task: **P2.2 — `readCanonicalDocument` adapter** that maps the strongest existing reader's output (e.g. `TpsExtractedField[]`) into a `CanonicalDocumentResult` using the P2.1 policy (criticality, buildConfidence, decideReviewRequired; never lowers a source module's review flag). Still additive/unwired. Then P2.3 `ONE_BRAIN_SHADOW` parity harness (default OFF).

---

## Session 76d — Tracker: S3 done → Phase-1 safety COMPLETE (branch `docs/engineering-master-plan`)

S3 (name no-silent-recase) shipped as safety PR **#50** off main. Tracker updated: S3 → `[x]` with PR# + evidence; the audit of patronymic/authority/date/series (already-flagged) recorded inline. **All three Phase-1 safety items (S1+S2+S3) are now complete.** Exact next task: UX — Translation wizard reset + explicit Back / Start-over controls (the live-failure follow-up so a user can recover from a bad recognition without the stale-state hazard), then Phase 2 CanonicalDocumentResult + CanonicalField types (contract-first, the path to one recognition brain).

---

## Session 76c — Tracker: S2 done + audit item resolved (branch `docs/engineering-master-plan`)

S2 (audit persistence hard-fail) shipped as safety PR **#49** off main. Tracker updated: S2 → `[x]` with PR# + evidence/risk; the `[~]` "Audit DB persistence" item flipped to `[x]` (resolved). Both Phase-1 safety items S1+S2 now done. Exact next task: **S3 — no-silent-correction** for name / patronymic / authority / date / series (apply the S1 principle: a low-confidence normalization becomes a suggestion + review_required, never a silent replacement). Then UX reset/back-start-over in the Translation wizard, then the CanonicalDocumentResult contract (Phase 2).

---

## Session 76b — Tracker update: S1 done + constitution docs + phase-completion gate (branch `docs/engineering-master-plan`)

S1 (geography no-silent-snap) shipped as its own safety PR **#48** off main. This branch (the tracker, PR #47) is updated to record it: S1 → `[x]` with PR# and full evidence/risk; the 5 constitution docs landed here and flipped to `[x]`; the owner's **phase-completion gate** added to §7 (no `[x]` without test+prod-impact+risk+scope-discipline+report). Exact next task: **S2 — audit persistence hard-fail** (generate-pdf must return non-200/DEGRADED when the order/audit DB write fails, instead of 200).

---

## Session 76 — Engineering Master Plan + tracker (branch `docs/engineering-master-plan`, off main)

Collected all owner recommendations + my critical analysis + the plan into ONE living tracker: `docs/ENGINEERING_MASTER_PLAN.md`. It encodes the THREE LAWS (no evidence→no field; no review snapshot→no PDF; one document→one CanonicalDocumentResult→all products), the target architecture (Document Core → product adapters → review gate → finalization lock → PDF → evidence ledger), phases 0–6, and a full control checklist with status markers ([x] done, [~] degraded, [ ] todo, [B] owner-blocked).

Key agent stance (recorded in the doc): the owner input is senior-grade; my earlier "go B1" was raw and would have created a third brain — the correct path is contract-first + shadow-parity, with small safety PRs (geography no-silent-snap, audit hard-fail) FIRST. Operational layer (review-queue product, retention, dashboards) is sequenced LAST, after canonical+safety.

**Exact next task:** S1 — block silent geography snapping (snapCity fuzzy → suggestion + review_required, keep raw value; exact match still normalizes). Then S2 audit hard-fail. Follow and update the tracker after each PR (flip [ ]→[x]/[~] with PR# + proof). Agent Stop Conditions apply — never mark done without proof.

---

# HANDOFF — Session 71 (2026-05-30)

## Session 71 — Booklet orientation auto-rotate (branch `fix/booklet-orientation`, off main)

The TPS OCR route already rotated 90/180/270 for an international passport whose MRZ was not found, accepting a rotation only if it located an MRZ. An INTERNAL passport booklet has NO MRZ, so rotation never helped it — a rotated booklet matched on garbage and was never re-tried. Extended ADDITIVELY: (1) trigger rotation also when a booklet matched with <2 identity fields; (2) in the rotation loop, track the rotation with the most identity fields (`bookletFieldCount`); (3) after the loop, adopt that rotation if it has strictly more identity fields than the upright read. The passport MRZ path is unchanged (handled first). tsc 0; TPS 370 pass; full web pass; content-guard 0.

**Honest caveat:** cannot verify with a live rotated-booklet image in this env (no upload). The change is additive and only adopts a strictly-better rotation, so it cannot regress the upright/passport paths. Owner should live-repro a rotated booklet to confirm the chosen rotation reads correctly.

**Remaining:** P2–P5 glossary; owner-gated (birth visual approval, official military/diploma/pension URLs + КАТОТТГ byte-verify).
# HANDOFF — Session 70 (2026-05-30)

## Session 70 — Owner mode site-wide (branch `feat/owner-mode-site-wide`, off main)

Closed the owner request: test every product without payment. Inventory: TPS wizard already had owner-bypass; EAD + Re-Parole have no site payment (free); server routes (generate-pdf/render/tps-packet) already honour `isOwnerSession`; owner-login UI exists at `/[locale]/owner` (request-code → verify-code). The ONLY gap was the Translation wizard — it had no owner check and forced Stripe. Fixed: it now fetches `/api/owner/status` on mount, and `handlePayment` skips Stripe → `setScreen(7)` for the owner (the generate-pdf route already bypasses the payment gate for a verified owner cookie). CTA shows "Owner — continue free". `ownerMode.test.ts` 3/3; full web pass; tsc 0; content-guard 0.

**Remaining (honest):** orientation auto-rotate (needs a live rotated fixture to verify — owner to provide or accept blind); P2–P5 glossary consolidation; owner-gated (birth visual approval, official military/diploma/pension URLs + КАТОТТГ byte-verify).

---

