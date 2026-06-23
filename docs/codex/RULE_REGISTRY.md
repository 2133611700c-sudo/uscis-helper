# RULE REGISTRY — the teaching ledger (who-knows-what)

The auditable ledger of every reading/translation rule in the ONE codex: its normative SOURCE, which
models it teaches, when it was added, and its measured status. RULES_MASTER_INDEX.md is the human
"where is rule X" map; THIS is the "who-was-taught-what, from what authority, with what proof" ledger.

Invariant (enforced): rules live ONCE in `apps/web/src/lib/docintel/docReadingRules.ts` (constants +
per-doc `rules[]`) and flow to BOTH models from that one source — Gemini via `readingRulesPromptBlock`
(default ON), DeepSeek via `textRulesForDeepSeek`. The guard `docReadingRulesSync.test.ts` fails the
build if a non-image-only rule is taught to Gemini but silently dropped from DeepSeek.

Legend — Taught: G=Gemini prompt, D=DeepSeek prompt, ∅=image-only (Gemini only, legitimately).
Measured: deterministic golden vector (free), or live gt-pipeline-bench (paid — run only when budget allows).

## Cross-cutting rule constants (docReadingRules.ts)
| Rule | Source (normative) | Taught | Added | Measured |
|---|---|---|---|---|
| MONTH_WORD_RULE (червня/июня=June ≠ липня/июля) | owner real docs; UA/RU month words | G,D | 2026-06-22 | live 2/2 Soviet birth-cert DOB None→June; golden `alphabetCompleteness`/`russianGlossary` |
| RUSSIAN_SCRIPT_RULE (keep ы/э/ё/ъ; Сергей not Сергій) | source-faithful transcription (L8); owner RU birth cert | G,D | 2026-06-22 | DeepSeek live (keeps Russian); sync guard |
| RUSSIAN_DOCUMENT_RULE (RU→EN terms/places; отчество=Patronymic; passport-match; archaic letters) | Federal Law 143-ФЗ; BGN/PCGN; ICAO/L7 | G,D | 2026-06-23 | `russianGlossary.test` (55) + `referenceValidation.test` (29); sync guard |

## Per-document rules (DOC_READING_RULES) — by class
Each class injects the constants above + its own `rules[]`. Notable per-class teaching:
| Class | Key taught rules | Taught | Measured |
|---|---|---|---|
| ua_birth_certificate | spelled-out-date METHOD; read parents/series; RU script+document rules | G,D (date method G,D; "read cursive letter by letter" ∅) | live: parents/series recovered via STAGE-4 hi-res (4-7/N); golden vectors |
| ua_international_passport | controlling Latin SERGII≠SERHII (L7); MRZ math anchor | G,D | live: SERGII read correct; MRZ check-digit (mrz.ts tests) |
| ua_military_id | rotated 90°/180° (∅ image-only); СО ###### series | G(∅ for rotation),D | live: read all 5 fields stable 5/5 (stability-audit) |
| ua_marriage/divorce/death/name_change | RU script+document rules; both-parties; act/series | G,D | civilRegistryDeathNameChange.test (17) |
| us_ead / us_i94 / us_i797 | A-Number/card#/category codes; admission#; receipt# | G,D | docNumberFormats.test (59) |

## Codex knowledge (packages/knowledge) — authority + provenance
| Knowledge | Source (normative) | Validated by |
|---|---|---|
| KMU-55 Ukrainian transliteration | Cabinet Resolution №55 (2010), czo.gov.ua/en/translit; cross-checked translit-ua/anyascii | `alphabetCompleteness.test` (82), `referenceValidation.test` (Щ→Shch, зг→zgh, Г→H, …) |
| Russian BGN/PCGN | BGN/PCGN 1947 (owner-approved; NOT GOST); ICAO/passport via L7 | `referenceValidation.test` (Ёлкин→Yelkin, Цой→Tsoy, …) |
| Oblast English names | modern Ukrainian (GeoNames/DMS): Kyiv≠Kiev, Odesa≠Odessa | `referenceValidation.test`; `russianGlossary.test` (RU oblasts) |
| Civil-registry terms (UA+RU) | Federal Law 143-ФЗ; UA РАЦС/ДРАЦС | `russianGlossary.test`; `civilRegistryDeathNameChange.test` |
| Patronymic (UA+RU) | derivation rules + exceptions | `patronymic.test`, `patronymicRu.test` |
| Apostrophe family (U+2019 etc.) | KMU-55 (apostrophe not reproduced) | `alphabetCompleteness.test` |

## How to add a rule (see TEACHING_LOOP.md)
1. Claude reads the real doc as mentor → records the truth. 2. Encode ONCE in docReadingRules (rule) +
a golden vector + (term/place) a packages/knowledge entry, each with a SOURCE cite. 3. It auto-teaches
Gemini + DeepSeek. 4. Measure free (golden) + optionally one live read (budget-gated, 429→BLOCKED).
5. Add a row here with the source + measured status.
