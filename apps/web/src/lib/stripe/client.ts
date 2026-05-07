import Stripe from 'stripe'

const secretKey = process.env.STRIPE_SECRET_KEY

export const stripe = secretKey
  ? new Stripe(secretKey, { apiVersion: '2026-04-22.dahlia' })
  : null

export const STRIPE_PRICES = {
  reparoleU4UTier1: process.env.STRIPE_PRICE_ID_REPAROLE_TIER1 ?? '',
  translationSingle: process.env.STRIPE_PRICE_ID_TRANSLATION_SINGLE ?? '',
} as const

export type StripeProduct = 're-parole-u4u' | 'translation'

export const isStripeConfigured = (product?: StripeProduct) => {
  if (!stripe) return false
  if (product === 'translation') return !!STRIPE_PRICES.translationSingle
  if (product === 're-parole-u4u') return !!STRIPE_PRICES.reparoleU4UTier1
  return !!STRIPE_PRICES.reparoleU4UTier1
}
