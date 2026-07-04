# Model-matrix probe on the owner's pay key — RAW measurement artifact (2026-07-04)

> HISTORICAL point-in-time observation (docs/reports is guard-exempt by list — raw model
> ids appear here as MEASURED DATA, not as active options). Law derived from this data
> lives in `docs/architecture/MODEL_ROLE_MATRIX.md` (descriptive naming there).

**Setup:** key = owner's pay key (project 732980155584, $10 limit; alias GEMINI_API_KEY_PAY),
endpoint `generativelanguage.googleapis.com/v1beta`, tiny `generateContent` probe
(`maxOutputTokens:10, temperature default`), one call per model, statuses + `modelVersion`
from the response body. Run during a Google-side instability window (heavy calls 503-ing in
waves; these light probes went through). zsh note: `$M:generateContent` mangles the URL
(history-modifier parsing) → always `${M}:generateContent`.

## ListModels: 39 generateContent-capable models on this key

antigravity-preview-05-2026, deep-research-max-preview-04-2026, deep-research-preview-04-2026,
deep-research-pro-preview-12-2025, gemini-2.0-flash, gemini-2.0-flash-001, gemini-2.0-flash-lite,
gemini-2.0-flash-lite-001, gemini-2.5-computer-use-preview-10-2025, gemini-2.5-flash,
gemini-2.5-flash-image, gemini-2.5-flash-lite, gemini-2.5-flash-preview-tts, gemini-2.5-pro,
gemini-2.5-pro-preview-tts, gemini-3-flash-preview, gemini-3-pro-image, gemini-3-pro-image-preview,
gemini-3-pro-preview, gemini-3.1-flash-image, gemini-3.1-flash-image-preview, gemini-3.1-flash-lite,
gemini-3.1-flash-lite-image, gemini-3.1-flash-lite-preview, gemini-3.1-flash-tts-preview,
gemini-3.1-pro-preview, gemini-3.1-pro-preview-customtools, gemini-3.5-flash, gemini-flash-latest,
gemini-flash-lite-latest, gemini-omni-flash-preview, gemini-pro-latest, gemini-robotics-er-1.5-preview,
gemini-robotics-er-1.6-preview, gemma-4-26b-a4b-it, gemma-4-31b-it, lyria-3-clip-preview,
lyria-3-pro-preview, nano-banana-pro-preview

## Probe results (allowed candidates only; the banned 3.1 family was NEVER probed — listing above is passive data)

| Requested model | HTTP | modelVersion served |
|---|---|---|
| gemini-2.5-pro | 200 | gemini-2.5-pro |
| gemini-2.5-flash | 200 | gemini-2.5-flash |
| gemini-2.5-flash-lite | 200 | gemini-2.5-flash-lite |
| gemini-3.5-flash | 200 | gemini-3.5-flash |
| gemini-3-flash-preview | 200 | gemini-3-flash-preview |
| gemini-flash-latest | 200 | gemini-3.5-flash (alias resolves honestly) |
| **gemini-pro-latest** | 200 | **gemini-3.1-pro-preview — the FORBIDDEN version** |
| gemini-omni-flash-preview | 400 | INVALID_ARGUMENT (needs special input shape) |
| gemma-4-26b-a4b-it | 500 | INTERNAL |
| gemma-4-31b-it | 500 | INTERNAL |

## The finding that matters

`gemini-pro-latest` silently serves the banned preview version. This is the measured root
cause of the earlier «prod serves the banned version» drift. Consequence (now law in
MODEL_ROLE_MATRIX + enforced culture): **models are pinned by exact id only; any
`*-latest`/default for the pro class is forbidden.**

## Limits of this measurement
- One probe per model, one moment in time, during a Google instability window.
- Heavy (full-page image) calls were NOT probed here — 2.5-pro heavy calls were 503-ing
  in waves the same evening (separate observation, window logs).
- gemma-4 hosted 500s may be transient storm effects, not a verdict on the models.
