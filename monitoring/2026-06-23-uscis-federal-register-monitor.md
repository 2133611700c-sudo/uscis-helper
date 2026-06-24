# Messenginfo — USCIS/Federal Register Daily Monitor
**Date:** 2026-06-23

**Sources checked:**
- Federal Register API (DHS + USCIS, last 7 days) — `https://www.federalregister.gov/api/v1/articles.json?...&publication_date][gte]=2026-06-16` — **FETCH BLOCKED** (sandbox provenance restriction on direct API URL; not retrievable in this unattended run). Worked around via Federal Register domain web search.
- USCIS Newsroom — `https://www.uscis.gov/newsroom/news-releases` — **FETCH RETURNED EMPTY** (JavaScript-rendered page; no content via plain fetch). Worked around via uscis.gov web search.
- USCIS Alerts — `https://www.uscis.gov/newsroom/alerts` — **FETCH RETURNED EMPTY** (JavaScript-rendered page). Worked around via uscis.gov web search.
- DHS News — `https://www.dhs.gov/news` — **FETCH RETURNED EMPTY** (JavaScript-rendered page). Worked around via web search.

**Method note (honest limitation):** This is an unattended scheduled run, so the browser tools (which would render the JS pages and the JSON API) could not be authorized. Findings below come from web search restricted to `federalregister.gov` / `uscis.gov` plus one verified Federal Register document page. Treat the "no new items in the 7-day window" conclusion as *best-effort, not exhaustive* — a manual check of the four live pages is recommended to fully confirm.

**Relevant items found (last 7 days, 2026-06-16 → 2026-06-23):** 0 confirmed new items on monitored topics.
**Relevant active items just outside the window (flagged because directly impactful):** 1 (June 5 EAD NPRM).

---

## Clarification of Discretionary Employment Authorization for Certain Aliens
**Source:** Homeland Security Department (DHS/USCIS), Federal Register — https://www.federalregister.gov/documents/2026/06/05/2026-11285/clarification-of-discretionary-employment-authorization-for-certain-aliens
**Published:** 2026-06-05 (91 FR 34352) — *18 days old; just outside the strict 7-day window but the most recent active rulemaking that directly affects Messenginfo's user base.*
**Effective date:** Not specified (Notice of Proposed Rulemaking — no effective date until/unless finalized).
**Comment deadline:** 2026-08-04 (DHS Docket No. USCIS-2026-0067, via regulations.gov)
**Document #:** 2026-11285

### What changed
DHS proposes to limit and clarify eligibility for discretionary employment authorization for three groups: aliens paroled into the U.S. for urgent humanitarian reasons or significant public benefit, recipients of deferred action, and persons under final orders of removal released on orders of supervision. Per the rule's text, applicants in these categories would need to demonstrate "economic necessity" and meet additional screening conditions to qualify for an EAD. This is a proposed rule open for public comment, not yet in effect.

### What was known before
Humanitarian parolees (including Uniting for Ukraine parolees) have been able to apply for an EAD under category (c)(11) without an economic-necessity test. This NPRM would tighten that standard.

### Affected Messenginfo services
- FAQ / info pages on Uniting for Ukraine (U4U) and re-parole — EAD eligibility section.
- Translation / draft-form guidance for **I-765** (employment authorization) for parolees.
- Any user-facing copy describing how U4U parolees obtain work permits.

### Recommended action
- MEDIUM-term: Add a neutral, informational note to U4U/EAD content that DHS has *proposed* changes to discretionary EAD eligibility (economic-necessity requirement) and that the comment period is open through Aug 4, 2026. Frame as "proposed, not in effect."
- No form-instruction changes yet — this is a proposal. Monitor for a final rule before changing any I-765 guidance.

### Risk level
**MEDIUM** — Directly affects the EAD pathway for U4U parolees, but as a proposed rule it has no immediate user-facing filing impact. Re-check status before/after Aug 4, 2026.

---

## Secondary / watch item — Naturalization filing-fee increase (N-400)
**Source:** Reported as a DHS proposal slated for Federal Register publication on/around 2026-06-23 (N-400 paper fee proposed to rise to ~$1,330 from $760). **[SECONDARY SOURCE]** — surfaced only via law-firm summaries; a matching primary Federal Register/USCIS URL was NOT confirmed in this run.
**Published:** Reported 2026-06-23 — UNVERIFIED against primary source.
**Effective date:** Not specified.
**Document #:** Not specified.

### What changed
Reported proposal to significantly raise naturalization (Form N-400) filing fees.

### Affected Messenginfo services
- No direct impact. **N-400 is outside the monitored form set** (Messenginfo focuses on TPS/parole/EAD: I-765, I-821, I-131, I-912, etc.). Listed only for fee-awareness completeness.

### Recommended action
- No action. Verify against a primary source (Federal Register / USCIS G-1055) on the next attended run before any mention.

### Risk level
**LOW** — Out of scope for current Messenginfo users; unverified.

---

## Fetch Errors
- Federal Register JSON API (`articles.json?...gte]=2026-06-16`): **"URL not in provenance set"** — the sandbox web-fetch tool refused the direct API URL in this unattended run. Not retrievable here.
- `https://www.uscis.gov/newsroom/news-releases`: fetch succeeded but returned **empty body** (client-side/JavaScript-rendered; no static content).
- `https://www.uscis.gov/newsroom/alerts`: fetch succeeded but returned **empty body** (JavaScript-rendered).
- `https://www.dhs.gov/news`: fetch succeeded but returned **empty body** (JavaScript-rendered).

To fully resolve these on the next run, authorize the browser tools (Claude in Chrome) so the JS pages and the JSON API can be loaded directly.

## No-update statement
No official USCIS/Federal Register update **published within the 7-day window (2026-06-16 → 2026-06-23)** was confirmed for the monitored topics in this run. The one materially relevant active item (the June 5 EAD NPRM, comments open through Aug 4, 2026) predates the window and is reported above for awareness. This conclusion is best-effort given the fetch limitations noted in the Method note.
