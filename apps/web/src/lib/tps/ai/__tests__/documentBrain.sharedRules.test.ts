/**
 * documentBrain — L9 DeepSeek shared-rules wiring + L10 flag-OFF parity.
 *
 * HARD INVARIANT (this test is the proof): with DEEPSEEK_SHARED_RULES_ENABLED unset/!=="1",
 * the system prompt the brain sends to DeepSeek is BYTE-IDENTICAL to the bare SYSTEM_PROMPT
 * (no shared block). With the flag ON and a known slot hint, the SAME (text-only) reading
 * rules the Gemini reader uses are appended.
 *
 * We observe the system message via an injected chatFn stub (no DeepSeek call).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import { runBrain, type DocumentBrainInput } from '@/lib/tps/ai/documentBrain'
import type { ChatMessage } from '@/lib/deepseek/client'

// A long-enough OCR text to pass the ≥10-char gate.
const RAW = 'Свідоцтво про народження Куропятник Сергей Леонидович 25 червня 1986'

/** Capture the system message, then return a minimal valid JSON envelope. */
function capturingChat(captured: { system?: string }) {
  return async (msgs: ChatMessage[]): Promise<{ content: string }> => {
    captured.system = msgs.find((m) => m.role === 'system')?.content
    return {
      content: JSON.stringify({
        document_type: 'unknown',
        document_type_confidence: 0.1,
        fields: {},
        warnings: [],
        needs_manual_review: false,
      }),
    }
  }
}

async function systemPromptFor(hint: string | null): Promise<string> {
  const captured: { system?: string } = {}
  const input: DocumentBrainInput = {
    raw_text: RAW,
    lines: RAW.split(' '),
    doc_type_hint: hint,
    chatFn: capturingChat(captured),
  }
  const out = await runBrain(input)
  expect(out.ok).toBe(true)
  expect(captured.system).toBeTypeOf('string')
  return captured.system as string
}

describe('documentBrain shared-rules wiring', () => {
  const PRIOR = process.env.DEEPSEEK_SHARED_RULES_ENABLED

  beforeEach(() => {
    delete process.env.DEEPSEEK_SHARED_RULES_ENABLED
  })
  afterEach(() => {
    if (PRIOR === undefined) delete process.env.DEEPSEEK_SHARED_RULES_ENABLED
    else process.env.DEEPSEEK_SHARED_RULES_ENABLED = PRIOR
  })

  it('flag OFF → system prompt is byte-identical regardless of hint (no shared block)', async () => {
    const noHint = await systemPromptFor(null)
    const passportHint = await systemPromptFor('passport')
    const bookletHint = await systemPromptFor('booklet')
    // No hint changes anything when the flag is off.
    expect(passportHint).toBe(noHint)
    expect(bookletHint).toBe(noHint)
    // And the bare prompt carries NONE of the shared-rules markers.
    expect(noHint).not.toContain('SHARED DOCUMENT READING RULES')
  })

  it('flag ON + known hint → appends the SAME (text-only) reading block', async () => {
    process.env.DEEPSEEK_SHARED_RULES_ENABLED = '1'
    const off = (() => {
      delete process.env.DEEPSEEK_SHARED_RULES_ENABLED
      return systemPromptFor('passport')
    })()
    const offPrompt = await off
    process.env.DEEPSEEK_SHARED_RULES_ENABLED = '1'
    const onPrompt = await systemPromptFor('passport')

    expect(onPrompt).not.toBe(offPrompt)
    expect(onPrompt.startsWith(offPrompt)).toBe(true) // additive — appended only
    expect(onPrompt).toContain('SHARED DOCUMENT READING RULES (text-only) for this ua_international_passport')
    // pixel-only guidance must NOT appear in the text model's prompt.
    expect(onPrompt.toLowerCase()).not.toContain('letter by letter')
  })

  it('flag ON + unknown/unmapped hint (dl) → still byte-identical (no block)', async () => {
    process.env.DEEPSEEK_SHARED_RULES_ENABLED = '1'
    const dl = await systemPromptFor('dl')
    delete process.env.DEEPSEEK_SHARED_RULES_ENABLED
    const dlOff = await systemPromptFor('dl')
    expect(dl).toBe(dlOff)
    expect(dl).not.toContain('SHARED DOCUMENT READING RULES')
  })

  it('flag ON maps every covered TPS slot hint to a shared block', async () => {
    process.env.DEEPSEEK_SHARED_RULES_ENABLED = '1'
    for (const hint of ['passport', 'booklet', 'military_id', 'i94', 'ead', 'ead_old', 'i797', 'i797_or_ead']) {
      const p = await systemPromptFor(hint)
      expect(p).toContain('SHARED DOCUMENT READING RULES (text-only)')
    }
  })
})
