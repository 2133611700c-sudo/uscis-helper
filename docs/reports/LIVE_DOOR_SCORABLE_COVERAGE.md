# Live-Door Scorable Coverage (sanitized; no PII values)

**Date:** 2026-06-04. "Live-door scorable" = a GT doc that can be run through the real
`readDocument` (registry → vision → arbitration) path the product uses — NOT a raw model API call.
**Rule (binding):** a raw model call is NOT product accuracy. Only the live-door path counts.

## Why GT-ready ≠ scorable
6 GT files are `VERIFIED_BY_OWNER`, but a doc is only scorable if (a) it has a registry doc type that
`readDocument` accepts, and (b) a real upright image exists. Three of the six failed one of those.

## Coverage change this session

| GT doc | before | after | how |
|---|---|---|---|
| birth_cert_soviet | ✅ scorable | ✅ | `ua_birth_certificate` + real image |
| birth_cert_handwritten | ✅ scorable | ✅ | `ua_birth_certificate` + real image |
| internal_passport | ✅ scorable | ✅ | `ua_internal_passport_booklet` + real image |
| **military_id_p1** | ❌ no registry type | ✅ **scorable** | **added `ua_military_id` registry type** |
| ead_owner_fill | ❌ US doc / no image | ❌ **BLOCKED** | US doc; no UA-reader path; no upright real image |
| i94_owner_fill | ❌ US doc / no image | ❌ **BLOCKED** | US doc; no UA-reader path; no upright real image |

**Live-door scorable: 3 → 4 of 6.**

## What changed in code (no prod flags, no deploy; behavior-preserving)

1. **New registry type `ua_military_id`** (`documentRegistry.ts`) — identity-page civil fields only
   (family_name, given_name, patronymic, dob, doc_number). No `sex` field: there is no `sex` FieldKind
   in the reader contract, so sex stays unscored for this type (documented limitation, not a wrong value).
   Inert for prod: no current caller passes `ua_military_id` to `readDocument` (TPS military still uses its
   regex module); this only enables the scorable path + future routing.
2. **Patronymic naming fix** — source field for «По батькові» renamed `middle_name` → `patronymic` on
   `ua_internal_passport_booklet` and `ua_id_card` (birth cert already used `child_patronymic`). This
   enforces the CLAUDE.md hard-rule (Patronymic ≠ Middle Name) at the source layer. The USCIS **form**
   field stays `middle_name` (TPSAnswers.middle_name) — that is a real I-765/I-821/I-131 field; the
   source→form mapping bridges patronymic → the form's Middle Name box.
3. **Backward-compat (no regression):** every consumer accepts `patronymic` with a `middle_name` fallback —
   `documentContracts` allow-list, `postExtractNormalize` guard, `translationBridge`/`translationExtractor`
   getters (`get('patronymic') || get('middle_name')`). `eadAdapter`/`reParoleAdapter` already aliased
   `['patronymic','middle_name_cyrillic']`; gates (`selfConsistency`, `antiFabricationGate`,
   `patronymicReconcile`) already list both. Full suite: 2851 passed / 4 skipped, 0 type errors.

## Live proof (flags OFF, gemini-3.1-pro; raw → qa-private, no PII)

- **`ua_military_id`** (military_id_p1): **5/5 scored fields correct** (family/given/patronymic/dob/doc_number
  all match). Routes through the live door for the first time. The model read the printed identity page cleanly.
- **`ua_internal_passport_booklet`** (re-check): patronymic field is now correctly named `patronymic`, but on
  this image the model **still returns no patronymic value** (`not_read`). So the passport patronymic gap is a
  **vision/image limitation, not a naming bug** — the rename was the right correctness fix but does not, by
  itself, make the model read «По батькові» on this booklet. family/given/dob = 3/3 correct (unchanged).

## Still BLOCKED — exact missing inputs (owner-only)

- **EAD + I-94**: the docintel registry is **UA-only** (no US doc types) and there is **no upright real
  image** (only rotated `*_rot*` variants in qa-shots/private). To make these scorable: (1) place an upright
  real EAD and I-94 image into `test-fixtures/real-docs/` (gitignored), AND (2) decide a US-doc read path
  (add US doc types to the registry, or an explicit US-doc reader). Until then they are NOT product-scorable
  and their raw API reads must NOT be counted as product accuracy.

## Net
- Coverage 3 → 4 of 6. Military now scores 5/5 on the live door.
- Patronymic naming corrected at the source layer, behavior-preserving.
- EAD/I-94 remain BLOCKED on owner-supplied upright fixtures + a US-doc read-path decision.
- No flags enabled, no prod env change, no deploy, no model switch, no SMART/HTR/L2-WIRE.
