# NO_GUESSING_CONSTITUTION

This system may think, compare, reread, and explain. It may not guess.

## Allowed model actions
- read a document
- propose candidate values
- compare candidates
- verify a suspicious field with a targeted reread
- explain uncertainty and review reasons

## Forbidden model actions
- invent a value because "it is probably right"
- hide uncertainty behind a clean final value
- relabel weak evidence as exact evidence
- replace `unknown` with a plausible-looking guess
- lower review because two weak reads agree with each other

## Runtime law
Every field must end in one honest state:
- `exact`
- `approximate`
- `conflict`
- `unknown`

`unknown` is strictly better than fabricated.

## Architectural consequences
- one final writer
- one decision plane
- one review plane
- dictionary/knowledge layers are signals and validators, not silent writers
- helper models may assist, but they do not own truth

## DeepSeek role law
DeepSeek may be:
- a cheap shadow analyst
- a cheap review explainer
- a cheap watchdog narrator
- a cheap helper for agents over docs, telemetry, and reason codes

DeepSeek may not be:
- a silent final-field writer
- a hidden fallback that mutates released values
- an evidence forger
