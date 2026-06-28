# Product Scope — USCIS Document Translation (printed UA/RU civil documents)

**Status:** Stage 1 (scope freeze). Documentation only. **MVP NOT READY** — see ACCEPTANCE.
Branch `translation/ru-and-model-matrix-fixes`.

## The ONE product
**USCIS Document Translation for printed Ukrainian and Russian civil documents.** A user
uploads a printed UA/RU civil document and the system helps produce: (1) a full English
translation; (2) original + translation in a verifiable form; (3) manual confirmation of every
uncertain field; (4) a translator's certification; (5) a single USCIS-ready PDF packet.

This is **NOT** TPS, re-parole, EAD, form preparation, or a general immigration advisor.

## MVP scope (this version supports ONLY)
- `PRINTED_UA_BIRTH_CERTIFICATE`
- `PRINTED_RU_BIRTH_CERTIFICATE`

Other printed civil documents (marriage, divorce, certificates/extracts) come **only after**
this path passes acceptance, **per-template, after separate verification**. No new templates
until the birth-certificate path is proven on a real corpus.

## What the product explicitly does NOT do (v1)
- Decide TPS / asylum / re-parole eligibility.
- Recommend which form to file; fill I-821 / I-765 / I-131.
- Give legal advice or an eligibility conclusion.
- Treat handwritten Cyrillic as an automatic fact (handwriting → manual-review only).
- Emit unverified machine translation.
- Promise USCIS acceptance.
- Translate unknown document types without review.
- Auto-confirm names, dates, or numbers.

TPS and re-parole remain **separate, frozen** directions — not deleted, not mixed in.

## Exact user path (no `upload → Gemini → auto-PDF` shortcut allowed)
1. choose document type → 2. upload PDF/JPG/PNG → 3. quality + orientation check →
4. classify printed/handwriting/mixed → 5. extract text + fields → 6. **preserve raw Cyrillic
unchanged** → 7. produce English translation → 8. show each field with evidence/crop →
9. user corrects + confirms → 10. verify no uncertain fields remain → 11. build translation +
certification → 12. preview → 13. payment → 14. final PDF → 15. download.

## Data model (every field keeps these layers SEPARATE — never overwrite one with another)
```ts
type TranslationField = {
  fieldId: string
  rawCyrillic: string | null
  normalizedCyrillic: string | null
  transliteration: string | null
  translatedEnglish: string | null
  pageNumber: number | null
  bbox: BoundingBox | null
  evidenceCropPath: string | null
  sourceProvider: string | null
  confidence: number | null
  abstentionReason: AbstentionReason | null
  reviewStatus: 'candidate' | 'needs_review' | 'corrected' | 'confirmed' | 'unreadable' | 'not_applicable'
  userCorrection: string | null
  confirmedValue: string | null
}
```
Invariant: `rawCyrillic ≠ normalizedCyrillic ≠ transliteration ≠ translatedEnglish ≠ confirmedValue`.

## Two document modes
- **Mode A — printed:** automation allowed (OCR/layout → mapping → translation → validators →
  review of problem fields), but the user still sees + confirms the result.
- **Mode B — handwritten/mixed:** automation limited — HTR read is a HINT only, never auto-confirmed;
  crop the source region → manual entry → confirm. Handwriting does not block the order if the user
  can type it.

## Critical fields (separately verified)
surname · given name · patronymic · date of birth · place of birth · series · document number ·
date of issue · issuing/registration authority · parents/spouses · seals & official marks.
**Names: controlled transliteration only (never semantic translation); preserve the original.**
Watch confusables: І/I · О/O/0 · В/B · С/C · Р/P · Н/H · Х/X.

## Final PDF contents
- **Translation:** source document title; full translation of visible text; preserved structure;
  seal/signature markers; page numbers; nothing omitted; no unconfirmed guesses.
- **Certification:** translator-competence statement; completeness+accuracy statement; translator
  name; signature; date; contact (per product policy). The certification template must be
  separately reconciled with official USCIS requirements + the business legal model — auto-generated
  text alone does NOT make a translation legally certified.

## Strategy: translation core → shared confirmed-data layer → other products (LATER)
The translator is not separate forever. It becomes the shared module: a reliable
read → preserve-original → translate → human-correct → confirm → certify core, whose **confirmed**
data later feeds I-821/I-765/I-131 and full USCIS packets — but only after each form's current
rules are separately verified. **Now: build the reliable translation core. Later: connect it.**

> Engineering rules, runtime map, and acceptance gates: see
> `DOCUMENT_TRANSLATION_RUNTIME_MAP.md` and `DOCUMENT_TRANSLATION_ACCEPTANCE.md`.
> OCR reality + limitations: `docs/ocr/CURRENT_STATE.md`, `docs/ocr/KNOWN_LIMITATIONS.md`.
