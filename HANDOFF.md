# HANDOFF — Session 75 (2026-05-30)

## Session 75 — Full repository inventory + architecture audit (branch `docs/full-repo-audit`, off main)

Delivered the owner-requested full repo audit (READ-ONLY, no code changes): 6 reports in `docs/reports/` — FULL_REPO_INVENTORY(.md/.csv), ARCHITECTURE_DEPENDENCY_MAP (mermaid: TPS/Translation/OCR-brain/PDF/DB flows), DEAD_CODE_AND_DUPLICATES, PRODUCT_FLOW_MATRIX, RISK_REGISTER_BY_FILE. Built from a file census (1423 tracked files; 47 API routes; 40 pages; 26 migrations; 20 DB tables touched; ~20 storage keys; providers per route) plus two parallel Explore agents (test-reality+dead-code; PDF+state+DB).

**Top critical findings:** (1) TWO recognition stacks (engine/docintel vs tps/*) → divergent fields on the same document (legal); (2) translation_orders + translation_certification_audit insert errors LOGGED but route returns 200 → certified PDF with no audit trail; (3) [CONFIRM] can render into a signed bureau PDF; (4) snapCity threshold 0.34 silently replaces distant places (Ярошенець→Trostianets); (5) stale TPS state (tps:legal-risk:v1 persists cross-document); (6) central_brain_audit table referenced but not in migrations (drift); (7) 5 packet endpoints + 2 legacy OCR endpoints; (8) dead engine/assembler + knowledge/normalize + renderMarriageCertificateTranslation + broken Transkribus.

**Highest-leverage next:** ADR-016 (one brain) removes the top critical + several high/medium at once. Then: block-or-DEGRADE on audit DB failure; reset stale TPS state; dictionary P2; consolidate endpoints. NO deletes until callers proven gone.

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

