# STATUS — Messenginfo TPS Robot
**Updated:** 2026-05-24 Session 15 FINAL
**Live SHA:** 1dce75d
**Tests:** 1975/1975
**Commits this session:** 11

## EXTRACTION (API level — VERIFIED via curl on canonical dataset)

| Field | Status | Source | Value |
|-------|--------|--------|-------|
| family_name | ✅ | passport MRZ | REDACTED |
| given_name | ✅ | passport MRZ | Sergii |
| dob | ✅ | passport MRZ | 1986-06-25 |
| sex | ✅ | passport MRZ | M |
| passport_number | ✅ | passport MRZ | FU262473 |
| passport_expiration_date | ✅ | passport MRZ | 2029-02-22 |
| country_of_nationality | ✅ | passport MRZ | Ukraine |
| a_number | ✅ | EAD Brain | 231-853-474 |
| i94_admission_number | ✅ | I-94 OCR | 039622651A3 |
| last_entry_date | ✅ | I-94 OCR | 2022-09-09 |
| status (i94_class) | ✅ | I-94 OCR | UHP |
| us_address_street | ✅ | DL OCR | extracted |
| us_address_city | ✅ | DL OCR | Los Angeles |
| us_address_state | ✅ | DL OCR | CA |
| us_address_zip | ✅ | DL OCR | 90029 |
| province_of_birth | ✅ | passport Brain | Vinnytsia Oblast |
| country_of_birth | ✅ | EAD Brain | Ukraine |
| city_of_birth | 🛡 | booklet Brain | Trostianets (when Brain stable) / REJECTED (when garbage) |
| ead_category_on_card | ✅ | EAD Brain | C11 (display only — filing uses C19/A12) |
| middle_name | ⬜ | NONE | No document source — manual only |
| place_of_last_entry | ⬜ | NONE | Not extracted — manual only |

## GUARDS (VERIFIED)
- MRZ identity lock: "Sergii" cannot degrade to "Saghi" ✅
- Booklet garbage rejection: "BiRHEROI" → REJECTED ✅
- City "ВІННИЦЬКА ОБЛ." → REJECTED as city ✅
- Date US→ISO normalization ✅
- EAD given_name duplicate detection ✅

## REVIEW UI BINDINGS (code verified, browser needs final test)
- passport_expiration_date: NOW in review cards (was only in manual section)
- a_number + address: NOW visible for ALL filing types (was rereg only)
- address composite: NOW composed from DL split fields in mergedFields
- address manual fallback: parses full string to street/city/state/zip

## CANNOT FIX (honest)
- middle_name: no document source exists for загранпаспорт holders
- place_of_last_entry: I-94 module + Brain don't extract port of entry
- Booklet Brain nondeterminism: 50% correct, 50% garbage — guard catches garbage
- Controlling spelling: requires packetIdentityAnchor integration (future)

## NEXT STEP
Browser verification by Sergii on same canonical dataset.
If all fields show → baseline PASS → proceed to Field Arbiter v0.














