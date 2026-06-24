# Messenginfo — USCIS/Federal Register Daily Monitor
**Date:** 2026-06-24

**Sources checked:**
- Federal Register API (DHS + USCIS, since 2026-06-17): **FETCH FAILED** — see Fetch Errors. Data below gathered via web search of federalregister.gov instead.
- USCIS Newsroom (news-releases): **FETCH FAILED** (index page) — covered via web search of uscis.gov.
- USCIS Alerts: **FETCH FAILED** (index + target page returned empty/JS-rendered) — content recovered via web search of uscis.gov.
- DHS News: **NOT FETCHED** — see Fetch Errors.
- Secondary (eCFR Title 8): not reached this run.

**Relevant items found:** 2 time-sensitive items (1 HIGH-deadline, 1 HIGH-operational). Note: this run could not enumerate the exact 2026-06-17 → 2026-06-24 publication window from the live API; both items below were surfaced via search and verified on official domains. Treat the 7-day completeness as **UNVERIFIED** for this run.

---

## USCIS Immigration Fees and Related Procedures Required by H.R.1 — Interim Final Rule (public comment period closing)
**Source:** Federal Register (DHS) — https://www.federalregister.gov/documents/2026/04/29/2026-08333/uscis-immigration-fees-and-related-procedures-required-by-hr1-reconciliation-bill
**Published:** 2026-04-29
**Effective date:** 2026-05-29 (interim final rule already in effect)
**Document #:** 2026-08333

### What changed
DHS issued an interim final rule codifying immigration fees and procedures required by H.R.1 (One Big Beautiful Bill Act). Per the FR abstract, it codifies asylum fees and the annual asylum fee, the new Form I-94 fee, the validity period for certain types of employment authorization, and retention of the Form I-589 filing fee. The rule is already in effect; the public comment window closes **2026-06-29** (5 days from this briefing).

### What was known before
The H.R.1 fee framework was previously implemented through several 2025 notices (e.g. 2025-13738 on 2025-07-22; parole fee 2025-19564 on 2025-10-16; FY2026 inflation adjustments 2025-20304 and 2025-20622 in Nov 2025). This April 2026 IFR consolidates and codifies those into regulation. Prior status on file: HR-1 raised the initial Form I-821 (TPS) base fee from $50 to $500 with no fee waiver; FY2026 parole fee = $1,020.

### Affected Messenginfo services
- FAQ / TPS section — I-821 fee figures ($500 initial, no fee waiver).
- I-765 / EAD instructions — employment-authorization validity-period language.
- Any user-facing copy referencing fee waivers (I-912) for these categories.
- Pricing/fee-range explainers that cite USCIS filing fees.

### Recommended action
- Confirm Messenginfo's I-821 and I-765 fee/validity copy matches the codified IFR figures; update where stale.
- Internal only: the comment period closes 2026-06-29 — flag to product owner in case Messenginfo wants to track the final rule. No user-facing deadline here.
- Monitor for the final rule.

### Risk level
**MEDIUM** — affects form instructions and fee copy; codifies (does not newly change) figures already live since 2025. Update fee/validity copy within 1 week.

---

## Court Order Vacating EAD Validity / Hold Policies (Dorcas International Institute of RI v. USCIS)
**Source:** USCIS Newsroom — Alerts — https://www.uscis.gov/newsroom/alerts/court-order-on-hold-policies
**Published:** alert reflects court actions of 2026-06-05 (order) and 2026-06-11 (final judgment)
**Effective date:** immediately, agency-wide, upon entry of final judgment 2026-06-11
**Document #:** not a Federal Register document — court order, 26-cv-00132-JJM-PAS (D.R.I.)

### What changed
The U.S. District Court for the District of Rhode Island vacated USCIS policies **PM 602-0192, PM 602-0194, and PA 2025-26**; final judgment was entered 2026-06-11. Per the USCIS alert text, the vacatur applies agency-wide and those policies "should be treated as if they are not in effect." These policies were tied to reduced EAD validity periods and additional screening/vetting holds. USCIS states it disagrees but will comply pending possible appeal.

### What was known before
USCIS had implemented reduced EAD validity periods and hold policies on certain pending applications (linked to H.R.1 and screening/vetting proclamations). Prior status on file: H.R.1 set parole and TPS EADs to the shorter of one year or the end of the authorized period, applied to applications pending or filed on/after 2025-12-05.

### Affected Messenginfo services
- I-765 / EAD instructions and any copy stating EAD validity lengths.
- TPS and Uniting-for-Ukraine pages that describe how long an issued EAD lasts.
- FAQ entries about processing holds / delays on pending applications.

### Recommended action
- Add a dated internal note that PM 602-0192, PM 602-0194 and PA 2025-26 are vacated (as of 2026-06-11) and the situation may change on appeal.
- Avoid publishing fixed EAD-validity claims in user copy until the post-vacatur position stabilizes; describe validity as "as stated on the EAD card."
- Monitor uscis.gov/newsroom/alerts for follow-up (possible stay or appeal).

### Risk level
**HIGH** — directly changes EAD validity treatment for I-765 filers (including TPS/parole categories Messenginfo users rely on), effective immediately and agency-wide. Review user-facing EAD-validity copy now.

---

## Fetch Errors
- **Federal Register API** (`https://www.federalregister.gov/api/v1/articles.json?...gte=2026-06-17...`): could not be fetched. web_fetch returned "URL not in provenance set. web_fetch can only retrieve URLs that appeared in a user message or a prior web_fetch result." The constructed API endpoint is not in the fetch allowlist for this unattended run.
- **USCIS Newsroom / Alerts / DHS News index pages**: same provenance restriction for the index URLs; the one alert page reached (`court-order-on-hold-policies`) returned empty body (client-side/JS-rendered, no text extracted via web_fetch).
- **Browser fallback (Claude in Chrome)**: blocked — two Chrome browsers are connected and selecting one requires the user to choose interactively. This is an unattended scheduled run, so no selection could be made.
- **Mitigation used:** content was gathered via the WebSearch tool restricted to federalregister.gov / uscis.gov / dhs.gov and cross-checked against official-domain URLs. Because of the above, the exact last-7-days (2026-06-17 → 2026-06-24) publication list is **UNVERIFIED** for this run.

## No-update statement
Not applicable — relevant items were found. However, full 7-day completeness could not be verified due to the fetch limitations above.

---

### Operator note (for whoever maintains this monitor)
To make this monitor reliable on autonomous runs, one of these needs fixing: (1) allow the Federal Register API host in web_fetch provenance, or (2) pre-select a single default Chrome browser so the browser fallback works unattended. Until then, this briefing depends on web-search indexing, which lags the live API and cannot guarantee the 7-day window.
