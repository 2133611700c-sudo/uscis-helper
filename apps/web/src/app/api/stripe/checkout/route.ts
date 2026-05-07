import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import { stripe, STRIPE_PRICES, isStripeConfigured, StripeProduct } from '@/lib/stripe/client'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { TRANSLATION_PRICE_CENTS, REPAROLE_TIER1_PRICE_CENTS } from '@/lib/pricing'

export const dynamic = 'force-dynamic'

// ── Price + routing config per product ────────────────────────────────────────
const PRODUCT_CONFIG: Record<
  StripeProduct,
  {
    priceId: () => string
    amountCents: number
    successPath: (locale: string, sessionId: string) => string
    cancelPath: (locale: string) => string
  }
> = {
  're-parole-u4u': {
    priceId: () => STRIPE_PRICES.reparoleU4UTier1,
    amountCents: REPAROLE_TIER1_PRICE_CENTS,
    successPath: (locale, sessionId) =>
      `/${locale}/services/re-parole-u4u/checkout/success?cs={CHECKOUT_SESSION_ID}&wizard=${sessionId}`,
    cancelPath: (locale) => `/${locale}/services/re-parole-u4u`,
  },
  translation: {
    priceId: () => STRIPE_PRICES.translationSingle,
    amountCents: TRANSLATION_PRICE_CENTS,
    successPath: (locale, _sessionId) =>
      `/${locale}/services/translate-document/checkout/success?cs={CHECKOUT_SESSION_ID}`,
    cancelPath: (locale) => `/${locale}/services/translate-document`,
  },
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { session_id, locale = 'en', product = 're-parole-u4u' } = body as {
    session_id?: string
    locale?: string
    product?: StripeProduct
  }

  const cfg = PRODUCT_CONFIG[product] ?? PRODUCT_CONFIG['re-parole-u4u']

  if (!isStripeConfigured(product) || !stripe) {
    return NextResponse.json({ error: 'Stripe not configured', free: true }, { status: 503 })
  }

  if (!session_id && product !== 'translation') {
    return NextResponse.json({ error: 'session_id required' }, { status: 400 })
  }

  const priceId = cfg.priceId()
  if (!priceId) {
    return NextResponse.json({ error: 'Price ID not configured', free: true }, { status: 503 })
  }

  const origin = req.headers.get('origin') ?? 'https://messenginfo.com'

  const checkout = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}${cfg.successPath(locale, session_id ?? '')}`,
    cancel_url: `${origin}${cfg.cancelPath(locale)}`,
    metadata: {
      wizard_session_id: session_id ?? '',
      service: product,
      tier: '1',
    },
  })

  const supabase = createAdminSupabaseClient()
  after(async () => {
    const { error } = await supabase.from('audit_log').insert({
      action: 'stripe_checkout_created',
      target_table: 'wizard_sessions',
      target_id: session_id ?? product,
      detail: {
        stripe_checkout_id: checkout.id,
        amount_cents: cfg.amountCents,
        service_slug: product,
        tier: 1,
      },
    })
    if (error) console.error('[audit_log] stripe_checkout_created failed:', error.message)
  })

  return NextResponse.json({ url: checkout.url, checkout_id: checkout.id })
}
