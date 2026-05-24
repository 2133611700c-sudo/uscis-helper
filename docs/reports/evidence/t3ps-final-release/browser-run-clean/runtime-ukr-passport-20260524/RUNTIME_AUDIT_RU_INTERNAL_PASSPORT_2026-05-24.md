# Runtime Audit — RU internal passport recognition (production)

Date: 2026-05-24
Environment: production
URL: https://messenginfo.com/ru/services/tps-ukraine/start
Live SHA: 3513eb3720d71421d18c8f1d65352f2b642fd449
Verdict: FAIL (for Ukrainian internal passport normalization expectations)

## Scope
Black-box runtime check in live RU flow with user-loaded documents in Chrome session.
No code edits. No assumptions from prior reports.

## VERIFIED (UI truth)
1. Step 4 shows internal passport slot uploaded:
   - "Внутренний паспорт Украины ✓ загружено"
   - supporting slots also uploaded: passport, EAD, I-94, Driver License.
   - Evidence: `02_step4_internal_passport_uploaded_ru.png`

2. After clicking "Распознать документы", Step 5 appears with recognized data panel.
   - Evidence: `03_step5_conflict_top_ru.png`

3. Internal-passport-derived birthplace fields are present but malformed/non-normalized:
   - `Город рождения`: `слет . Тростянець`
   - `Область рождения`: `VINNYTSKA OBL.`
   - Evidence: `01_step5_city_oblast_ru.png`

4. Patronymic was not auto-filled from internal passport in recognized section:
   - `Отчество / Patronymic`: "Нет в загранпаспорте — заполните на следующем шаге"
   - Evidence: `03_step5_conflict_top_ru.png`

5. Conflict banner is shown on Step 5:
   - warning references conflict fields: `given_name, country_of_birth`
   - Evidence: `03_step5_conflict_top_ru.png`

## UNVERIFIED in this run
1. OCR raw payload / normalization rule path / dictionary rule application trace (network-level proof for this exact manual session).
2. ZIP/PDF output field truth for this exact run.
3. Whether owner mode shows rule provenance/confidence for the same OCR outputs.

## Artifacts
- `01_step5_city_oblast_ru.png`
- `02_step4_internal_passport_uploaded_ru.png`
- `03_step5_conflict_top_ru.png`
- `04_health_tps.json`
