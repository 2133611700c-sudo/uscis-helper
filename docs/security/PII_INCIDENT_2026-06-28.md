# PII Incident — leaked document series in commit `31b62cd` (Workstream I)

**Status:** contained from reachable history; manual GitHub Support action recommended
for guaranteed object purge. Non-blocking for code.

## What was exposed
A code COMMENT in an early Phase-5 commit contained the owner's **real** birth-certificate
series/number (value: `[REDACTED]`). No other PII; no test data; the value sat in a source
comment, not in committed test vectors.

## Timeline
- Introduced: commit `31b62cd` (first Phase-5 commit), branch `translation/ru-and-model-matrix-fixes`.
- Detected: by `scripts/check-no-pii.mjs` (PII guard) immediately after that commit.
- Removed from reachable history: the commit was amended to fictional data (`II-BK 530174`)
  and the branch force-pushed (`--force-with-lease`) to `533af42…`; `31b62cd` is no longer
  reachable from the branch tip.

## Reachability (read-only re-audit, 2026-06-28)
- `git branch -r --contains 31b62cd` → **0 remote branches**.
- `git tag --contains 31b62cd` → none.
- No PR ref / other ref points to it.
- **LEAKED_COMMIT_REACHABLE: NO** via any branch/tag/PR ref.

## Why a direct-SHA copy may persist
GitHub retains unreachable (dangling) commit objects until garbage collection; such an
object can remain accessible by its exact 40-char SHA URL even though no ref points to it.
A force-push/amend does **not** guarantee its removal from GitHub's storage.

## Recommended action (manual, owner)
1. Treat the exposed series/number as compromised where it matters (it is a document
   identifier, not a credential; low practical risk, but owner's call).
2. Request GitHub sensitive-data removal so the dangling object is purged:

> **To: GitHub Support — Sensitive Data Removal**
> Repository: `2133611700c-sudo/uscis-helper`. A commit that is no longer referenced by any
> branch, tag, or PR (SHA `31b62cd0de3bea0acb673f00535f52fb767b385c`) contains sensitive
> personal data (a government document number) in a source-file comment. It was removed from
> reachable history via amend + force-push. Please purge the dangling object / any cached
> views so it is no longer retrievable by direct SHA. The current sensitive value is redacted
> here; I can provide it through a secure channel on request.

No automatic repository-wide history rewrite was performed (would be disruptive and is not
required since the object is unreachable).
