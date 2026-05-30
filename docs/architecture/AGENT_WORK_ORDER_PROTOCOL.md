# AGENT_WORK_ORDER_PROTOCOL.md

**Status:** CONSTITUTION DOC (required by ENGINEERING_MASTER_PLAN.md §4)
**Purpose:** Every agent task starts from a declared work order and ends in a verifiable state — `done` (with evidence) or `BLOCKED` (with reason). Never "done" without proof.
**Companion:** `docs/adr/ADR-AGENT-PERMISSIONS.md` (bounded role surfaces).

---

## 1. Required work-order declaration
Before touching anything, an agent MUST state:

| Field | Meaning |
|---|---|
| `task_id` | Stable id (e.g. `S1-geo-no-snap`); used in PR, CHANGELOG, ledger references. |
| `scope` | One-sentence intent + which phase (master plan §3) it belongs to. |
| `allowed_files` | Explicit globs the task may edit (must fit the role's surface in ADR-AGENT-PERMISSIONS). |
| `forbidden_files` | Explicit globs the task may NOT touch (schemas/glossary/flags/legal copy unless that IS the role). |
| `expected_outputs` | Files/types/tests that will exist after, and the behavior change (or "no behavior change"). |
| `acceptance_tests` | The exact tests/proofs that make this `done` (named test ids + live/canary if user-facing). |
| `stop_conditions` | Which §3 conditions apply; what evidence triggers `BLOCKED`. |

A task whose edits fall outside `allowed_files`, or that needs to touch a `forbidden_files` glob, must STOP and re-scope — not widen silently.

---

## 2. Role binding (from ADR-AGENT-PERMISSIONS)
Each work order names its role; the role fixes `allowed_files` / `forbidden_files`:

| Role | May edit | MUST NOT edit |
|---|---|---|
| SourceResearchAgent | `docs/official-forms/**`, `source-ledger.json`, source verifier | runtime code, schemas, glossary runtime |
| SchemaAgent | `forms/ukraine/schemas/*.schema.ts`, `contract.ts` | renderers, route, glossary, flags |
| MappingAgent | `forms/ukraine/mappings/*.mapping.ts` | schemas, renderers, route |
| GlossaryAgent | `packages/knowledge/.../registry.csv` (+regen) | runtime route, schemas |
| RendererAgent | `pdf/renderValue.ts`, `pdf/templates/**`, `pdf.ts` | schemas, glossary, sources, flags |
| OCRAgent | `lib/engine/**` recognition | route activation, flags, schemas |
| QAAgent | tests, `docs/reports/**` | production code (read-only) |
| **ReleaseManager** | flags / `active=true` / BUREAU_PDF default | (only role that flips production switches) |

Invariants: OCRAgent cannot activate doc types; RendererAgent cannot change schemas; SourceResearchAgent cannot touch runtime; only ReleaseManager flips production switches.

---

## 3. Standard Agent Stop Conditions
On ANY of these, the agent reports **`BLOCKED`** with the trigger + evidence, and does NOT write "done":

| # | Stop condition | Why |
|---|---|---|
| 1 | **Production SHA mismatch** | Local/expected SHA ≠ deployed (`/api/healthz`). Cannot claim live proof. |
| 2 | **DB write fail** (audit/ledger/order) | S2 hard-fail; "complete" would be a lie. |
| 3 | **Field without evidence** | Law 1 violated; a value lacks session/provider/page/bbox/snippet. |
| 4 | **Legal copy changed** | Certification/attestation/disclaimer text would change → requires ADR + owner, not an agent edit. |
| 5 | **Source unavailable** | An official URL/rule cannot be verified or pinned → no template/field without source. |
| 6 | **Owner visual approval required** | Change alters the **signed** PDF or activates a doc type → RendererAgent/ReleaseManager + owner. |

Additional task-specific stop conditions from §1 are appended, not substituted.

---

## 4. Completion contract
A task is `done` ONLY when:
- Edits stayed within `allowed_files`; no `forbidden_files` touched.
- All `acceptance_tests` pass with pasted evidence (test output; for user-facing: canary/live proof).
- No Stop Condition fired (or each that fired was resolved by the correct role/owner, recorded).
- Required doc updates made per CLAUDE.md (HANDOFF/STATUS/CHANGELOG) — outside this protocol's `allowed_files` only when the task is itself a docs task.

Otherwise the outcome is `BLOCKED` (with reason) or `[~] degraded` (works but unverified) — never a bare "done".

---

## 5. Acceptance
- Every agent PR references a `task_id` and a role from §2.
- Edits outside the declared `allowed_files` fail review.
- Any of the six Stop Conditions present in the run yields a `BLOCKED` report, not "done".
