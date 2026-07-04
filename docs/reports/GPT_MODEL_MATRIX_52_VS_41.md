# GPT model check: gpt-5.2 vs gpt-4.1 as the temporary reader (2026-07-04)

Owner hypothesis: "maybe the GPT problem is the MODEL". Tested on the key's newest available
model (`/v1/models` shows the full 5-series: gpt-5, 5.1, 5.2, 5-pro). Same harness as all prior
runs (`gpt-pipeline-bench.mjs`: identical buildPrompt/schema, real owner fixtures vs owner GT,
full reads stay in gitignored qa-private). PII-free summary only.

## Scores (run1 / stability across 2 runs)

| Doc | gpt-4.1 (prior, 2 runs) | gpt-5.2 (2 runs) |
|---|---|---|
| passport (printed) | **100%**, samePerson YES, **8/8 byte-stable** | 50%, samePerson NO, 8/8 stable-but-WRONG |
| military (printed) | 40%, 5/5 stable | 60%, 4/5 stable |
| birth (handwritten) | 0%, 4/12 fields flap | 40%→20% between runs, **9/12 fields flap** |

## Root cause of the passport "WRONG" (the actual model problem)

Programmatic comparison (booleans only, no values): gpt-4.1's cyr fields == GT exactly;
gpt-5.2's cyr fields are the SAME LENGTH but **contain Latin characters** — the model
transliterates by itself and puts the LATIN form into the `raw_cyrillic` slot, stably across
runs. That is a SCHEMA-CONTRACT violation (Constitution L8: transcribe the script on the page;
Latin is produced ONLY by deterministic KMU-55 — never by the LLM), not a reading failure.

## Verdict

- **gpt-5.2 REJECTED as the temporary reader**: (a) stable schema violation on printed Cyrillic
  (self-transliteration into the Cyrillic slot — poisons rawCyrillic, the input D2/knowledge
  depends on); (b) WORSE fabrication instability on handwriting (9/12 flapping vs 4/12).
- **gpt-4.1 stays the temporary printed-docs reader**: 100% + byte-stable on printed + obeys the
  field schema. The handwritten/certificate exclusion (`isHandwrittenFamily`) stays — no GPT
  model measured to date is fit for handwriting.
- Prompt-tuning 5.x to stop self-transliterating is possible future work, but pointless while
  ADR-018 keeps Gemini primary and GPT is availability-only; not pursued.
- gpt-5-pro / 5.1 untested (cost; 5.2 is the newest and already disqualifies the series for the
  cyr-slot contract). Revisit only if 4.1 is retired.

Data: qa-private/reports/gpt-pipeline-bench-gpt52_run{1,2}.md (gitignored, full reads).
