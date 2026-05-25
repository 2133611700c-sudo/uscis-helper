# Handwritten Cyrillic OCR Pipeline — Session Progress
# Date: 2026-05-25

## DATASET MANIFEST (LOCKED)
- File: /tmp/passport_ukraine_resized.jpg
- Hash: 7b4fd182
- Ground truth: Surname=REDACTED_NAME, Name=Сергій, Patronymic=Сергійович
- Ground truth: DOB=25.06.1986, City=Тростянець, Province=Вінницька обл.

## PHASE 1 COMPLETE: Google DocAI Raw Benchmark
- Language hints (uk+ru): ZERO difference
- 5/5 runs: DETERMINISTIC for key fields
- Surname: "REDACTED_NAME" (wrong — п'→н)
- Name: NOT extracted
- Patronymic: "Cepriziobur" (GARBAGE)
- DOB: correct ✅
- City: "Слет. Тростянець" (correct with prefix noise)
- Province: "Вінницької області" ✅

## PHASE 1.5: Vision vs DocAI comparison
- Vision reads surname BETTER: "REDACTED_NAME" (keeps п'ятник)
- DocAI reads surname WORSE: "REDACTED_NAME" (loses п')
- Both fail equally on patronymic (garbage)
- Both correct on DOB, city, province

## PHASE 2 COMPLETE: DeepSeek Second-Pass
### Single OCR + DeepSeek: honest but limited
- Correctly rejected garbage patronymic
- Correctly stripped city prefix
- Could not improve surname

### DUAL OCR + DeepSeek CROSS-REFERENCE: BREAKTHROUGH
- Surname: CORRECTLY reconstructed "REDACTED_NAME" from:
  - Vision "REDACTED_NAME" (has п'ятник) + DocAI "REDACTED_NAME" (has Куро-)
  - Combined = REDACTED_NAME ← CORRECT
- Patronymic: Inferred "Сергійович" (NEEDS REVIEW — inference not OCR)
- City: Correctly stripped prefix
- Province: Correctly normalized

## NEXT STEPS (Phase 3-7)
1. Build dual-OCR call in booklet module
2. Build DeepSeek cross-reference prompt as pipeline step
3. Wire into field arbiter with correct confidence classes
4. Auto: DOB, city, province (high confidence)
5. Review: surname (dual-OCR + DeepSeek medium), patronymic (inference only)
6. Manual: given_name (no OCR evidence)
7. 5-run stability test of full pipeline
8. Deploy with feature flag

## KEY ARCHITECTURAL DECISION
- Use BOTH Vision AND DocAI on booklet documents
- Send BOTH raw texts to DeepSeek for cross-referencing
- DeepSeek acts as linguistic arbiter, not OCR
- Garbage rejection via existing guards still active
- Manual fallback for unrecoverable fields
