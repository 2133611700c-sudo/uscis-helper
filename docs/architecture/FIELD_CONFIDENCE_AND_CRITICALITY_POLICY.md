# FIELD_CONFIDENCE_AND_CRITICALITY_POLICY.md

**Status:** CONSTITUTION DOC (required by ENGINEERING_MASTER_PLAN.md §4)
**Scope:** Every `CanonicalField`. Decides `reviewRequired`, blocks unsafe auto-final.
**Enforces:** Law 1 (no evidence → no field) + corollary "no silent correction".

---

## A. Split confidence contract

Every `CanonicalField` carries a confidence object with five independent layers (matches master plan §2):

```ts
confidence: {
  ocr:           0..1   // provider character/word confidence on the raw glyphs
  field_match:   0..1   // did we map the right region/label to this field key
  normalization: 0..1   // KMU-55 transliteration / glossary mapping confidence
  source_match:  0..1   // agreement with controlling source (MRZ/I-94/EAD/etc.)
  final:         0..1   // derived — see rule
}
```

**The rule (non-negotiable):**
> `final ≤ min(confidence layers that are critical for this field)`.

`final` can never exceed its **weakest critical layer**. A field with perfect OCR but low `source_match` on a critical field is low-`final`. `final` is **derived**, never set directly by a provider. Layers that do not apply to a field (e.g. `normalization` for a pure digit field) are excluded from the min, not defaulted to 1.

Threshold: `final < 0.85` on a critical/high field → `reviewRequired = true`.

---

## B. Legal field criticality matrix

| Field key | Criticality | Auto-final rule |
|---|---|---|
| `family_name` | **critical** | NEVER auto-final without explicit review. |
| `given_name` | **critical** | NEVER auto-final without explicit review. |
| `patronymic` | **critical** | NEVER auto-final without review. (Label = "Patronymic", never "Middle Name".) |
| `date_of_birth` | **critical** | NEVER auto-final without review. |
| `passport_number` | **critical** | NEVER auto-final without review. |
| `a_number` / `uscis_number` | **critical** | NEVER auto-final without review. |
| `issuing_authority` | **high** | Review if fuzzy-matched or AI-derived. (Історична "Міліція"→"Militsiya".) |
| `place_of_birth` | **high** | Review if fuzzy/AI. Oblast genitive→nominative DMS-verified; "смт"→"urban-type settlement". |
| `date_of_issue` / `date_of_expiry` | **high** | Review if fuzzy/AI or cross-doc conflict. |
| `document_series` | **high** | Review if fuzzy/AI. |
| `sex` | medium | Review only on disagreement. |
| `document_color` | **low** | No review on confidence alone. |
| layout/cosmetic fields | low | No review on confidence alone. |

**Critical-field invariant:** a critical field can reach `final` high enough to skip review ONLY through the normal high-confidence path **and** human review confirmation — there is no auto-final shortcut for the six critical fields.

---

## C. Provider-disagreement policy
- When ≥2 providers (e.g. Google Vision OCR vs Gemini vision reader) produce **materially different** values for the **same field**:
  - **critical or high field → `reviewRequired = true`**, regardless of individual confidences. Both candidates retained as evidence; neither auto-wins.
  - low/medium field → pick higher `source_match`; record the disagreement in evidence; no review forced.
- "Materially different" = not equal after whitespace/case normalization (and, for names, not equal after KMU-55 canonicalization).

---

## D. Source authority ranking (which source wins)

```
passport MRZ  >  passport visual OCR  >  I-94  >  EAD  >  Driver License  >  manual_user_entry
```

- The **controlling Latin spelling** from MRZ/I-94/EAD beats any re-transliteration (hard rule). If MRZ gives a Latin name, we do not re-transliterate Cyrillic over it.
- A lower-ranked source may not overwrite a higher-ranked one silently; conflict → evidence + `reviewRequired` for critical/high fields (see Cross-Document Contradiction Detector).
- `manual_user_entry` is **lowest** and applies **only after explicit user confirmation**; it sets `source='manual_user_entry'`, preserves the prior value + a `rejectedReason`, and never silently overrides a document-sourced value.
- Self-name on a `.gov.ua` source beats any third-party reference.

---

## E. No-silent-correction rule
If `rawValue` and `normalizedValue` differ **materially** (more than punctuation/whitespace/case — e.g. a different transliteration, a snapped geography name, a "corrected" authority), then:
- `reviewRequired = true`.
- `rawValue` is **kept and shown** alongside the suggested `normalizedValue`.
- The change is presented as a **suggestion**, never applied silently.
- Historical place names / historical authorities are **preserved**, not modernized (e.g. "Міліція"→"Militsiya", not "Police"; historical place names not snapped to modern equivalents).

This generalizes S1 (geography no-silent-snap) to name / patronymic / authority / date / series (S3).

---

## F. Acceptance
- `final` never exceeds the weakest critical layer (unit test over confidence math).
- Each of the six critical fields cannot be auto-finalized without a review flag (matrix test).
- Provider disagreement on a critical field forces `reviewRequired` (fixture test).
- A materially normalized value forces `reviewRequired` and retains `rawValue` (S1/S3 test).
- Lower-rank source never silently overwrites higher-rank; conflict → review (authority test).
