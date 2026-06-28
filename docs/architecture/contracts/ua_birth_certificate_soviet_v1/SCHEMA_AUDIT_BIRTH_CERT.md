# SCHEMA AUDIT — `ua_birth_certificate_soviet_v1`

**Status:** DESIGN PHASE (read-only audit + design). No runtime code changed.
**Date:** 2026-06-27 · **Scope:** ONE document type only (Soviet bilingual birth certificate).
**Method:** 6 read-only inventory agents + 3 research agents + direct Tier-3 inspection of the real scan by Claude.
**Constraint:** no real PII in this file — printed label text is not PII; personal values are placeholders / format patterns only.

> Companion artifacts in this folder:
> `ua_birth_certificate_soviet_v1.contract.design.json` · `canonical-field-map.md` ·
> `normative-source-registry.design.json` · `migration-plan.md` · `open-decisions.md`

---

## 0. Verdict (one line)

There is **no single Document Form Contract**. Field knowledge for the birth certificate is spread
across **six independent layers (A–F)** that use **five different naming schemes**, with **two
partial — and themselves separate — alias bridges** (`KEY_ALIASES`, `buildMirrorValues`). The owner's
hypothesis is **confirmed**. The fix is one canonical namespace that all six layers reference, migrated
behind adapters (see `migration-plan.md`).

---

## 1. The Tier-3 truth: what the real document actually is

Pinned by visual inspection of the real scan (the only authority for a Soviet form — modern law does not describe it):

- **Title:** `СВИДЕТЕЛЬСТВО О РОЖДЕНИИ / СВІДОЦТВО ПРО НАРОДЖЕННЯ` — **bilingual RU+UA** (every printed label stacked in both languages).
- **Era:** **Soviet, pre-1991** — the `республика / республіка` field is filled `УССР` (Ukrainian SSR). This field **does not exist** on the modern KMU-1025 certificate.
- **Fill:** **handwritten cursive**, Russian-language hand; the year is written **both in digits and spelled out** (`цифрами и прописью`).
- **Layout:** two portrait pages in one landscape booklet spread (printed page no. "2" visible). LEFT = child + birth; RIGHT = parents + registration + issuance.
- **Series / number:** `<Roman>-<2 Cyrillic> № <6 digits>` printed bottom-right (format pattern; real value redacted).
- **Marks:** round purple ЗАГС seal (over the signature), a blue rectangular stamp over the left title, a later top-right date stamp, and the registrar's signature.
- **Soviet-only fields present:** `республика`, and parents' `национальність / национальность` (nationality) — both absent on modern certs.
- ⚠ The GT file's `_meta.handwritten` for this scan is `false` — **mislabeled**; the document is plainly handwritten. (Consistent with the standing rule: verify document type **visually**, not by metadata.)

**Template id chosen:** `ua_birth_certificate_soviet_bilingual_v1`, `version_status = observed_not_legally_pinned`, `valid_from/valid_to = unknown`.

---

## 2. The six layers (A–F) and their naming schemes

| | Layer | File(s) | Names it uses for the child surname | Carries |
|---|---|---|---|---|
| **A** | Read-side spec (extraction) | `docintel/documentRegistry.ts` (`DocTypeSpec ua_birth_certificate`) | `child_family_name` | field, label_uk, kind, handwritten, required, vision_anchor |
| **B** | Output-side schema (translation) | `translation/forms/ukraine/schemas/birth-certificate.schema.ts` (`OfficialFormSchema`) | `child_surname` | key, sourceLabelUk/En, fieldGroup, expectedScript, translationRule, lockedEntity, evidenceRequired, layoutSections |
| **C** | Crop / locator templates | `docintel/ensemble/handwrittenFieldRoute.ts` (`FIELD_BOX_TEMPLATES`) | `family_name` | normalized [l,t,r,b] boxes for **3 of 12** fields only |
| **D** | Canonical data model | `canonical/types.ts` + `core/knowledgeNormalize.ts` + `core/keyAliases.ts` | `family_name` (free string) | rawValue/normalizedValue/finalValue/suggestedValue/rawCyrillic, 4-layer confidence, evidence[], reviewReasons |
| **E** | PDF / review output | `translation/pdf/templates/ukraine/renderOfficialTranslation.ts`, `buildMirrorValues.ts`, `translationFieldLabels.ts`, `EvidenceReviewPage.tsx` | (via B keys + extraction aliases) | English label (from B.sourceLabelEn), section/order (B.fieldGroup/layoutSections), review checkboxes |
| **F** | Ground-truth vectors | `qa-private/ground-truth/birth_cert_*.json` (gitignored) | `family_name_cyrillic` (+ `family_name_latin`) | raw vs latin split, `_meta` (document_class, source_script, provenance_tier, owner_verified_fields, candidate_not_verified) |

**Five naming schemes** for one field: `child_family_name` (A) · `child_surname` (B) · `family_name` (C, D) · `family_name_cyrillic`/`_latin` (F). D normalizes A↔B to `family_name`.

---

## 3. The two partial bridges (already in the code — and themselves separate)

1. **`canonical/core/keyAliases.ts` → `KEY_ALIASES`** maps a primary key to aliases, e.g. `date_of_birth: ['dob']`. Non-exhaustive; free strings; unknown keys default `criticality:'low'`.
2. **`translation/pdf/buildMirrorValues.ts`** has its *own* alias map (extraction key → B schema key) for the mirror PDF path.

These are **two different alias maps in two layers** — not one namespace. A unified contract must make *both* derive from a single source (see migration-plan §Phase 4).

---

## 4. Per-property "single source of truth?" table

| Property | Single SoT? | Where it lives today |
|---|---|---|
| document type id | ✅ | `ua_birth_certificate` (A) — but no **template/version** sub-id (Soviet vs modern undistinguished) |
| template version / era | ❌ | nowhere (real form is Soviet; code has only one generic id) |
| page count | ❌ | nowhere |
| orientation contract | ⚠ runtime-only | `documentFieldReader.ts` (content-orient) — not declared per-doc |
| anchors (machine-readable) | ❌ | prose only in `docReadingRules.ts` |
| complete field list | ⚠ **split** | A (12, `child_*`) vs B (12, `child_surname/…`) — different names, no cross-ref |
| required / optional | ⚠ duplicated | A.required and B.evidenceRequired — independently |
| field type (kind) | ⚠ inferred | A.kind exists; D **re-infers** type by key substring (`knowledgeNormalize.ts`) |
| source language rule | ⚠ prose + runtime | `docReadingRules.ts` + script detection; not declarative per field |
| printed/handwritten route | ⚠ split | A.handwritten + B.expectedScript + C presence |
| crop / locator region | ❌ partial | C covers 3/12; no locator **strategy** for the rest |
| raw value | ✅ | D.rawValue / D.rawCyrillic |
| normalized value | ✅ | D.normalizedValue (good model already) |
| translated value | ⚠ | folded into normalized/final; no explicit `translated` layer |
| confirmed value | ✅ | D.finalValue (tri-state, C3-only writer — strong) |
| status (present/unreadable/N-A/not-found) | ❌ explicit; ⚠ implicit | encoded implicitly across rawValue/finalValue/reviewReasons; **no enum** |
| confidence | ✅ | D.FieldConfidence (4 layers) — strong |
| review rule | ⚠ scattered | policy.ts threshold + antiFabrication + ocrFieldSafety + docClassPolicy |
| cross-field validation | ❌ | none (no date-order / office≠birthplace checks) |
| output PDF order / section | ⚠ B-only | B.layoutSections/fieldGroup — and only on the canonical-mirror path |
| output English label | ⚠ multi-source | B.sourceLabelEn (PDF) **and** `translationFieldLabels.ts` (review) — two maps |
| marks (seal/stamp/signature) | ❌ | not modeled (placeholders only) |
| canonical key namespace | ❌ | free strings; two partial alias maps (§3) |

✅ = single SoT · ⚠ = exists but split/implicit · ❌ = missing.

---

## 5. Conflicts that cause real bugs

1. **HTR never fires for the child name fields.** `documentFieldReader.ts` filters `HTR_NAME_FIELDS = {family_name, given_name, patronymic}` against `spec.fields` whose keys are `child_family_name…`. The intersection is **empty** → the handwriting route (ADR-026) can never receive the registry's child fields. (Moot today only because the raxtemur sidecar is not yet wired, but it is a latent wiring bug rooted in the naming split.)
2. **`certificate_series_number` / `series_number` is one field for two values.** The real form has a series (`<Roman>-<2 Cyrillic>`) **and** a number (6 digits). Merged today → cannot validate or render them separately.
3. **`place_of_birth_city` (A) / `place_of_birth` (B) collapse a 4-part location** (settlement + district + oblast + republic) into one string → district/oblast/republic loss (the same class of loss that hit `issuing_authority`).
4. **`issuing_authority` (A) vs `place_of_registration` (B)** are mapped to overlapping-but-not-identical concepts and **not cross-referenced**. On a Soviet cert the registering organ usually *is* the issuing organ, but a re-issue (`ПОВТОРНО`) breaks that — they are semantically distinct and must stay separate keys. **Unresolved → see open-decisions #2/#3.**
5. **`act_record_number` vs certificate number** are routinely confused; `civil_registry_terms.json` itself warns they differ. The namespace must keep `registry.record.number` ≠ `document.number`.
6. **Two English-label maps** (B.sourceLabelEn for PDF, `translationFieldLabels.ts` for review) can drift.
7. **PDF can be built from RAW extraction.** `generate-pdf/route.ts` uses canonical only when `canonical_document_id` resolves and `continuityMode !== 'off'`; otherwise it renders `payload.fields` (raw), bypassing C3/validation. (Confirmed by inv:output-side.)

---

## 6. What already exists and should be *reused*, not rebuilt

- **D is a strong base.** rawValue / normalizedValue / finalValue (tri-state, C3-only) / suggestedValue / rawCyrillic + 4-layer confidence + evidence[] already implement most of the "value lifecycle" the contract needs. The contract adds an **explicit `status` enum** and a **`translated`** layer, and ties keys to one namespace.
- **`registry.csv`** (mandatory `source_url`, `valid_from/valid_until`, `review_rule` ∈ {auto, always_review, historical_lock, keep_type}) + `source-ledger.json` + `NORMATIVE_BASE_INVENTORY.md` already are a **normative/terminology registry with provenance and era-gating**. The contract's normative-source-registry should *point at* this, not duplicate it.
- **Constitution 10 laws** constrain the contract: L1 one reader, L2 one codex, L5 C3 single finalValue writer, L6 never guess critical, L7 controlling Latin wins, L8 source-faithful script. The contract must not violate these (it doesn't — it formalizes them per field).
- **`KEY_ALIASES` + `buildMirrorValues`** are the seed of the adapter layer — Phase 4 makes them derive from the contract instead of being hand-maintained.

---

## 7. World-class comparison (what we adopt)

- **Google Document AI (schema-driven):** schema *is* the contract; reader only fills declared entities; keep **both raw `textAnchor.content` and `normalizedValue`**; typed `dateValue {year,month,day}` (handles partial/old dates); **occurrence vocabulary** `REQUIRED_ONCE / OPTIONAL_ONCE / REQUIRED_MULTIPLE / OPTIONAL_MULTIPLE`; per-field `description` as a free accuracy lever; confidence + HITL threshold = our review gate. **Skip** managed HITL/IAM, money/address protos, schema-tied retraining.
- **OpenAI/Gemini Structured Outputs + JSON Schema:** model **absent ≠ null ≠ ""** — ban `""` as a sentinel; use an explicit **`status` enum** (`present / unreadable / not_applicable / not_found / conflict`) + nullable value; in strict mode every key is required and "optional" = union-with-null, so the enum (not key-absence) must carry meaning; **derive every artifact (API schema, prompt field list, review form, PDF map) from ONE contract**; keep raw/normalized/translated/confirmed separate; derive `needs_review` deterministically, not from the LLM.
- **Normative (UA/Soviet):** KMU-1025 (2010) governs the **modern** blank; MoJ 52/5 (2000) the **modern** registration procedure; DSTU 4163:2020 is generic ORD requisites; **none describe the Soviet form** — it is pinned by the real scan + USSR/republican family-code lineage. See `normative-source-registry.design.json`.

---

## 8. Unknowns / not verified

- Exact pre-2010 modern edition (KMU-1367/2002) applicability — referenced by inv:normative-bases but not used for this Soviet artifact.
- Whether B's `place_of_registration` legally equals A's `issuing_authority` on this template (open decision #2/#3).
- Whether the real scan `birth_cert_soviet_01` and `birth_cert_handwritten_01` are the same booklet or two certs (both share the GT key set; only structural inspection done).
- Full `KEY_ALIASES` and `buildMirrorValues` alias coverage for this doc type (samples read, not exhaustively enumerated).
- raxtemur sidecar hosting decision (blocks wiring HTR at all) — out of scope for this contract.
