import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import Stripe from 'stripe'
import { stripe } from '@/lib/stripe/client'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  if (!stripe) return NextResponse.json({ error: 'Stripe disabled' }, { status: 503 })

  const sig = req.headers.get('stripe-signature')
  const whsec = process.env.STRIPE_WEBHOOK_SECRET
  if (!sig || !whsec) return NextResponse.json({ error: 'Missing signature' }, { status: 400 })

  const body = await req.text()
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, whsec)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = createAdminSupabaseClient()

  if (event.type === 'checkout.session.completed') {
    const cs = event.data.object as Stripe.Checkout.Session
    const wizardSessionId = cs.metadata?.wizard_session_id ?? ''

    after(async () => {
      const { error } = await supabase.from('audit_log').insert({
        action: 'stripe_payment_succeeded',
        target_table: 'wizard_sessions',
        target_id: wizardSessionId,
        detail: {
          stripe_checkout_id: cs.id,
          amount_total: cs.amount_total,
          customer_email: (cs.customer_details as { email?: string } | null)?.email ?? null,
          service_slug: cs.metadata?.service ?? null,
        },
      })
      if (error) console.error('[audit_log] stripe_payment_succeeded failed:', error.message)
    })
  }

  return NextResponse.json({ received: true })
}
