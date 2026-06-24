# Cyrillic Recognition — Consolidated Honest Problem Report (2026-06-22)

Single source of all Cyrillic-recognition problems. Consolidates the prior audits
(OCR_PROVIDER_BENCHMARK_PLAN, UKRAINIAN_OCR_FAILURE_ANALYSIS, HANDWRITTEN_CYRILLIC_PROBE,
FAILED_CYRILLIC_GROUND_TRUTH_ADJUDICATION, RECOGNITION_ROADMAP, 2026-06-22 root-cause
synthesis) + LIVE tests this session on the owner's real documents. No spin.

---

## 0. The one-paragraph truth
Printed Cyrillic is largely solved (60–90%). Handwritten NAMES read well (~11/12 stable).
The hard, unsolved problems are: **handwritten DATES** (systematically misread), **the
model Russianizing Ukrainian text** on Soviet docs, **occasional wrong-person fabrication**
by weaker models, and **a stack of infrastructure/account blockers** (4MB downscale, RPM
throttling, Google Cloud billing OFF). No OCR provider on earth hits 100% on faded
handwritten Cyrillic — the honest target is **50–80% auto-fill + mandatory review** on
hard docs, **90%+** on printed.

---

## A. READ-QUALITY PROBLEMS (the OCR itself)

### A1. Handwritten DATES — systematic failure (THE #1 read problem)
- **Evidence (HANDWRITTEN_CYRILLIC_PROBE):** dates 0/3 on both birth certs, stable.
- **Failure mode:** the model misreads the handwritten **month word** (one Ukrainian/Russian
  month read as an adjacent one — июня→июля) AND a **day digit** (25→26/28), and sometimes
  **copies one date into BOTH date-of-birth and date-of-issue** slots.
- **Live this session:** Soviet cert DOB read as "26 июля"/"28 июля"; truth 25 июня. Even a
  high-res region crop read it 3 different ways (07-25 / 06-22 / 26-07). **Genuine ceiling.**
- **Status:** the date-region read (zoom-crop + re-read) was DEAD (3 bugs) — FIXED this session
  (fast box model + Gemini crop read + plain-text parse). It now runs, but this specific faded
  date is still ambiguous → correctly held for review (never auto-delivered wrong).

### A2. Russianization of Ukrainian text (names on Soviet/bilingual docs)
- **Evidence (UKRAINIAN_OCR_FAILURE_ANALYSIS — "Core finding"):** the model does not read the
  Ukrainian — it returns the Russian form (Андрій→Андрей, Андрійович→Тимофеевич, Солов'як→
  Соловьяк). This is an OCR/vision/language error UPSTREAM; a dictionary can flag it but must
  NOT silently "fix" it (that would be fabrication).
- **Live this session:** confirmed — birth-cert names came back Russian. Open question (owner,
  factual): is the SOURCE doc actually Russian (then the read is correct + GT is wrong) or
  Ukrainian (then it's a misread)? Currently flagged as RU/UA script-variant, not penalized.

### A3. Handwritten PATRONYMIC — weak
- **Evidence:** probe patronymic 0/3 on the handwritten booklet ("Yovych" instead of the full
  patronymic). Live: booklet patronymic returned null (MISS).
- **Mitigation built:** reconstruct the patronymic from the father's given name (dictionary
  engine) — behind DICTIONARY_AUTOCORRECT_ENABLED.

### A4. Wrong-PERSON fabrication by weaker models (dangerous)
- **Evidence (FAILED_CYRILLIC_GROUND_TRUTH_ADJUDICATION):** gemini-2.5-pro and both 2.5-flash
  variants returned a COMPLETELY DIFFERENT person (different name, year, city) on handwritten
  certs — and 2.5-pro returned review_required=FALSE (confident + wrong = worst case).
- **Status:** those models are DISQUALIFIED for certificate classes in code (modelMatrix /
  ADR-018). Primary = gemini-3.1-pro-preview only. Mitigated, but a real hazard if model config
  ever regresses.

### A5. Read NON-DETERMINISM / instability (newly quantified this session)
- **Live:** the SAME booklet scored 0% and 60% in back-to-back runs. Root cause is NOT model
  temperature (it is 0) — it is a **timeout / transient-empty read** under load (a 0% run = the
  read returned nothing). This is robustness, not "the model is random."

---

## B. ARCHITECTURE PROBLEMS (how the system processes the read)

### B1. THE killer finding — no strong model ever saw the pixels (historical)
- **Evidence (OCR_PROVIDER_BENCHMARK_PLAN §3):** the old pipeline was image → Google Vision
  (text A) → DocAI (text B) → DeepSeek arbitrates text A vs B. **DeepSeek is text-only — it
  never sees the image.** So when both OCRs misread cursive, the arbiter chose between two wrong
  texts and could not recover. "The highest-impact single change: a vision LLM that receives the
  actual image crop." 
- **Status:** the live path is now Gemini-VLM-first (it DOES see the image), which is the right
  direction. The remaining lever (audit's #1) is to read each handwritten FIELD's high-res crop
  with Gemini — generalize the date-crop read to names/patronymic/place. **NOT YET DONE.**

### B2. Critical unread fields silently DROPPED (fixed this session)
- A handwritten field the model couldn't read VANISHED from output (arbitration discarded the
  empty placeholder) → the user was never prompted, then the form 422'd. **FIXED** — unread
  required fields now surface as null+review "enter manually" rows.

### B3. "Everything → review" over-conservatism vs unsafe auto-delivery (both real)
- Historically ~100% of fields force-reviewed (handwritten-blanket gate) → no auto-fill.
- This session built consensus + dictionary auto-delivery → booklet auto-filled 3/5. BUT the
  measurement caught a **legal-safety bug**: a stably-misread handwritten DOB auto-delivered a
  WRONG date (consensus "agreed" on the misread). **FIXED** — a handwritten DATE never
  self-anchors / never consensus-auto-delivers; it needs MRZ/dictionary or stays soft-confirm.
- Net: the gate must thread the needle — auto-fill the reliable, never auto-deliver a
  stably-misread critical. That balance is now coded but flag-gated OFF in prod.

### B4. Dictionary under-used as a completion engine (partly fixed)
- The dictionaries encode every field of every doc, but historically only EXACT hits were
  accepted; near-misses went to review. Built DICTIONARY_AUTOCORRECT (snap a closed-set near-miss
  — oblast/settlement/sex/civil_status/country/date — to the unique dictionary value) + patronymic
  reconstruction. Flag-gated OFF until measured.

---

## C. INFRASTRUCTURE / ACCOUNT BLOCKERS

### C1. >4MB Vercel edge limit → handwriting detail lost
- All real docs are 4.1–7.1MB phone photos → downscaled to fit the ~4MB serverless body cap
  BEFORE the read → handwritten digit detail is degraded. The high-res region crop is the
  workaround (read small crops at full res), now wired for dates.

### C2. Gemini RPM throttling → flash fallback → force-review cascade
- The premium preview model has low RPM; parallel page fan-out + 3× consensus bursts it → 429 →
  fallback to flash → ADR-018 force-reviews everything. Consensus 3× on a 7MB doc = 150s (timeout).
- Real fix is **account-side: raise gemini-3.1-pro-preview RPM.** Code can't safely parallelize
  (more bursts).

### C3. Google Cloud billing OFF (Vision + DocAI) — VERIFIED, but Vision is the wrong tool
- **Verified with the owner's real SA token:** Vision returns HTTP 403 "billing must be enabled
  on project messenginfo #537268475735." Billing is genuinely OFF.
- **PLUS a code bug:** the credential loader reads only inline SA JSON vars, not the standard
  `GOOGLE_APPLICATION_CREDENTIALS` file-path the owner set → even with billing on, the app would
  not load the key. `DOCAI_ENABLED=false`.
- **BUT per the benchmark, Vision is WEAK on handwriting (~63% cursive)** — so this is NOT the
  lever to chase; the VLM (Gemini) leads handwriting. Vision/DocAI would only help PRINTED docs.

---

## D. MEASUREMENT PROBLEMS (we couldn't honestly tell how good it was)

### D1. The accuracy harness was BROKEN + dishonest (fixed this session)
- gt-pipeline-bench pointed at non-existent fixtures (`*_ivanenko`) → prior "green" numbers were
  fiction; and "0 fabricated" counted EMPTY-as-pass (a MISS scored as success).
- **FIXED:** real `*_kuropiatnyk` docs + 5-verdict taxonomy (CORRECT/WRONG/MISS/FABRICATED/
  CORRECT_EMPTY) where empty never inflates the rate + an AUTO-FILL metric (correct AND no review).

### D2. The ground-truth corpus is tiny and partly wrong
- Only 4 scorable real docs, ALL hard (handwritten booklet, 2 birth certs, military). No modern
  printed-passport IMAGE on disk (only the booklet) — so the easy/common case can't be measured.
- GT itself has issues: sex coded "M" vs the pipeline's "Male" (false WRONG, now folded); birth-cert
  GT expects Ukrainian "Андрій" on a Russian-script source (the RU/UA question). The "20% birth
  cert" is partly a GT/policy artifact, not pure OCR.

### D3. No live GT benchmark in CI; quota-blocked
- Acceptance can only be measured live against Gemini, which is quota/RPM-constrained. No broad,
  CI-run, owner-verified GT set exists — so every accuracy number is EXPLORATORY (N<30).

---

## E. HONEST TARGETS (from the benchmark + roadmap — not aspiration)
| Class | Realistic auto-fill | Review |
|---|---|---|
| Printed (modern passport data page, ID card, printed certs) | **90%+** | minimal |
| Handwritten names + dictionary-validated fields | **good** | light |
| Handwritten DATES on faded/old certs | **low** — genuine ceiling | **mandatory, one-click** |
| Hard-case (Soviet/bilingual/illegible) | **50–80%** identity | mandatory |
> "Not 100%, ever, with any provider." (OCR_PROVIDER_BENCHMARK_PLAN, Class B)

---

## F. WHAT'S FIXED vs OPEN (this session)
**FIXED + tested:** critical-unread-field vanishing (B2); stably-misread-date auto-delivery
safety (B3); date-region read dead→working (A1); harness broken→honest (D1); place М-bug +
country dict; dictionary autocorrect engine built (B4, flag OFF).
**OPEN (code):** generalize the high-res Gemini crop read to names/patronymic/place (B1, the
audit's #1 lever); make reads robust (retry-on-empty) to kill the 0% variance (A5).
**OPEN (owner / account):** raise Gemini RPM (C2); decide RU/UA name policy on Soviet docs (A2,
D2); Google Cloud billing — only if printed-doc DocAI is wanted (C3, not for handwriting).
**OPEN (measurement):** add modern-printed-doc images + broaden GT (D2).
