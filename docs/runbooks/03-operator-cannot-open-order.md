# Runbook 3 — Operator cannot open order

## Symptoms
- Operator gets 401/403 opening `/admin/manual-review/[id]` or invoking a V2 action.
- Alert 10 (operator_auth_denied spike) or alert 4 (queue age) elevated.

## Safe diagnosis (PII-free)
1. `operator_auth_denied_total{status_code}` — 401 = missing/wrong cookie; 403 = no secret
   configured (fail-closed) or not-an-operator.
2. Confirm `requireTranslationOperator()` is the FIRST call in the action (it is, by design).

## Steps
1. 403 with no auth attempt → `ADMIN_SECRET` not configured. Fail-closed is correct; set the
   secret in the environment. Never disable the check.
2. 401 → operator's `admin_session` cookie missing/expired. Re-authenticate.
3. Order opens but version conflicts on save → stale tab. Reload to fetch the current
   `version` (optimistic concurrency; `ORDER_VERSION_CONFLICT`). This is expected, not a bug.
4. Order stuck → check its `status`. If `needs_user_clarification`, it is waiting on the
   customer, not the operator.

## NEVER
- NEVER remove or weaken `requireTranslationOperator()` to "unblock" an operator.
- NEVER mutate `version`/`status` directly to escape a conflict — reload and retry.
