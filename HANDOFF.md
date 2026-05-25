# HANDOFF — Session 15 (2026-05-24)

## What was done
Phase A stabilization started. Three code changes:

### A2: MRZ Identity Lock
- File: `TPSWizardV2.tsx` merge logic
- If merged field came from MRZ (`source === 'ocr_mrz'`), weaker sources cannot degrade it
- Conflicts from weak sources logged but do NOT mark MRZ as requires_review
- Identity fields from non-MRZ sources marked `requires_review: true`

### A3: City/Province Cyrillic Regex Fix
- File: `postExtractNormalize.ts`
- ROOT CAUSE: JavaScript `\b` word boundary does NOT work with Cyrillic (Cyrillic = `\W`)
- `CITY_NOISE_RE`: added "обл" (3 chars) and "obl" — Brain outputs "ОБЛ." not full "область"
- Replaced `\b` with explicit Unicode boundaries `(?:^|[\s.,;:!?])`

### A4: Booklet Weak Source
- File: `TPSWizardV2.tsx` merge logic
- ALL booklet fields marked `requires_review: true`
- Booklet birthplace override also marks review_required

## What is NOT verified
- All three changes are CODE ONLY — need live deployment + same-image test
- The regex fix needs curl proof: "ВІННИЦЬКА ОБЛ." must be REJECTED as city
- MRZ lock needs browser test: upload EAD with "Saghi" + passport, verify "Sergii" wins

## What must happen next
1. Deploy this commit
2. curl test passport: verify city_of_birth rejected
3. Browser test: upload EAD → passport → verify merge
4. If proven → Phase A items checked off
5. If not → trace runtime and fix

## Previous session context
See /mnt/transcripts/2026-05-24-13-52-16-uscis-helper-full-pipeline-audit-and-fix.txt
- Booklet garbage-rejection guard: mixed-case, consonant clusters, word count checks
- 7 new tests added: 1975 total
- Address binding fix: full → split fallback
- Review cards fix: a_number/address for all paths
- Address composite fix + review cards for all types
- passport_expiration_date now visible in review cards


- Field Arbiter v0 built: fieldArbiter.ts + 10 tests
- Arbiter WIRED into wizard merge — resolveAllFields() is now the single source of merged truth
- Patronymic UNBLOCKED from booklet

- Levenshtein cross-document matching + plausibility
- Brain prompts improved for patronymic + place_of_last_entry
- Country guard: 'REDACTED' as country → rejected
- DocAI integration: client + provider + feature flag


