# ADR-025 — Reject heavy LLM-orchestration infra (cost; deterministic-first)

Status: Accepted (2026-06-23)
Context: Owner principle — the whole pipeline exists to MINIMIZE expensive LLM calls; do max work
deterministically (free). A professional GitHub/web research pass (2025-2026) surveyed popular LLM-app
frameworks. Each was evaluated against: (a) does it reduce or MULTIPLY paid LLM calls? (b) dependency/
operational cost? (c) fit with our ONE-codex, deterministic-first, Gemini-minimal architecture.

## Decision: REJECTED for now (re-evaluate only on a measured need)
| Option | Researched (repo) | Why rejected |
|---|---|---|
| DSPy (signatures/auto-prompt-opt) | stanfordnlp/dspy ~35k | Optimizes prompts by running MANY paid LLM calls; heavy dep; our rules are deterministic + human-authored, not search-optimized. |
| Langfuse (prompt registry/observability) | langfuse/langfuse ~30k | A hosted/self-hosted service + SDK; our ONE codex in `packages/knowledge` + git already versions rules with provenance (RULE_REGISTRY.md). Added ops cost, no call savings. |
| LangGraph (agent state machine) | langchain-ai/langgraph ~35k | Orchestrates multi-LLM agent graphs; we want FEWER LLM calls, not an agent runtime. Our pipeline is a deterministic function chain. |
| Guidance (constrained decoding) | guidance-ai/guidance ~21k | Token-level constraints need provider support we don't control (Gemini API); we already use response_schema + deterministic C3 validation. |
| Fine-tuning | — | $500-5000+ + 2-week cycles; injected rules are free and change instantly. Only revisit if injected rules are exhausted AND a measured semantic gap remains. |
| RAG vector DB for the glossary | — | Our glossary is small + injected cheaply; a vector store adds infra + a retrieval call. Revisit only if the glossary outgrows the prompt budget. |
| MT-engine swap (OpenNMT/argos/OPUS) | argosopentech, OpenNMT | Replacing the translation path with a separate NMT engine adds a heavy model dependency; our deterministic transliteration + glossary + (future, gated) prose path already cover it cheaply. |

## ADOPTED instead (free / cost-aligned)
- Validate the codex against AUTHORITATIVE references (translit-ua/anyascii/CZO/GeoNames) — `referenceValidation.test`.
- ONE-source teaching + sync guard (`docReadingRulesSync.test`), provenance ledger (RULE_REGISTRY.md),
  the mentor learn→encode→teach→measure loop (TEACHING_LOOP.md) — all using existing FREE harnesses.
- Glossary structure with provenance (wiktextract pattern) — schema_version + source per entry.

## Consequence
No new heavy runtime dependency; no infra that multiplies paid Gemini calls. Production stays ~1 Gemini
read/document (all extra-call stages default OFF). If a future, MEASURED need appears (e.g. injected
rules exceed the prompt budget → consider compression/RAG; or a proven accuracy gap fine-tuning fixes),
reopen this ADR with the measurement.

Sources: research captured in the 2026-06-23 GitHub/web pass (DSPy, Langfuse, LangGraph, Guidance,
promptfoo, translit-ua, anyascii, wiktextract, GeoNames, OpenNMT). Don't-trust rule: every adopted
reference value is verified in `referenceValidation.test`, not taken on faith.
