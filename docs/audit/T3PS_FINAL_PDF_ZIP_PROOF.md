# T3PS Final PDF/ZIP Proof

Generated: 2026-05-16T22:02:30Z  
Source listing: `/Users/sergiiredacted/work/uscis-helper/docs/reports/evidence/t3ps-final-pdf/zip_listing.json`

## Scenario A (I-821 only)
- ZIP contains: `I-821.pdf`, `README.txt`
- `I-765.pdf` absent (expected for no-EAD path)
- I-821 filled fields: 64
- Required key presence: family/given/dob/passport_number/passport_expiration/marital/Part7 => PRESENT
- Cyrillic leak: NONE

## Scenario B (I-821 + I-765)
- ZIP contains: `I-821.pdf`, `I-765.pdf`, `README.txt`
- I-821 filled fields: 68
- I-765 filled fields: 31
- I-765 application type and identity/status fields present
- Conditional A-number/I-94 fields present
- Cyrillic leak: NONE (I-821 + I-765)

## Redacted dumps
- `/Users/sergiiredacted/work/uscis-helper/docs/reports/evidence/t3ps-final-pdf/A_i821_only_i821_field_dump_redacted.txt`
- `/Users/sergiiredacted/work/uscis-helper/docs/reports/evidence/t3ps-final-pdf/B_i821_i765_i821_field_dump_redacted.txt`
- `/Users/sergiiredacted/work/uscis-helper/docs/reports/evidence/t3ps-final-pdf/B_i821_i765_i765_field_dump_redacted.txt`

Verdict: PASS
