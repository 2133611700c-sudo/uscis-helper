# OWNER QUEUE — actions only the owner can do

Items here are blocked on a human (PII, real documents, prod env, billing).
Agents do NOT perform these. Newest first.

## 2026-06-04 — live-door coverage now 4/6; EAD+I-94 need owner inputs

Agent fixed the small coverage blockers (added `ua_military_id` registry type → military_id_p1 scorable, 5/5
correct live; patronymic naming corrected at source, behavior-preserving). **Live-door scorable = 4/6.**

**Owner-only to reach 6/6 (then calibration can use 6 docs):**
1. **Upright real EAD image** → `test-fixtures/real-docs/` (gitignored). Only rotated `ead_rot*` exist now.
2. **Upright real I-94 image** → same. Only `i94_rot*` exist now.
3. **US-doc read-path decision:** the docintel registry is UA-only. Either authorize the agent to add US doc
   types (us_ead / us_i94) to the registry + a US-doc read path, or keep EAD/I-94 out of live-door scoring.
   Until decided, EAD/I-94 raw API reads are NOT product accuracy and stay excluded.

Calibration remains BLOCKED_INSUFFICIENT_N until coverage + more people. Gate canary unchanged
(READY_FOR_OWNER_APPROVED_CANARY; separate command after rollback rehearsal).


## 2026-06-04 — GT=6 verified · accuracy reconciled · gate = READY_FOR_OWNER_APPROVED_CANARY

**Verified by agent from raw (no values printed):**
- GT ready = **6/30** `VERIFIED_BY_OWNER` (soviet 6/6, handwritten 6/6, internal_passport 5/5, military_id_p1 6/6, i94 6/6, ead 6/6). **GT-count blocker CLEARED.**
- BUT live-door-scorable = **3** (2 hard-case birth + internal_passport). `military_id_p1` has **no registry doc type** (`ua_military_id` absent); `ead`/`i94` are **US docs with no upright real image** → not scorable. Owner's "accuracy on 6 docs" is not evidence-backed; real coverage = 3.
- Hard-case = **1/4 correct even on 3.1-pro** → UNRESOLVED_BLOCKER. Mode C drives `false_negative_review`→0 on both. Passport = 3/3 read fields correct (patronymic dropped — coverage gap).
- Calibration = **BLOCKED_INSUFFICIENT_N** (~11 fields can't set numeric thresholds).

**Owner-only — to scale evidence (the real unblock for calibration):**
1. Provide an **upright real EAD and I-94 image** (matching the filled GT) into `test-fixtures/real-docs/` (gitignored) so they become scorable.
2. Add a **`ua_military_id` registry doc type** (or tell agent to) so `military_id_p1` is routable — code task, needs owner OK.
3. Expand GT to **different people** + more UA-printed docs (current N is 1 person).

**Owner-only — enable the anti-fabrication gate (DO NOT run until rollback rehearsal done; agent will NOT run these):**
```
# canary FIRST (preview/slice), observe metrics, only then production:
vercel env add ANTI_FABRICATION_GATE_ENABLED production   # value: 1
vercel env add SELF_CONSISTENCY_GATE_ENABLED  production   # value: 1  (mode C; needs the former)
# redeploy main (NOT a feature branch)
```
**Rollback (must be ready before enabling):**
```
vercel env rm ANTI_FABRICATION_GATE_ENABLED production
vercel env rm SELF_CONSISTENCY_GATE_ENABLED  production
# redeploy main → behavior returns byte-identical (no data migration)
```
**Stop-conditions (hard — rollback/block immediately):**
- ANY critical identity field wrong WITHOUT review (`false_negative_review` > 0 on critical identity) → rollback/block.
- Review-rate spike beyond the agreed ceiling with no safety payoff → pause + retune.
- `SMART_NORMALIZE_ENABLED` stays **OFF** (no gain). Model switch / HTR / L2-WIRE / P2.4-P2.5 = NOT in this scope.

## 2026-06-04 — UA correction + gate canary prep
- Source docs are UKRAINIAN; Russianized output = model error (memory ukrainian-source-language). KMU-55/dict only after correct UA read.
- ANTI_FABRICATION_GATE = READY_FOR_CANARY_PREP (plan: docs/reports/ANTI_FAB_GATE_CANARY_PLAN.md). NOT enabled. Pre-canary gates unmet: GT≥6 + calibration + rollback rehearsal.
- hard-case model = UNRESOLVED_BLOCKER (neither 2.5-flash nor 3.1-pro reads UA hard-case reliably).
- SMART_NORMALIZE = DO_NOT_ENABLE.


## 2026-06-04 — OneBrain target + priorities (see ARCHITECTURE_INVENTORY_VERDICT.md)

Verdict: PASS_AS_TRUTH_INVENTORY / DEGRADED_AS_TARGET_ARCHITECTURE. Current live = 1 Gemini reader +
arbitration + gates (consensus.ts dormant, HTR not live). Target = OneBrain single field-decision center.

Priorities (do NOT build all at once):
- **L0** (done in docs): inventory verdict + status/handoff.
- **L1** ✅ DONE (design): OneBrain `decideField()` contract + design review.
- **L2-SCAFFOLD** ✅ DONE (code, not wired): `oneBrain/decideField.ts` pure module + tests; prod byte-identical.
- **L3** ✅ DONE (docs + GT workflow): GT-language intent DECIDED (value = as-written; normalized = canonical;
  dictionary = hint, never overwrite — `docs/reports/GT_LANGUAGE_INTENT.md`); calibration plan
  (`docs/reports/ONEBRAIN_L3_GT_CALIBRATION_PLAN.md`); 3 new PII-free templates added
  (`docs/templates/ground-truth/{birth_cert_ua_printed,international_passport,id_card}.template.json`).
  **Owner action (the real unblock):** fill a 6–10 doc GT batch across categories (soviet/UA-printed/
  UA-handwritten birth, passport/ID, EAD, I-94) — copy a template into `qa-private/ground-truth/`, fill
  `value` AS-WRITTEN, set `VERIFIED_BY_OWNER` + `owner_verified_fields`. Then agent calibrates thresholds.
- **L2-WIRE** (after L3 calibration): route decideField through readDocument behind flag, shadow-first, prod byte-identical.
- **L2** (agent, behind flags OFF): integrate the proven anti-fabrication/self-consistency gate INTO OneBrain.
- **L3** (owner): expand GT (different people + Ukrainian-language docs); resolve GT-language intent (RU as-written vs UA canonical); rerun accuracy.
- **L4** (later, metrics-gated): second independent reader (true consensus) / HTR / model switch.

Flag decisions (owner-gated to flip): SMART_NORMALIZE = DO_NOT_ENABLE; HTR = DO_NOT_BUILD; model = DO_NOT_SWITCH;
gate = PREPARE_CANARY only (no prod enable without owner approval + rollback).

## 2026-06-04 — current owner-gates (after PR #80 merge)

**DONE (no longer owner-blocked):**
- ✅ Durability: branch pushed → PR #80 → **MERGED** → `prod == main` (origin/main `46a0912`; healthz ok sha `46a0912`).
- ✅ `DOCUMENT_CLASS_METRICS_ENABLED=1` set in Production (metric code now in prod via main).
- ✅ Prod health verified (messenginfo.com ok, latest deploy Ready).

**DONE:**
- ✅ GT filled (VERIFIED_BY_OWNER, 6 identity fields) + accuracy OFF-vs-ON run (see `ACCURACY_OFFON_RESULTS.md`).

**OPEN — owner only:**
1. **Clarify GT language intent:** should ground-truth be "as written on the document" (Russian spelling)
   or "canonical Ukrainian" (Ukrainian spelling)? The test docs are Russian-language; exact-match scoring
   currently counts the RU↔UA given/patronymic spelling difference as "wrong". This changes which per-field
   misses are real errors vs expected transliteration. (No real names quoted here — see GT files.)
2. **Provide more/varied GT** (different people, Ukrainian-language docs). Current evidence = N=2/one-person
   = signal, not a prod-grade verdict.
3. **Flag decisions (after more GT):** `SMART_NORMALIZE_ENABLED` = **DO_NOT_ENABLE** on current evidence
   (no accuracy gain, small UX cost). The evidence-supported safety lever is instead the
   `ANTI_FABRICATION_GATE_ENABLED` (+ optional `SELF_CONSISTENCY_GATE_ENABLED`) — mode C drove
   false_negative_review to 0 in all cells — but enabling it is an owner decision and still wants more GT.
   See `SMART_NORMALIZE_DECISION.md`.
4. Later: PII history sweep before sharing the repo externally (surname/`FU262473`/DOB pervasive in main
   history — Session-54 debt; not a blocker for internal work).

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
