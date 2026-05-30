# Agent Document Rules — the constitution for document-processing agents

Every agent / virtual employee that touches a Ukrainian document MUST obey these rules.
They are not optional and they are not re-invented per task. The machine source of truth
is the typed schemas + Field Contract; this file is the human/agent-readable charter.

## Where the truth lives (do NOT re-invent)
| Concern | Source of truth |
|---|---|
| What fields a document has, in order, official labels | `apps/web/src/lib/translation/forms/ukraine/schemas/*.schema.ts` (Field Contract) |
| Which official act defines it | `officialSource` + `sourceId` on the schema; `docs/official-forms/ukraine/source-ledger.json` |
| Authority names UA/RU→EN, historical locks, era | D-GLOSSARY registry (`packages/knowledge/src/registry/`) |
| Geography (city/oblast/смт) | D-GLOSSARY КАТОТТГ layer + gazetteer |
| Recognized → canonical field mapping | `forms/ukraine/mappings/*.mapping.ts` |
| Output PDF structure | `renderOfficialTranslation` (pdf-lib) — bureau-style, not pixel copy |

## Hard rules (violations = bug)
1. **Never invent a value.** Every field has `canGuess=false`. Absent/illegible → empty + `review_required`, never a plausible guess.
2. **Every field traces to a source.** A field has a `sourceRule`; a value has evidence (the document region). No `sourceRule` / no evidence → not final.
3. **Patronymic is "Patronymic", NEVER "Middle Name".**
4. **Do not modernise historical documents.** Era matters: Militsiya↛Police, Kirovohrad↛Kropyvnytskyi, смт kept as "urban-type settlement", old agency names preserved. Use `documentDate` + `valid_from/valid_until`.
5. **Controlling Latin beats re-transliteration.** Passport MRZ name/number/DOB override KMU-55.
6. **Names/numbers/dates are LOCKED** through prose translation — DeepSeek/Gemini may translate surrounding prose only, never proper nouns/numbers, and never an authority name without a glossary lock.
7. **No silent geography fixes.** Fuzzy place match → `review_required`. Never replace a village with the nearest city.
8. **No silent missing fields.** Missing required field → visible placeholder `____ [enter from document]` + not certifiable.
9. **No source not verified.** A source is usable only if its `/print` `<title>` + number + date match (zakon.rada serves stale CDN pages — re-verify). An unofficial mirror is `DERIVED`, not `OFFICIAL`.
10. **The signed PDF is bureau-style English**, complete and accurate — not a pixel copy of the Ukrainian blank. The user self-certifies after review; Messenginfo does not certify.

## Job cards (per role)
```
role: CivilStatusExtractionAgent     # birth/marriage/divorce/death/name-change
allowed_sources: [ua_kmu_1025_2010]
must_use: [schema (Field Contract), D-GLOSSARY agencies+geography, mapping, eraRules]
must_return: canonical_fields + evidence + missing_fields + review_required_fields + variant
forbidden: invent missing parent/spouse names · modernise historical agency/place ·
           patronymic as middle name · output before Review Gate · unverified source

role: PassportExtractionAgent         # international passport
must_use: MRZ parser (controlling Latin) + D-GLOSSARY oblast
forbidden: re-transliterate a name the MRZ already gives in Latin

role: SourceVerificationAgent
must_do: fetch /print, verify <title>+number+date, hash; mismatch → INVALID (do not use)
```

## Era variants (civil status)
- `modern_ua_2010_plus` — Ukrainian text only (КМУ №1025).
- `post_2019_unzr_rnokpp` — birth blank only, bears УНЗР/РНОКПП (ред. КМУ №691, 2019). Their absence on other/older blanks is NOT an error.
- `legacy_soviet_bilingual` — UA/RU duplicated text; always `review_required`; prefer the Ukrainian layer when both readable.

## Pipeline (every document, same order)
`upload → quality gate → recognise (3.1-pro + Google Vision) → presence-confirm →
mapping (raw→canonical) → normalize (KMU-55 / glossary / geography / dates, era-gated) →
Review Gate (evidence + warnings) → renderOfficialTranslation → audit`

## Official source status (2026-05-29)
- VERIFIED official `/print`: КМУ №1025 (5 civil certs), №152 (foreign passport), №302 (ID card).
- КАТОТТГ geography: official source = data.gov.ua / Мінрегіон (kodyfikator.xlsx); current layer is a mirror pending owner byte-verify.
- NEED correct official URLs: military ID, education diploma, pension certificate (prior guesses were wrong acts).
