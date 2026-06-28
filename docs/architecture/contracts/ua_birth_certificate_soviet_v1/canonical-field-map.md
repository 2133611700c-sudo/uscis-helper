# Canonical Field Map — `ua_birth_certificate_soviet_v1`

**DESIGN ONLY.** Maps every legacy layer (A read-side, B output-side, C crop, D canonical-core, E PDF/labels, F ground-truth) to the one canonical namespace. Ambiguous mappings are **flagged, never guessed**.

Legend: `✔` proven 1:1 · `⊂` legacy collapses several canonical keys into one (lossy) · `⟂` one legacy key must SPLIT into several canonical keys · `⚠ MAPPING_REQUIRES_DECISION` · `∅` no legacy key yet.

Canonical key shown with its `runtime_key` (flat) in parentheses — see open-decisions #1 for dotted-vs-flat.

---

## A → canonical (read-side: `documentRegistry.ts` DocTypeSpec `ua_birth_certificate`)

| A key | → canonical (runtime_key) | note |
|---|---|---|
| `child_family_name` | `person.child.surname` (family_name) | ✔ |
| `child_given_name` | `person.child.given_name` (given_name) | ✔ |
| `child_patronymic` | `person.child.patronymic` (patronymic) | ✔ |
| `dob` | `event.birth.date` (date_of_birth) | ✔ (already aliased in `KEY_ALIASES`) |
| `place_of_birth_city` | `event.birth.settlement` (+`.settlement_type`,`.district`,`.oblast`,`.republic`) | ⊂ A collapses 4–5 location parts into one — split on ingest |
| `father_full_name` | `person.parent.father.full_name` | ✔ (composite kept) |
| `mother_full_name` | `person.parent.mother.full_name` | ✔ |
| `act_record_number` | `registry.record.number` | ✔ |
| `act_record_date` | `registry.record.date` | ✔ |
| `issuing_authority` | `registry.office.name` **or** `document.issuing_authority` | ⚠ MAPPING_REQUIRES_DECISION (#2) |
| `certificate_series_number` | `document.series` + `document.number` | ⟂ split |
| `date_of_issue` | `document.issue_date` | ✔ |
| ∅ | `event.birth.republic` | ∅ A has no republic field (Soviet-only) — add |
| ∅ | `person.parent.father.nationality` / `.mother.nationality` | ∅ Soviet-only — add |
| ∅ | `person.child.sex` | ∅ derived from patronymic |

## B → canonical (output-side: `birth-certificate.schema.ts` OfficialFormSchema)

| B key | → canonical | note |
|---|---|---|
| `child_surname` | `person.child.surname` | ✔ |
| `child_given_name` | `person.child.given_name` | ✔ |
| `child_patronymic` | `person.child.patronymic` | ✔ |
| `date_of_birth` | `event.birth.date` | ✔ |
| `place_of_birth` | `event.birth.settlement` (+ district/oblast/republic) | ⊂ split |
| `father_full_name` | `person.parent.father.full_name` | ✔ |
| `mother_full_name` | `person.parent.mother.full_name` | ✔ |
| `act_record_number` | `registry.record.number` | ✔ |
| `act_record_date` | `registry.record.date` | ✔ |
| `place_of_registration` | `registry.office.name` | ⚠ MAPPING_REQUIRES_DECISION (#3) — do NOT auto-map to issuing_authority |
| `series_number` | `document.series` + `document.number` | ⟂ split |
| `date_of_issue` | `document.issue_date` | ✔ |

## C → canonical (crop templates: `FIELD_BOX_TEMPLATES`)

| C key | → canonical | note |
|---|---|---|
| `family_name` | `person.child.surname` | ✔ fixed_region box |
| `given_name` | `person.child.given_name` | ✔ |
| `patronymic` | `person.child.patronymic` | ✔ |
| (9 of 12 fields) | — | ∅ no crop; use `anchor_relative` / `deterministic_parser` locator |

> Also fixes the live bug: `HTR_NAME_FIELDS = {family_name, given_name, patronymic}` matches the **runtime_key**, so once A's keys map to these runtime_keys the HTR route receives the fields (today the `child_*` prefix makes the intersection empty).

## D → canonical (canonical-core: `keyAliases.ts` / `knowledgeNormalize.ts`)

`KEY_ALIASES` is the **existing partial namespace**. It already uses the runtime_keys this contract adopts (`family_name`, `given_name`, `patronymic`, `date_of_birth`, `place_of_birth`, `issuing_authority`, `sex`, `document_series`, …). Action: make `KEY_ALIASES` a **generated projection** of this contract's `{canonical_key → runtime_key, aliases_seen}`, not a hand-kept list. `knowledgeNormalize.ts` substring type-routing → replace with the contract's `data_type` per field (no behavior change, removes guessing).

## E → canonical (PDF / review / labels)

| E source | today | → canonical |
|---|---|---|
| `birth-certificate.schema.ts` `sourceLabelEn` | English label for PDF | `fields[].output.english_label` |
| `translationFieldLabels.ts` | English/UK labels for review UI | same `fields[].output.english_label` (collapse the two label maps into one) |
| `renderOfficialTranslation.ts` order via `fieldGroup`/`layoutSections` | PDF order | `fields[].output.section` + `.order` |
| `buildMirrorValues.ts` alias map | extraction-key → B-key | derive from this contract (one alias source, not two) |

## F → canonical (ground-truth: `qa-private/ground-truth/birth_cert_*.json`)

| F key | → canonical (+ value layer) | note |
|---|---|---|
| `family_name_cyrillic` | `person.child.surname` · **raw** | |
| `family_name_latin` | `person.child.surname` · **normalized/translated** | |
| `given_name_cyrillic` / `_latin` | `person.child.given_name` · raw / normalized | |
| `patronymic_cyrillic` / `_latin` | `person.child.patronymic` · raw / normalized | |
| `date_of_birth` | `event.birth.date` | |
| `place_of_birth_raw` / `_english` | `event.birth.settlement` · raw / translated | |
| `province` | `event.birth.oblast` | province == oblast |
| `issuing_authority_raw` / `_english` | `registry.office.name` **or** `document.issuing_authority` | ⚠ same decision (#2/#3) |
| `act_record_number` | `registry.record.number` | |
| `sex` | `person.child.sex` (derived) | |
| `passport_number`, `military_id_number`, `issue_date`, `expiry_date` | **OUT OF CONTRACT** | these are owner cross-doc identity GT, NOT birth-cert fields |

> F demonstrates the value-lifecycle the contract formalizes: `*_cyrillic` = raw, `*_latin`/`*_english` = normalized/translated. The GT files should, post-migration, be keyed by canonical_key with explicit `{raw,normalized,translated,confirmed}` layers.

---

## Ambiguous mappings (carried to `open-decisions.md`, NOT guessed)

1. **`certificate_series_number` / `series_number` → split** — mechanical, low-risk; recommended now (decision #4).
2. **A.`issuing_authority` →** `registry.office.name` vs `document.issuing_authority` (decision #2).
3. **B.`place_of_registration` →** `registry.office.name` (recommended) vs `document.issuing_authority` (decision #3).
4. **Parents' `full_name` composite → keep vs split** into surname/given+patronymic (decision #5).
5. **Dotted canonical_key vs flat runtime_key** as the stored key (decision #1).
