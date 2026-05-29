/**
 * engine/translator.ts — D3b: LLM prose translator (DeepSeek) for FREE TEXT
 * only. Names, numbers, dates are LOCKED — they come pre-resolved from D2/D3a
 * and must NOT be re-translated or altered (v5 §7). The LLM only renders the
 * surrounding Ukrainian prose into formal English.
 */

export type ProseTranslator = (cyrillic: string, lockedTokens: string[]) => Promise<string>

/** DeepSeek-backed prose translator. Returns the original on any failure
 *  (caller keeps review_required — never silently drops text). */
export function deepseekProseTranslator(opts: { apiKey: string; model?: string; baseUrl?: string; timeoutMs?: number }): ProseTranslator {
  const model = opts.model ?? 'deepseek-chat'
  const base = opts.baseUrl ?? 'https://api.deepseek.com'
  return async (cyrillic, lockedTokens) => {
    if (!cyrillic?.trim()) return ''
    const lockNote = lockedTokens.filter(Boolean).length
      ? `Do NOT translate or alter these proper nouns/numbers — keep them EXACTLY: ${lockedTokens.filter(Boolean).join(' | ')}.`
      : ''
    const prompt = `Translate this Ukrainian official-document text into formal English for a USCIS submission. ${lockNote}
Translate institution/agency names accurately; do NOT add, omit, or embellish. Output ONLY the English translation, no notes.

Ukrainian: ${cyrillic}`
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 30000)
    try {
      const res = await fetch(`${base}/chat/completions`, {
        method: 'POST', signal: ctrl.signal,
        headers: { authorization: `Bearer ${opts.apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({ model, temperature: 0, messages: [{ role: 'user', content: prompt }] }),
      })
      const j = await res.json()
      return (j?.choices?.[0]?.message?.content ?? '').trim() || cyrillic
    } catch {
      return cyrillic // keep original; field stays review_required
    } finally { clearTimeout(t) }
  }
}
