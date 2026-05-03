/**
 * Messenginfo AI client — DeepSeek via OpenAI-compatible API
 * Model routing:
 *   deepseek-reasoner (R1) → Mia consultation / legal-adjacent reasoning
 *   deepseek-chat         → Mia FAQ simple responses (default)
 */
import OpenAI from 'openai'

export interface MiaInput {
  locale: string
  serviceSlug: string
  userMessage: string
  context?: string
}

export interface MiaOutput {
  answer: string
  model: string
  disclaimer: string
}

const DISCLAIMER: Record<string, string> = {
  en: 'This is general information only, not legal advice. Consult a qualified immigration attorney for your specific situation.',
  ru: 'Это только общая информация, а не юридическая консультация. По вашей конкретной ситуации обратитесь к квалифицированному иммиграционному адвокату.',
  uk: 'Це лише загальна інформація, а не юридична порада. З вашою конкретною ситуацією зверніться до кваліфікованого імміграційного адвоката.',
  es: 'Esta es solo información general, no asesoría legal. Consulte a un abogado de inmigración calificado para su situación específica.',
}

const HIGH_RISK_TERMS = ['guarantee', 'approve', 'qualify', 'certif', 'guaranteed', 'will be approved']

function containsHighRisk(text: string): boolean {
  return HIGH_RISK_TERMS.some(t => text.toLowerCase().includes(t))
}

function getSystemPrompt(locale: string, serviceSlug: string): string {
  return `You are Mia, an information assistant for Messenginfo, a self-help tool for immigrants navigating USCIS forms.

RULES (NEVER VIOLATE):
1. You provide general information only — never legal advice.
2. Never say "you qualify", "you will be approved", "guaranteed", or make any outcome predictions.
3. Never claim to be affiliated with USCIS, DHS, or any government agency.
4. If asked for legal advice, say: "Please consult a qualified immigration attorney."
5. If you are unsure, say: "I cannot verify this. Please check uscis.gov directly."
6. You are helping with: ${serviceSlug}
7. Respond in: ${locale}
8. Keep answers concise (under 120 words).
9. Always end with "Check official info at uscis.gov."
10. Never hallucinate form numbers, fees, or deadlines.`
}

export async function generateMiaAnswer(input: MiaInput): Promise<MiaOutput> {
  const apiKey = process.env.DEEPSEEK_API_KEY
  const baseURL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com'
  const model = process.env.DEEPSEEK_MODEL || 'deepseek-chat'

  if (!apiKey) {
    throw new Error('DEEPSEEK_API_KEY not configured')
  }

  if (containsHighRisk(input.userMessage)) {
    return {
      answer:
        'This question requires legal analysis I cannot provide. Please consult a qualified immigration attorney. Check official info at uscis.gov.',
      model,
      disclaimer: DISCLAIMER[input.locale] ?? DISCLAIMER.en,
    }
  }

  const client = new OpenAI({ apiKey, baseURL })

  const response = await client.chat.completions.create({
    model,
    max_tokens: 200,
    temperature: 0.3,
    messages: [
      { role: 'system', content: getSystemPrompt(input.locale, input.serviceSlug) },
      { role: 'user', content: input.userMessage },
    ],
  })

  const answer =
    response.choices[0]?.message?.content ??
    'I could not generate an answer. Please check uscis.gov directly.'

  return {
    answer,
    model,
    disclaimer: DISCLAIMER[input.locale] ?? DISCLAIMER.en,
  }
}
