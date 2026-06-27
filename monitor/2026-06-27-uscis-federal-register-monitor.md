# Messenginfo — USCIS/Federal Register Daily Monitor
**Date:** 2026-06-27
**Sources checked:**
- Federal Register API (DHS/USCIS, last 7 days, 2026-06-20 → 2026-06-27): **FETCH BLOCKED** — see Fetch Errors. Coverage substituted with WebSearch over official .gov domains (less complete than the API sweep).
- USCIS Newsroom (https://www.uscis.gov/newsroom/news-releases): **not directly fetched** (provenance restriction); covered indirectly via WebSearch of uscis.gov.
- USCIS Alerts (https://www.uscis.gov/newsroom/alerts): **not directly fetched**; covered indirectly via WebSearch of uscis.gov.
- DHS News (https://www.dhs.gov/news): **not directly fetched**; covered indirectly via WebSearch.
- Federal Register document 2026-08333 (H.R.1 fees IFR): **FETCH SUCCEEDED** (full text retrieved).

**Relevant items found:** 1 active item with an imminent deadline; 1 monitored-but-out-of-population item noted. **No NEW Ukraine-specific notice published in the 2026-06-20 → 2026-06-27 window was identified** through available sources.

> ⚠ **Confidence note (read this):** The primary mechanism this monitor was designed around — the Federal Register JSON API with a 7-day window — could not be queried in this run due to a tool-level URL restriction (details in Fetch Errors). This briefing therefore relies on web search of official government domains, which can miss notices the API would catch. Treat "no new items" as **"none found,"** not "none exist." A manual API check is recommended (see Recommended action at the bottom).

---

## USCIS Immigration Fees and Related Procedures Required by H.R.1 (One Big Beautiful Bill Act) — Interim Final Rule
**Source:** DHS / U.S. Citizenship and Immigration Services — https://www.federalregister.gov/documents/2026/04/29/2026-08333/uscis-immigration-fees-and-related-procedures-required-by-hr1-reconciliation-bill
**Published:** 2026-04-29
**Effective date:** 2026-05-29 (interim final rule already in effect)
**Public comment deadline:** 2026-06-29 (**2 days from this briefing**)
**Document #:** 2026-08333

### What changed
DHS issued an interim final rule codifying immigration fees and procedures required by the H.R.1 reconciliation statute. It establishes/codifies: the asylum application fee and a new **Annual Asylum Fee** (including consequences of non-payment); a **new Form I-94 fee** (for USCIS purposes applied to Form I-102, Application for Replacement/Initial Nonimmigrant Arrival-Departure Document; the I-94 fee component is listed at **$24**, e.g. a general I-102 filing of $560 + $24 = $584); a defined **validity period for certain types of employment authorization**; and **retention of the Form I-589 filing fee** even when the application is rejected. The rule is already effective; the comment window remains open through 2026-06-29.

### What was known before
No prior status on file in this monitor. The rule was published 2026-04-29 and took effect 2026-05-29; it is logged here because the public comment period closes 2026-06-29, making it operationally current.

### Affected Messenginfo services
- Pricing / fee-range pages — any page citing USCIS filing fees may now be incomplete (new I-94 fee component, asylum fees).
- FAQ — EAD/work-permit section, given the new defined validity period for certain employment authorization categories.
- Any user-facing copy referencing I-94 replacement (I-102) or asylum filing (I-589) costs.

### Recommended action
- Review fee-range copy for I-102 (add the $24 I-94 fee component where relevant) and confirm no fixed prices are stated (per content rules — ranges only).
- Flag the EAD validity-period change for the FAQ owner to verify which categories are affected before editing user copy.
- No legal-advice copy. This is informational only — monitor for the final rule that follows the comment period.

### Risk level
**MEDIUM**
- Fee-related change affecting form-cost copy; comment period closing imminently. Update fee/EAD pages within 1 week; not a user deadline (no individual filing deadline created), so not HIGH.

---

## (Monitored, out of population scope) Lebanon TPS — Federal Register Notice
**Source:** DHS/USCIS — Federal Register Vol. 91, No. 103, 2026-05-29 (doc 2026-10704, via govinfo.gov)
**Published:** 2026-05-29
**Effective date:** not specified in retrieved summary (TPS/EAD validity referenced through 2026-11-27)
**Document #:** 2026-10704

### What changed
Notice addresses TPS procedures for **Lebanon**, including handling of pending Form I-821 and Lebanon-related Form I-765, and EAD issuance valid through 2026-11-27. It touches monitored *forms* (I-821, I-765, EAD) but concerns a **non-Ukrainian population**.

### What was known before
No prior status on file.

### Affected Messenginfo services
No direct Messenginfo service impact identified — Messenginfo's population is Ukrainian/Russian-speaking; Lebanon TPS does not apply. Listed only for form-level transparency.

### Recommended action
No action needed — monitor only. Confirms I-821/I-765 online-filing and EAD-validity mechanics remain active generally, which may inform (not change) Ukraine TPS copy.

### Risk level
**LOW**

---

## Fetch Errors
- **Federal Register API** (`https://www.federalregister.gov/api/v1/articles.json?...publication_date][gte]=2026-06-20...`): **Failed.** Exact error: `URL not in provenance set. web_fetch can only retrieve URLs that appeared in a user message or a prior web_fetch result.` The API endpoint was not reachable in this environment because the fetch tool only permits URLs that previously appeared in search results or messages. This is an environment/tooling limitation, not a Federal Register outage. The agency slugs in the task file were not re-verified this run as a result.
- **USCIS Newsroom** (`https://www.uscis.gov/newsroom/news-releases`): Not fetched directly — same provenance restriction; these pages are also JavaScript-rendered and return a shell to raw fetch. Covered indirectly via WebSearch of uscis.gov.
- **USCIS Alerts** (`https://www.uscis.gov/newsroom/alerts`): Not fetched directly — same as above.
- **DHS News** (`https://www.dhs.gov/news`): Not fetched directly — same as above.
- **Secondary / eCFR** (`https://www.ecfr.gov/recent-changes`): Not queried — primary sources produced at least one relevant item, so the secondary fallback was not triggered.

## No-update statement
Not invoked — one relevant active item (H.R.1 fees IFR, comment deadline 2026-06-29) was found. However, **no new Ukraine-specific Federal Register or USCIS notice was identified in the 2026-06-20 → 2026-06-27 window** via the available (degraded) sources. Because the primary API sweep was blocked, this should be read as "none found," not "none exist."

---

### Operator follow-up (not part of standard format — flagged because it affects reliability)
This monitor's core data source (the Federal Register API) was unreachable this run. To restore full coverage, run the API query manually in a browser:
`https://www.federalregister.gov/api/v1/articles.json?conditions[agencies][]=u-s-citizenship-and-immigration-services&conditions[agencies][]=homeland-security-department&conditions[publication_date][gte]=2026-06-20&per_page=20&order=newest`
and reconcile against this briefing. If this monitor runs in an environment with the same fetch restriction repeatedly, the scheduled task will keep degrading to web-search coverage — that is a systemic gap worth fixing, not a one-off.
