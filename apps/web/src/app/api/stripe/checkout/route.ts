import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import { stripe, STRIPE_PRICES, isStripeConfigured } from '@/lib/stripe/client'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  if (!isStripeConfigured() || !stripe) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 })
  }

  const body = await req.json().catch(() => ({}))
  const { session_id, locale = 'en' } = body
  if (!session_id) {
    return NextResponse.json({ error: 'session_id required' }, { status: 400 })
  }

  const origin = req.headers.get('origin') ?? 'https://messenginfo.com'

  const checkout = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [{ price: STRIPE_PRICES.reparoleU4UTier1, quantity: 1 }],
    success_url: `${origin}/${locale}/services/re-parole-u4u/checkout/success?cs={CHECKOUT_SESSION_ID}&wizard=${session_id}`,
    cancel_url: `${origin}/${locale}/services/re-parole-u4u`,
    metadata: { wizard_session_id: session_id, service: 're-parole-u4u', tier: '1' },
  })

  const supabase = createAdminSupabaseClient()
  after(async () => {
    const { error } = await supabase.from('audit_log').insert({
      action: 'stripe_checkout_created',
      target_table: 'wizard_sessions',
      target_id: session_id,
      detail: {
        stripe_checkout_id: checkout.id,
        amount_cents: 1500,
        service_slug: 're-parole-u4u',
        tier: 1,
      },
    })
    if (error) console.error('[audit_log] stripe_checkout_created failed:', error.message)
  })

  return NextResponse.json({ url: checkout.url, checkout_id: checkout.id })
}
