import { NextRequest, NextResponse } from 'next/server'
import { generateMiaAnswer } from '@uscis-helper/ai'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { locale = 'en', serviceSlug = 're-parole-u4u', message, context } = body

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json({ error: 'message required' }, { status: 400 })
    }

    if (message.length > 500) {
      return NextResponse.json({ error: 'message too long (max 500 chars)' }, { status: 400 })
    }

    const result = await generateMiaAnswer({
      locale,
      serviceSlug,
      userMessage: message.trim(),
      context,
    })

    return NextResponse.json(result)
  } catch (e: unknown) {
    const msg = String(e)
    if (msg.includes('DEEPSEEK_API_KEY not configured')) {
      return NextResponse.json(
        { error: 'AI assistant temporarily unavailable', code: 'AI_NOT_CONFIGURED' },
        { status: 503 }
      )
    }
    console.error('[mia/chat] error:', msg)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
