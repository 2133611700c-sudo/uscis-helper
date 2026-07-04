# ONE BRAIN v2 — first LIVE decision-shadow data (2026-07-04)

**Setup (real route, real reads, real documents):** the branch's `POST /api/translation/vision-extract`
driven directly with the owner's gitignored real-document fixtures. Env: `ONE_BRAIN_RECOGNIZE_ENABLED=1`
(orchestrator), `ONE_BRAIN_DECISION_SHADOW=1`, `ONE_BRAIN_EVIDENCE_ENABLED=1`, `READER_PROVIDER=openai`
(**Gemini probe returned HTTP 429** — monthly spend cap still exhausted; OpenAI gpt-4.1 probe HTTP 200).
All output below is PII-FREE (doc types, counts, flags — never field values).

## Results

| Doc (real) | Read | decision_shadow | Notes |
|---|---|---|---|
| ua_international_passport (printed) | gpt-4.1, 8 fields, ok:core-b2, core_path=canonical, ~6.0s | **fields:8, diffs:0, unresolved_match:true** | ADR-018 correct: non-Gemini read → 8/8 force-review (`fallback_model_used`) |
| ua_military_id (printed) | gpt-4.1, 5 fields, ok:core-b2, core_path=canonical, ~6.3s | **fields:5, diffs:0, unresolved_match:true** | same force-review posture |
| ua_birth_certificate (handwritten) | **vision_failed BY DESIGN** | n/a | `isHandwrittenFamily` hardening: the GPT override NEVER applies to handwritten/certificate families (f625ff2); with no Gemini key in env the read fails closed. Proof the cert-safety works on the live route. |

Raw log markers (verbatim, PII-free):
```
[decision_shadow] {"doc_type_id":"ua_international_passport","fields":8,"diffs":0,"diff_keys":[],"unresolved_match":true}
[decision_shadow] {"doc_type_id":"ua_military_id","fields":5,"diffs":0,"diff_keys":[],"unresolved_match":true}
[ADR018] fallback_model_used {"doc_type_id":"ua_international_passport","model":"gpt-4.1","primary":"gemini-2.5-pro","fields":8}
RESULT_META birth: {"http":200,"ok":false,"status":"vision_failed:no GEMINI_API_KEY* set","core_path":"legacy_fallback"}
```

## Honest interpretation

- **Decision Engine ≡ legacy C3 on REAL traffic: zero diffs on both live printed documents.**
  This is the first real-world confirmation of the flip criterion (`diffs=0 ∧ unresolved_match`).
  N=2 documents is NOT a flip-authorizing window — it is the first evidence the shadow
  instrument works end-to-end and the engine tracks the live logic outside fixtures.
- `fields_with_evidence: 0` on the passport/military runs is EXPECTED: template evidence exists
  only for `ua_birth_certificate`, and Google Vision (provider bbox) is billing-403.
- **TPS one-arbitration shadow could NOT be exercised live**: the TPS route's front OCR layer is
  Google Vision (billing-403). It needs either Vision billing or the owner's staging traffic.
- **What unblocks the rest:** owner tops up Gemini (429 → primary reader + handwritten-cert
  path + acceptance benchmark) and/or enables Vision billing (provider bbox + TPS shadow).

## Flip ladder position (unchanged rules)
parity-CI ✓ (all green) → **first live shadow points ✓ (this file)** → real-traffic WINDOW
(owner: set `ONE_BRAIN_DECISION_SHADOW=1` + `TPS_ONE_ARBITRATION_SHADOW=1` in staging/prod)
→ diffs=0 sustained → per-field-kind flips with owner sign-off.
