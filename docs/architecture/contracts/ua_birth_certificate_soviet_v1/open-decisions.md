# Open Decisions — `ua_birth_certificate_soviet_v1`

Only **unresolved architectural decisions** that block finalizing/migrating the contract. Each has my recommendation; none are guessed into the contract. Resolve these before Phase 3 of `migration-plan.md`.

---

### #1 — Stored key: dotted `canonical_key` vs flat `runtime_key` (BLOCKING)
The contract uses dotted keys (`person.child.surname`) as the human source-of-truth. The runtime canonical layer (`CanonicalField.key`, `KEY_ALIASES`, `knowledgeNormalize` substring routing, `buildMirrorValues`) uses **flat** keys (`family_name`).
- **Recommendation:** keep **flat `runtime_key` as the stored key** and treat dotted `canonical_key` as a documentation/projection layer (1:1). Avoids renaming the entire canonical core; gives one namespace now. Revisit a true dotted migration only if a second/third doc family proves it pays off.
- **Cost of the alternative (full dotted rename):** touches every canonical consumer, the substring type-router, all tests, PDF, review UI simultaneously — exactly the big-bang the owner warned against.

### #2 — A.`issuing_authority` → `registry.office.name` or `document.issuing_authority`?
A single read-side field; two distinct canonical concepts on a Soviet cert (organ that *registered* the act vs organ that *issued* this copy).
- **Recommendation:** map A.`issuing_authority` → **`registry.office.name`** (A's prompt derives it from the registration block), and populate `document.issuing_authority` separately from the signature/seal block. Needs confirmation against A's actual prompt wording before wiring.
- **Until decided:** absent from `legacyReadKeyMap` (fail-loud).

### #3 — B.`place_of_registration` → `registry.office.name` (confirm)
- **Recommendation:** `registry.office.name`. Do **not** auto-map to `document.issuing_authority`. Risk: a re-issued (`ПОВТОРНО`) certificate's issuing organ ≠ original registering organ — keep the two canonical keys separate so a re-issue is representable.

### #4 — Split `series_number` / `certificate_series_number` → `document.series` + `document.number`
- **Recommendation:** **yes, split** (Phase 5). Mechanical and low-risk; the real form prints them as distinct (`<Roman>-<2 Cyrillic>` + 6 digits) and `docNumberFormats.ts` already models the format. Keep the combined field populated during transition.

### #5 — Parents' `full_name`: keep composite or split into surname / given+patronymic?
- **Recommendation:** **keep composite** for v1 (matches A/B, lowest migration risk). Record observed sub-structure as a `_future_split` note. Split only if a downstream form (e.g. an I-130/affidavit) needs parent surname separately.

### #6 — `person.child.sex`: derived field placement
The Soviet form has **no printed sex field**; sex is derived from the patronymic.
- **Recommendation:** keep `person.child.sex` in the contract with `locator: not_applicable`, `reader_route: deterministic_parser`, derived from patronymic; review only if the patronymic itself is in review. (Confirms the standing "sex MISS" item — it's a derivation, not a read.)

### #7 — Where do GT files (F) get re-keyed?
F currently mixes birth-cert fields with owner cross-doc identity fields (`passport_number`, `military_id_number`) in one file.
- **Recommendation:** post-migration, split GT into a per-document birth-cert GT keyed by `canonical_key` with `{raw,normalized,translated,confirmed}` layers; keep the cross-doc identity vector as a separate owner-level file. Out of scope for the contract itself; flagged so the GT harness aligns later.

### #8 — Template id naming & multi-variant
Chosen `ua_birth_certificate_soviet_bilingual_v1`. RU-only Soviet and modern KMU-1025 variants exist but are **not** modeled.
- **Recommendation:** accept the id; add sibling contracts only when a real scan of each variant exists (never model a variant from law alone).

---

## Acceptance-gate self-check (per the task's gate)
| Condition | Met? |
|---|---|
| one canonical key per semantic field | ✅ |
| A/B/C/E mappings explicit | ✅ (with #2/#3 flagged, not guessed) |
| ambiguous mappings not guessed | ✅ |
| normative claims have sources | ✅ |
| modern rules not applied to Soviet form | ✅ (scope_era separation) |
| raw/normalized/translated/confirmed separated | ✅ |
| location strategy for every field | ✅ |
| review policy for every critical field | ✅ |
| PDF mapping for every output field | ✅ |
| missing/unreadable/not-applicable distinct | ✅ (status enum) |
| stamps/signatures own model | ✅ (marks[]) |
| migration without breaking runtime | ✅ (adapters-first, flag-gated) |

**Overall: design is internally complete and consistent, BUT 8 open decisions (esp. #1/#2/#3) must be resolved before runtime migration → STATUS: PARTIAL** (correct per stop-rule "do not declare the contract production-ready").
