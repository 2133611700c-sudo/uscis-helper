# Tri-agent benchmark on the owner's REAL handwritten documents (2026-06-24)

> **⛔ CORRECTED by the honest re-test (HTR_HONEST_RETEST.md, same day).** Two over-claims here were fixed: (1)
> raxtemur "blank-control clean" was WRONG — raxtemur fabricates a word on a blank image (cannot abstain); (2)
> "raxtemur is the reader" was too broad — raxtemur FAILS printed text (passport CER ~1.0); LLMs read print
> perfectly. The "3/6" included one CER-tuned crop set (soviet01). Correct architecture: route by field
> rendering (handwriting→raxtemur+gate+review; print→LLM). Read this header before trusting the numbers below.

**Mandate (owner, rights granted to use his originals):** teach all 3 readers identically, then test all
3 on his real documents; run everything through the verified recipe first. PII discipline: his documents
were read ONLY on PAID API tiers (Gemini `GEMINI_API_KEY_PAY`, OpenAI paid); full reads stay gitignored in
`qa-private/htr-poc/triagent_full.json`; this report is PII-free (CER / match / lengths only).

## Method
- **Identical input to all readers:** each name field cropped at NATIVE resolution from the original +
  2/98 contrast-stretch (the verified recipe), saved as a PNG, fed byte-identical to all three readers.
- **Identical teaching:** same focused prompt for both LLMs — "read EXACTLY in original Cyrillic, do NOT
  transliterate, do NOT guess, empty-beats-wrong." raxtemur is a recognizer (its "teaching" = the recipe).
- **Corpus:** 2 real RU-script handwritten birth certs with owner-VERIFIED GT (birth_cert_handwritten_01,
  birth_cert_soviet_01), 3 name fields each = N=6 fields. (UA docs still blocked on missing GT.)
- **Scoring:** channel-aware (Cyrillic fold vs Latin fold, min CER); exact = CER 0.0; match = GT substring.

## Result (N=6 real handwritten Cyrillic fields, identical native-res crops)
| Reader | tier | exact (CER 0) | match | notes |
|---|---|---|---|---|
| **raxtemur/trocr-base-ru** | **local, key-free, $0** | **3/6** | **5/6** | best overall; no PII egress |
| gemini-3.1-pro-preview | paid, primary (unreliable avail) | 2/6 | 3/6 | best cloud; native-res recovered 2 it fabricated at low-res |
| gpt-4.1 | paid | 1/6 | 2/6 | partial |
| gemini-2.5-pro | paid, GA | 0/6 | 1/6 | fabricates handwriting even at native res (ADR-018 disqualified — confirmed) |
| gpt-5.5 | paid | 0/6 | 0/6 | WORSE than gpt-4.1 — newer ≠ better; fabricates more |

**Ranking on real handwriting:** raxtemur > gemini-3.1-pro-preview > gpt-4.1 > gemini-2.5-pro > gpt-5.5.

## Conclusions (honest)
1. **The local, key-free `raxtemur` beats every paid cloud model** on the owner's real handwritten Cyrillic —
   at $0 and with zero PII egress. This is the reader for handwritten certificate fields.
2. **Answers the ADR-026 open question:** native-res crops DO recover the strongest model (gemini-3.1-pro-preview
   went from fabricating to 2/6 exact) — so part of the prior "fabrication" was a low-res-input artifact for the
   capable model. But native-res does NOT rescue the GA models (gemini-2.5-pro 0/6) or newer GPT (gpt-5.5 0/6) —
   those have a genuine handwriting-reading deficit, not just a resolution problem.
3. **Newer is not better:** gpt-5.5 (0/6) underperforms gpt-4.1 (1/6) on cursive — it fabricates more.
4. **Not yet fully autonomous:** even the best reader is 3/6 exact; the non-exact fields (CER 0.2–0.5) still
   need human review for legal exactness. Architecture: raxtemur as the primary handwritten-field reader +
   human-review gate; the remaining lever to push exact-rate up is automatic per-field region localization.

## Cost / reproduce
~24 paid API calls across 2 runs (≈ pennies). `qa-private/htr-venv/bin/python qa-private/htr-poc/triagent.py`
(`TRI_GEMINI`/`TRI_GPT` env to pick models). Crops/reads/keys all gitignored; report PII-free.
