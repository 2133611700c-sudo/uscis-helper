# HANDOFF — Session 17 (2026-05-25)

## What was done

### family_name KMU-55 transliteration (booklet-only users)
- File: `postExtractNormalize.ts`
- Added family_name handler BEFORE middle_name handler
- Two paths:
  - **Cyrillic input** (from booklet dual_ocr_crossref) → `transliterateKMU55()`
  - **Latin input** (from passport MRZ / EAD / I-94) → passthrough with garbage guard
- Title-cases ALL-CAPS Latin input (MRZ delivers "KUROPIATNYK" → "Kuropiatnyk")
- Garbage rejection for both paths

### Result
- Before: booklet-only users got Cyrillic "Куроп'ятник" in form
- After: booklet-only users get Latin "Kuropiatnyk" in form

### Central Brain plan audit
- Plan proposed 10-phase rebuild
- Honest mapping: 70% of plan already exists in different files
  - "Central Brain" = fieldArbiter + documentContracts + postExtractNormalize + validateBrainField
  - Dictionary bridge = @uscis-helper/knowledge (already single source)
  - Booklet pipeline = already 10/10 stable
- Real gaps identified:
  1. family_name KMU-55 (FIXED in this session)
  2. Multi-sample benchmark (need 3-5 real booklets)
  3. Re-parole booklet — VERIFIED NOT NEEDED (re-parole uses passport MRZ only)

### Verification
- Booklet stability: 3/3 identical with surname=Kuropiatnyk
- Passport MRZ regression: family_name=Kuropiatnyk preserved (no double-transliteration)
- Test suite: 1985/1985 passing
- Latency: 16.4s avg (unchanged)

## What is NOT done
- Multi-sample booklet validation (need real samples from other Ukrainians)
- Browser-level Step 5 review verification

## What must happen next
1. Collect 3-5 real booklet images with verified ground truth
2. Run benchmark across all samples
3. If accuracy holds → mark booklet pipeline production-stable across population
4. If not → identify failure modes and add per-pattern handling

## Previous session context
Session 16 fixed arbiter priority + review_required for booklet crossref.
10/10 identical results on canonical booklet.

## Earlier sessions
- Field Arbiter v0 built: fieldArbiter.ts + 10 tests
- Arbiter WIRED into wizard merge — resolveAllFields() is single source of merged truth
- Levenshtein cross-document matching + plausibility
- Brain prompts improved for patronymic + place_of_last_entry
- Country guard: 'KUROPIATNYK' as country → rejected
- DocAI integration: client + provider + feature flag














