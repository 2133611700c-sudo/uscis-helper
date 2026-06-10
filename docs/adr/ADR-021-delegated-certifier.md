# ADR-021 — Delegated Certifier Role & `certifier_override` Authority

Date: 2026-06-10
Status: **DRAFT v1-minimum — OWNER RULING PENDING on Q1–Q3 below.** Agent drafted concrete phrasings (owner's stated recommendation baked in) so the owner rules on specific text, not from scratch. No `certifier_override` code is written until these three are ruled.
Related: ONE_BRAIN_CYRILLIC_CONSTITUTION LAW 2#5 (tiered authority, RULED 2026-06-10), ADR-019 (audit persistence), CRITICAL_FIELDS_CONTRACT, C3_USER_CORRECTION_CONTRACT

## Context

LAW 2#5 (RULED 2026-06-10) made user-confirmation authority tiered by criticality:
non-critical → `user_confirmed` may finalize; **critical identity → `certifier_override` required** (the certifier
attests reading from the source, not the applicant). The certifier role is **owner-only transitional** — a launch
mechanism, not permanent architecture (a throughput bottleneck at scale). Before the `certifier_override` code is
written, three assumptions must be fixed, or the code will be rewritten when this ADR lands. This is that ADR, at
v1-minimum: three answers + the audit schema, so the code is written ONCE.

## Decisions (DRAFT — owner rules each)

### Q1 — SCOPE: which fields require `certifier_override` (not user-alone)?
**Proposed:** the critical-identity set from CRITICAL_FIELDS_CONTRACT, per document class. Concretely, `certifier_override`
is required to finalize an otherwise-null/candidate value on:
- applicant: surname, given name, patronymic, DOB, sex, nationality, document number;
- **relatives/parents/spouses** (see Q3);
- validity-defining dates (issue/expiry/marriage/registration) and issuing authority.
Non-critical (issuing office text, secondary witness, registration office name) → `user_confirmed` finalizes per LAW 2#5.

### Q2 — REASON CODES: enum or free text?
**Proposed: ENUM (closed), with one escape hatch.** Free text alone is unauditable.
`reason_code ∈ { source_verified, user_clarified, dual_witness, other_with_text }`
- `source_verified` — certifier read the value directly from the source document.
- `user_clarified` — user supplied it and certifier accepts it as plausible (non-critical only by default).
- `dual_witness` — two independent reads agree.
- `other_with_text` — requires a mandatory free-text note (the only path that allows prose).

### Q3 — PARENTS/SPOUSES: critical (certifier_override) or user_confirmed?
**Proposed (owner's stated recommendation 2026-06-10): CRITICAL → requires `certifier_override`,** because USCIS
cross-validates parent names across birth-cert ↔ later name-change/marriage docs of the same applicant, and a mismatch
is an automatic fraud red flag — the same risk category as a silent identity substitution. BUT with a **lower-friction
path**: the certifier sees the source document side-by-side with the field and confirms single-click (`source_verified`),
no written reason required. Not user self-attestation; not per-field owner email.

## Audit hook (LOCKED — written from commit 1, per owner point 4)

Every `certifier_override` MUST emit exactly this record from the first commit (destination may be a log file until
ADR-019 persistence lands, but the SCHEMA and HOOK ship with commit 1 — no retrofit into a half-built audit):

```
reason_code        // enum: source_verified | user_clarified | dual_witness | other_with_text
field_name
previous_value     // null | candidate
new_value
certifier_id       // owner_id transitionally
timestamp_utc
session_id
linked_pdf_doc_id  // if applicable
immutable_marker
```

Anchor rule (from LAW 2#5): a cross-document anchor (MRZ/EAD) ALWAYS overrides `user_confirmed` on critical identity;
a `user_confirmed` ↔ anchor conflict → **block + escalate**, never override (passport SERHII vs user OLEKSANDR → block).

## Consequences

- `certifier_override` code (L0) is unblocked ONLY after Q1–Q3 are ruled; until then it is blocked by design.
- Owner-only certifier is transitional; a delegated certifier role (multi-operator, tiered authority, identity on the
  certification line) is a FUTURE extension of this ADR, not v1.
- The audit schema is frozen now so the hook is correct from commit 1 even before ADR-019 persistence exists.
