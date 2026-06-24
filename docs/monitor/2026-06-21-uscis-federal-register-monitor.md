# Messenginfo — USCIS/Federal Register Daily Monitor
**Date:** 2026-06-21
**Sources checked:**
- Federal Register API (DHS + USCIS, last 7 days) — **FAILED via web_fetch** (provenance block); covered instead via WebSearch fallback on federalregister.gov — SUCCEEDED
- USCIS Newsroom — https://www.uscis.gov/newsroom/news-releases — **FETCH RETURNED EMPTY** (client-rendered page, no text); covered via WebSearch fallback on uscis.gov — SUCCEEDED
- USCIS Alerts — https://www.uscis.gov/newsroom/alerts — **FETCH RETURNED EMPTY** (client-rendered page)
- DHS News — https://www.dhs.gov/news — **FETCH RETURNED EMPTY** (client-rendered page)
- Claude-in-Chrome fallback (for JS-rendered pages) — **NOT CONNECTED** this run

**Relevant items found:** 2 (both recently active; see scope note below)

> **Scope note (read first):** The task requests a strict 7-day window (2026-06-14 → 2026-06-21). My searches found **no DHS/USCIS Federal Register document published inside that exact window**. The two items below were published **June 5, 2026** and **April 29, 2026** — outside the 7-day window — but are surfaced because each carries an **imminent or open deadline** and **direct impact on Messenginfo's parole/TPS users**. The April 29 IFR comment deadline (June 29) falls inside the next 8 days. Because the primary Federal Register API could not be queried directly this run, treat the "nothing new in the 7-day window" conclusion as **likely but not fully verified** — a clean API run is needed to confirm (see Fetch Errors).

---

## Clarification of Discretionary Employment Authorization for Certain Aliens
**Source:** DHS/USCIS — https://www.federalregister.gov/documents/2026/06/05/2026-11285/clarification-of-discretionary-employment-authorization-for-certain-aliens
**Published:** 2026-06-05
**Effective date:** Not specified — this is a Notice of Proposed Rulemaking (not yet in effect)
**Document #:** 2026-11285 (DHS Docket No. USCIS-2026-0067)

### What changed
DHS proposes to limit and clarify eligibility for discretionary employment authorization for aliens paroled into the U.S. under INA 212(d)(5) (urgent humanitarian reasons or significant public benefit), aliens granted deferred action, and aliens under a final order of removal released on an order of supervision. The proposal would require biometrics submission for these EAD applicants (sent to the FBI for criminal-history and identity checks), bar discretionary EAD for certain criminal aliens absent countervailing public interest, and direct USCIS on how to weigh discretionary factors. Written comments are due **on or before August 4, 2026**.

### What was known before
No prior status on file. This is a new proposed rule tightening the discretionary EAD framework that currently covers humanitarian parolees.

### Affected Messenginfo services
- Uniting for Ukraine (U4U) / humanitarian-parole user guidance — parole-based EAD (category c(11)) applicants fall within the rule's scope.
- FAQ — re-parole and EAD eligibility sections.
- Any user-facing copy describing work-permit eligibility for parolees.

### Recommended action
No content change yet — this is a proposal, not law. Monitor for a final rule. Optionally note internally that future U4U parole EADs may require biometrics and face new discretionary limits. Do **not** publish user-facing alarm based on a proposed rule.

### Risk level
**MEDIUM** — affects the user population's future EAD workflow; no immediate user-facing deadline, but track to final rule.

---

## USCIS Immigration Fees and Related Procedures Required by H.R.1 Reconciliation Bill
**Source:** DHS/USCIS — https://www.federalregister.gov/documents/2026/04/29/2026-08333/uscis-immigration-fees-and-related-procedures-required-by-hr1-reconciliation-bill
**Published:** 2026-04-29
**Effective date:** **May 29, 2026 (already in effect).** Comment period closes **June 29, 2026.**
**Document #:** 2026-08333

### What changed
Interim final rule codifying immigration-fee provisions from the One Big Beautiful Bill Act (H.R.1). It codifies the asylum/annual asylum fees, a new Form I-94 fee (applicable to Form I-102 at USCIS), retention of the Form I-589 filing fee on rejection, and a validity-period rule for certain employment authorization — each **initial TPS-based EAD is valid for 1 year or the duration of the alien's TPS, whichever is shorter** — plus an additional fee for an initial TPS EAD application that **may not be waived or reduced**. The rule is already effective; the only open window is public comment through June 29, 2026.

### What was known before
Builds on the H.R.1 fee framework from the July 22, 2025 rule and the Nov 2025 inflation adjustments. This IFR codifies the TPS-EAD validity limit and the non-waivable initial TPS EAD fee specifically.

### Affected Messenginfo services
- Translation / draft-form service — I-765 (EAD) and I-821 (TPS) instruction and fee pages.
- FAQ — TPS renewal and fee-waiver sections (note: the additional initial-TPS-EAD fee is **not waivable**).
- Pricing/fee-range copy that references USCIS filing fees.

### Recommended action
Review I-765/I-821 fee and validity copy for accuracy against the codified rule (1-year-or-duration EAD validity; non-waivable initial TPS EAD fee). Use ranges only, per content rules. The June 29 comment deadline is informational for an internal product brief — no user-facing action required.

### Risk level
**MEDIUM** — affects form-instruction and fee copy already in effect; review within 1 week. (Not HIGH: no program suspension and no new user filing deadline created.)

---

## Operational context (not a new item, but relevant)
- **Ukraine TPS** designation runs through **October 19, 2026** (extension published Jan 17, 2025; Doc 2025-00771). No new Ukraine TPS notice found this run.
- The TPS-Ukraine **EAD auto-extension through April 19, 2026 has now lapsed** (today is June 21, 2026). Users relying on that auto-extension should already hold a newly issued EAD; flag for FAQ accuracy review.

## Fetch Errors
- **Federal Register API** (`.../api/v1/articles.json?...`): web_fetch returned `URL not in provenance set` — the API endpoint could not be called directly this run. Last-7-days coverage was approximated via WebSearch on federalregister.gov. A direct API run is recommended to confirm zero new in-window documents.
- **USCIS Newsroom / USCIS Alerts / DHS News**: web_fetch returned empty body (pages are client-rendered; no text without a JS-capable browser).
- **Claude-in-Chrome** (JS-rendering fallback): `not connected` this run, so the three client-rendered pages could not be re-fetched.

## No-update statement
No DHS/USCIS Federal Register document was confirmed published within the strict 7-day window (2026-06-14 → 2026-06-21). Two recently active items with open/imminent deadlines and direct user impact are reported above. This conclusion is **partially unverified** due to the API fetch failure noted in Fetch Errors.
