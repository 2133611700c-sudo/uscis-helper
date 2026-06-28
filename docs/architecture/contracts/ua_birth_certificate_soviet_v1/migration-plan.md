# Migration Plan — adopt `ua_birth_certificate_soviet_v1` contract behind adapters

**DESIGN ONLY. No code in this plan has been executed.** Principle: **adapters first, no big-bang rename, one document type, byte-identical until a flag flips.** Every phase is independently shippable and reversible. Respects Constitution L1/L2/L5/L6/L7/L8 and the flag-gated safe-change discipline (L10).

The contract ships as **design** first; runtime adoption only begins after the owner resolves the open decisions (esp. #1 dotted-vs-flat) — see `open-decisions.md`.

---

## Phase 0 — Freeze & baseline (no behavior change)
- Land the 6 design artifacts (this folder). Add one line to `docs/architecture/RULES_MASTER_INDEX.md` pointing here.
- Capture a golden snapshot: current birth-cert extraction → canonical → PDF for the real scan (gitignored qa-private), so later phases prove byte-identity.
- **Exit:** artifacts reviewed; baseline recorded. **Rollback:** delete docs (zero runtime impact).

## Phase 1 — Contract as a typed module, consumed by NOTHING yet
- Add `birthCertSovietV1Contract.ts` (a typed object mirroring the design JSON) under `apps/web/src/lib/contracts/` (new dir). Export the field list + `canonical_key ↔ runtime_key` table + `data_type` + locator/reader/review/output metadata.
- Pure data + types; no other file imports it. `tsc` clean, full suite unchanged.
- **Exit:** module compiles, 0 importers. **Rollback:** delete file.

## Phase 2 — Adapters (legacy keys → canonical), pure functions, off the hot path
Add three pure adapter maps derived from the contract (NOT hand-kept):
- `legacyReadKeyMap`  (A `documentRegistry` key → runtime_key)
- `legacyOutputKeyMap` (B schema key → runtime_key)
- `legacyCropKeyMap` / `legacyGtKeyMap` (C, F → runtime_key)

Reconcile with the **existing** `KEY_ALIASES` (`canonical/core/keyAliases.ts`) and `buildMirrorValues` alias map — assert (in a test) they agree with the contract; do not yet replace them.
- Ambiguous entries (#2/#3) are **absent** from the maps until decided (fail-loud, never guess).
- **Exit:** adapter unit tests green; production code still uses old maps. **Rollback:** delete adapters.

> **STATUS 2026-06-27 — Phases 0–2 DONE.** Phase 0/1: contract landed as a typed module
> (`apps/web/src/lib/contracts/birthCertSovietV1Contract.ts`) consumed by nothing + golden baseline;
> decisions #1 (flat runtimeKey) and #2/#3/#4 baked in (verified against live `buildMirrorValues`:
> `issuing_authority→place_of_registration`, `certificate_series_number→series_number`). Phase 2:
> reconciliation test (`__tests__/birthCertSovietV1Reconcile.test.ts`) asserts the contract does not
> contradict the **second** alias island `KEY_ALIASES` (D), covers the crop layer `FIELD_BOX_TEMPLATES`
> (C), and **pins the latent HTR empty-intersection bug** (audit conflict #1: A `child_*` keys never
> match `HTR_NAME_FIELDS={family_name,given_name,patronymic}` → HTR never fires; the contract bridges it).
> 21 contract tests green, tsc 0, no runtime change.
>
> **STATUS 2026-06-27 — Phase 3 DONE + parity-verified.** `buildMirrorValues.resolveAliases()` and
> `keyAliases.resolveKeyAliases()` are flag-gated (`UNIFIED_DOC_CONTRACT_ENABLED`, default OFF = legacy
> literals byte-identical); flag ON sources the birth-cert maps from the contract
> (`birthCertMirrorAliases()` / `birthCertContractKeyAliases()`). `phase3ContractRuntimeParity.test.ts`
> proves flag ON == OFF (mirror map deep-equals legacy `ALIASES`; `buildMirrorValues`/`collectMirrorExtras`
> identical OFF vs ON on a fictional fixture; `resolveKeyAliases(ON)===OFF`; contribution is a strict subset).
> 633 tests green, tsc 0. The two alias islands now collapse to one source with zero behavior change.
> **Next: Phase 4 (single English-label + order source) — and the owner may flip the flag once Phase 4
> lands, since parity is proven.** Not committed/pushed (push auto-deploys; flag stays OFF).

## Phase 3 — Make `KEY_ALIASES` + `buildMirrorValues` DERIVE from the contract
- Replace the two hand-maintained alias maps with projections of the contract (single source). Behavior must be **byte-identical** (golden snapshot from Phase 0).
- This collapses the two alias islands into one without renaming any stored key.
- **Exit:** snapshot byte-identical; suite green; `tsc` 0. **Rollback:** revert to literal maps (kept behind a flag for one release).

## Phase 4 — Single English-label + order source
- Point `renderOfficialTranslation.ts` and the review UI (`EvidenceReviewPage.tsx` / `translationFieldLabels.ts`) at `contract.fields[].output` for label/section/order.
- Verify PDF + review render byte-identical to baseline.
- **Exit:** one label source; snapshot identical. **Rollback:** flag back to old label maps.

> **STATUS 2026-06-27 — Phase 4 DONE + byte-identity-verified.** The contract now carries `reviewLabelUk`
> per birth-cert field (the wizard's independent Ukrainian map `UKR_LABEL_BY_FIELD` folds in). `ukrLabelFor`
> (review UI) and `renderOfficialTranslation` (PDF English label) are flag-gated (`UNIFIED_DOC_CONTRACT_ENABLED`,
> default OFF byte-identical); flag ON sources labels from the contract via `birthCertReviewLabels()` /
> `fieldByOutputKey().englishLabel`. Order/section still come from `schema.fields`/`fieldGroup` (the contract's
> englishLabel/section is locked == schema). `phase4ContractLabelParity.test.ts` proves: contract reviewLabelUk
> == legacy UK map; contract englishLabel == schema sourceLabelEn; `ukrLabelFor` ON==OFF for every key; and the
> **rendered birth-cert mirror PDF is byte-for-byte identical OFF vs ON** (`Buffer.compare === 0`). 80 contract+pdf
> tests green; full suite 4747 green; tsc 0. **Next: Phase 5 (split merged fields — series/number, place parts —
> additive/opt-in).** Not committed/pushed (push auto-deploys; flag stays OFF).

## Phase 5 — Split the merged fields (additive, opt-in)
- `certificate_series_number` / `series_number` → `document.series` + `document.number` (decision #4).
- `place_of_birth_*` → settlement + settlement_type + district + oblast + republic (additive: keep the combined field populated too until consumers move).
- New keys are OPTIONAL_*; absence does not break existing consumers.
- **Exit:** new keys populate; old combined keys still present; consumers unchanged. **Rollback:** stop populating new keys.

## Phase 6 — Explicit `status` enum + `translated` layer on CanonicalField
- Add `status ∈ {present,unreadable,not_applicable,not_found,conflict}` and a `translated` value layer, **derived** from existing rawValue/finalValue/reviewReasons (no new reader calls — cost-efficiency-first).
- `needs_review` becomes deterministically derived from status + confidence + review_policy.
- **Exit:** status present on all birth-cert fields; review decisions unchanged vs baseline. **Rollback:** ignore status field (additive).

## Phase 7 — Soviet-only fields + marks
- Add `event.birth.republic`, `person.parent.*.nationality` (scope_era=soviet) and the `marks[]` model (seal/stamp/signature, described not transcribed).
- Gate behind `scope_era` so modern certs mark them `not_applicable`.
- **Exit:** Soviet fields/marks extracted + reviewed; modern path unaffected.

## Phase 8 — Cross-field validation (review-only, never autofix)
- Wire `cross_field_validation[]` (date order, record≠doc number, series/number split, office≠birthplace, sex↔patronymic, digits↔words). Severity → review flags only. `autofix=false` everywhere.
- **Exit:** violations raise review, never mutate values.

## Phase 9 — PDF only from confirmed canonical (close the raw-bypass)
- Remove the raw-extraction fallback in `generate-pdf/route.ts` for this doc type: require confirmed canonical; if absent, block with a clear "review required" state instead of rendering raw.
- **Exit:** no raw→PDF path for birth cert. **Rollback:** flag re-enables fallback.

## Phase 10 — Fix the HTR field-name bug (when sidecar lands)
- With keys unified on runtime_key, `HTR_NAME_FIELDS` matches → the handwriting route receives child name fields. Verify against cross-hand harness. (Blocked on raxtemur sidecar hosting — out of this contract's scope.)

---

## Rollback strategy (global)
Each phase is flag-gated and additive; the prior phase's behavior is the fallback. The Phase-0 golden snapshot is the byte-identity oracle for Phases 3–4. No phase renames a stored canonical key (the dotted `canonical_key` stays a documentation/projection layer over the flat `runtime_key` unless decision #1 says otherwise).

## What this plan deliberately does NOT do
- No mass rename of `child_*`/`*_surname` across the codebase (risk #1 in the owner's brief).
- No new OCR models, no HTR retraining, no PDF redesign, no expansion to other doc families.
- No declaring the contract "production-ready" — it is a design until the open decisions are resolved and Phases 3–4 prove byte-identity on the real scan.
